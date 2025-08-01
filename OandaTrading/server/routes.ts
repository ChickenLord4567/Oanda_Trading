import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { OandaService } from "./services/oanda";
import { MongoDBService } from "./services/mongodb";
import { AuthService } from "./services/auth";
import { placeTradeSchema, closeTradeSchema } from "../shared/schema";

const oandaService = new OandaService();
const mongoService = new MongoDBService();
const authService = new AuthService();

// Trade management polling
let tradingPollInterval: NodeJS.Timeout;

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "trading-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
    }),
  );

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.authenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Authentication routes
  app.post("/api/login", (req: any, res) => {
    const { username, password } = req.body;

    if (authService.validateCredentials(username, password)) {
      req.session.authenticated = true;
      req.session.userId = username;
      res.json({ success: true, message: "Login successful" });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  app.post("/api/logout", (req: any, res) => {
    req.session.destroy(() => {
      res.json({ success: true, message: "Logout successful" });
    });
  });

  app.get("/api/auth/check", (req: any, res) => {
    res.json({ authenticated: !!req.session.authenticated });
  });

  // Trading routes
  app.get("/api/current-price/:instrument", requireAuth, async (req, res) => {
    try {
      const { instrument } = req.params;
      const price = await oandaService.getCurrentPrice(instrument);
      res.json(price);
    } catch (error) {
      console.error("Price fetch error:", error);
      res.status(500).json({ message: "Failed to fetch current price" });
    }
  });

  app.get("/api/market-status", requireAuth, async (req, res) => {
    try {
      const status = oandaService.getMarketStatus();
      res.json(status);
    } catch (error) {
      console.error("Market status error:", error);
      res.status(500).json({ message: "Failed to get market status" });
    }
  });

  app.get("/api/account-balance", requireAuth, async (req, res) => {
    try {
      const balance = await oandaService.getAccountBalance();
      res.json(balance);
    } catch (error) {
      console.error("Balance fetch error:", error);
      res.status(500).json({ message: "Failed to fetch account balance" });
    }
  });

  app.post("/api/place-trade", requireAuth, async (req, res) => {
    try {
      const tradeData = placeTradeSchema.parse(req.body);

      // Get current price for validation
      const currentPrice = await oandaService.getCurrentPrice(
        tradeData.instrument,
      );
      const marketPrice =
        tradeData.direction === "buy" ? currentPrice.ask : currentPrice.bid;

      // Convert lot size to units
      const units = oandaService.convertUnitsForInstrument(
        tradeData.instrument,
        tradeData.lotSize,
      );

      // Place trade with OANDA (includes market hours and parameter validation)
      const result = await oandaService.placeTrade({
        instrument: tradeData.instrument,
        direction: tradeData.direction,
        units,
        tp1: tradeData.tp1,
        tp2: tradeData.tp2,
        sl: tradeData.sl,
        currentPrice: marketPrice,
      });

      // Save to MongoDB after successful OANDA execution
      const trade = await mongoService.saveTrade({
        ...tradeData,
        entryPrice: result.price,
        dateOpened: new Date(),
        oandaTradeId: result.tradeId,
        status: "open",
        partialClosed: false,
        tp1Hit: false,
        tp2Hit: false,
        slHit: false,
      });

      res.json({ success: true, trade, oandaTradeId: result.tradeId });
    } catch (error) {
      console.error("Trade placement error:", error);

      // Enhanced error handling with specific error types
      let errorMessage = "Failed to place trade";
      let errorType = "UNKNOWN_ERROR";

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes("market is closed")) {
          errorType = "MARKET_CLOSED";
          errorMessage = error.message;
        } else if (
          errorMsg.includes("take profit") ||
          errorMsg.includes("stop loss")
        ) {
          errorType = "INVALID_PARAMETERS";
          errorMessage = error.message;
        } else if (errorMsg.includes("insufficient margin")) {
          errorType = "INSUFFICIENT_MARGIN";
          errorMessage =
            "Insufficient margin - reduce lot size or close existing positions";
        } else if (errorMsg.includes("position limit")) {
          errorType = "POSITION_LIMIT";
          errorMessage =
            "Position limit exceeded - close some existing trades first";
        } else if (errorMsg.includes("market halted")) {
          errorType = "MARKET_HALTED";
          errorMessage = "Market is currently halted - please try again later";
        } else {
          errorMessage = error.message;
        }
      }

      res.status(400).json({
        success: false,
        message: errorMessage,
        errorType,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/api/close-trade", requireAuth, async (req, res) => {
    try {
      const { tradeId } = closeTradeSchema.parse(req.body);

      // Get trade from MongoDB
      const trade = await mongoService.getTradeByOandaId(tradeId);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Close trade with OANDA
      const result = await oandaService.closeTrade(tradeId);

      // Update MongoDB after successful OANDA execution
      const updateData = {
        status: "closed",
        dateClosed: new Date(),
        profitLoss: result.realizedPL,
        isProfit: result.realizedPL > 0,
        isLoss: result.realizedPL < 0,
      };

      console.log(`🔄 Updating trade ${tradeId} with:`, updateData);
      await mongoService.updateTrade(tradeId, updateData);
      console.log(
        `✅ Trade ${tradeId} successfully closed at ${updateData.dateClosed}`,
      );

      res.json({ success: true, profitLoss: result.realizedPL });
    } catch (error) {
      console.error("Trade close error:", error);
      res
        .status(500)
        .json({
          message: "Failed to close trade",
          error: error instanceof Error ? error.message : "Unknown error",
        });
    }
  });

  app.get("/api/open-trades", requireAuth, async (req, res) => {
    try {
      const mongoTrades = await mongoService.getOpenTrades();
      const oandaTrades = await oandaService.getOpenTrades();

      // Merge MongoDB and OANDA data
      const enrichedTrades = mongoTrades.map((trade) => {
        const oandaTrade = oandaTrades.find(
          (ot) => ot.id === trade.oandaTradeId,
        );
        return {
          ...trade,
          currentPrice: oandaTrade ? parseFloat(oandaTrade.price) : null,
          unrealizedPL: oandaTrade ? parseFloat(oandaTrade.unrealizedPL) : null,
        };
      });

      res.json(enrichedTrades);
    } catch (error) {
      console.error("Open trades fetch error:", error);
      res.status(500).json({ message: "Failed to fetch open trades" });
    }
  });

  app.get("/api/recent-trades", requireAuth, async (req, res) => {
    try {
      const trades = await mongoService.getRecentTrades(10);
      console.log(`📊 Recent trades query returned ${trades.length} trades`);
      if (trades.length > 0) {
        console.log("📅 Most recent trade closed at:", trades[0].dateClosed);
      }
      res.json(trades);
    } catch (error) {
      console.error("Recent trades fetch error:", error);
      res.status(500).json({ message: "Failed to fetch recent trades" });
    }
  });

  app.get("/api/trade-statistics/:days", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.params.days);
      const stats = await mongoService.getTradeStatistics(days);
      res.json(stats);
    } catch (error) {
      console.error("Statistics fetch error:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.get("/api/profit-loss-summary", requireAuth, async (req, res) => {
    try {
      const summary = await mongoService.getTotalProfitLoss();
      res.json(summary);
    } catch (error) {
      console.error("P/L summary fetch error:", error);
      res.status(500).json({ message: "Failed to fetch P/L summary" });
    }
  });

  // Chart data endpoints for Phase 2
  app.get(
    "/api/chart/:instrument/:timeframe",
    requireAuth,
    async (req, res) => {
      try {
        const { instrument, timeframe } = req.params;

        // Convert timeframe to OANDA format
        let granularity = "M15"; // Default to 15 minutes
        switch (timeframe) {
          case "1m":
            granularity = "M1";
            break;
          case "5m":
            granularity = "M5";
            break;
          case "15m":
            granularity = "M15";
            break;
          case "1h":
            granularity = "H1";
            break;
          case "4h":
            granularity = "H4";
            break;
          case "1d":
            granularity = "D";
            break;
        }

        const chartData = await oandaService.getCandleData(
          instrument,
          granularity,
          3000,
        );
        res.json(chartData);
      } catch (error) {
        console.error("Chart data fetch error:", error);
        res.status(500).json({ message: "Failed to fetch chart data" });
      }
    },
  );

  // Clean up orphaned trades and sync existing OANDA trades
  app.post("/api/cleanup-trades", requireAuth, async (req, res) => {
    try {
      // Get all open trades from MongoDB
      const mongoTrades = await mongoService.getOpenTrades();

      // Get all open trades from OANDA
      const oandaTrades = await oandaService.getOpenTrades();
      const oandaTradeIds = new Set(oandaTrades.map((trade) => trade.id));

      // Find MongoDB trades that don't exist in OANDA (orphaned)
      const orphanedTrades = mongoTrades.filter(
        (trade) => !oandaTradeIds.has(trade.oandaTradeId),
      );

      // Find OANDA trades that don't exist in MongoDB (missing sync)
      const mongoTradeIds = new Set(
        mongoTrades.map((trade) => trade.oandaTradeId),
      );
      const missingSyncTrades = oandaTrades.filter(
        (trade) => !mongoTradeIds.has(trade.id),
      );

      let message = "";
      let deletedCount = 0;
      let syncedCount = 0;

      // Clean up orphaned trades
      if (orphanedTrades.length > 0) {
        const orphanedIds = orphanedTrades.map((trade) => trade.oandaTradeId);
        deletedCount = await mongoService.deleteTradesByOandaIds(orphanedIds);
        console.log(
          `🧹 Cleaned up ${deletedCount} orphaned trades:`,
          orphanedIds,
        );
      }

      // Sync missing OANDA trades to MongoDB
      if (missingSyncTrades.length > 0) {
        for (const oandaTrade of missingSyncTrades) {
          try {
            const tradeData = {
              instrument: oandaTrade.instrument.replace("_", ""),
              direction:
                parseFloat(oandaTrade.currentUnits) > 0
                  ? ("buy" as const)
                  : ("sell" as const),
              entryPrice: parseFloat(oandaTrade.price),
              lotSize: Math.abs(parseFloat(oandaTrade.currentUnits)) / 100000, // Convert to standard lot size
              tp1: parseFloat(oandaTrade.price) * 1.01, // Default TP1
              tp2: parseFloat(oandaTrade.price) * 1.02, // Default TP2
              sl: parseFloat(oandaTrade.price) * 0.99, // Default SL
              dateOpened: oandaTrade.openTime,
              oandaTradeId: oandaTrade.id,
              status: "open" as const,
            };

            await mongoService.saveTrade(tradeData);
            syncedCount++;
          } catch (error) {
            console.error(`Failed to sync trade ${oandaTrade.id}:`, error);
          }
        }
        console.log(
          `🔄 Synced ${syncedCount} existing OANDA trades to MongoDB`,
        );
      }

      if (deletedCount > 0 && syncedCount > 0) {
        message = `Cleaned up ${deletedCount} orphaned trades and synced ${syncedCount} existing trades`;
      } else if (deletedCount > 0) {
        message = `Cleaned up ${deletedCount} orphaned trades`;
      } else if (syncedCount > 0) {
        message = `Synced ${syncedCount} existing trades from OANDA`;
      } else {
        message = "No cleanup or sync needed";
      }

      res.json({
        success: true,
        message,
        deletedTrades: orphanedTrades.map((t) => t.oandaTradeId),
        syncedTrades: missingSyncTrades.map((t) => t.id),
      });
    } catch (error) {
      console.error("Error cleaning up trades:", error);
      res.status(500).json({
        message: "Failed to cleanup trades",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Start trade management polling
  startTradeManagement();

  const httpServer = createServer(app);
  return httpServer;
}

// Background trade management
async function startTradeManagement() {
  if (tradingPollInterval) {
    clearInterval(tradingPollInterval);
  }

  tradingPollInterval = setInterval(async () => {
    try {
      await manageActiveTrades();
    } catch (error) {
      console.error("Trade management error:", error);
    }
  }, 5000); // Every 5 seconds
}

async function manageActiveTrades() {
  const mongoTrades = await mongoService.getOpenTrades();
  const oandaTrades = await oandaService.getOpenTrades();

  for (const trade of mongoTrades) {
    const oandaTrade = oandaTrades.find((ot) => ot.id === trade.oandaTradeId);
    if (!oandaTrade) continue;

    const currentPrice = parseFloat(oandaTrade.price);
    const isBuy = trade.direction === "buy";

    try {
      // Check TP1 hit
      if (
        !trade.tp1Hit &&
        ((isBuy && currentPrice >= trade.tp1) ||
          (!isBuy && currentPrice <= trade.tp1))
      ) {
        console.log(`TP1 hit for trade ${trade.oandaTradeId}`);

        // Close 75% of position
        const partialUnits = Math.floor(
          parseFloat(oandaTrade.currentUnits) * 0.75,
        ).toString();
        await oandaService.closeTrade(trade.oandaTradeId, partialUnits);

        // Move SL to breakeven
        await oandaService.updateStopLoss(trade.oandaTradeId, trade.entryPrice);

        // Update MongoDB
        await mongoService.updateTrade(trade.oandaTradeId, {
          tp1Hit: true,
          partialClosed: true,
          status: "partial",
          sl: trade.entryPrice, // Update SL to breakeven
        });
      }

      // Check TP2 hit
      else if (
        trade.tp1Hit &&
        !trade.tp2Hit &&
        ((isBuy && currentPrice >= trade.tp2) ||
          (!isBuy && currentPrice <= trade.tp2))
      ) {
        console.log(`TP2 hit for trade ${trade.oandaTradeId}`);

        // Close remaining position
        const result = await oandaService.closeTrade(trade.oandaTradeId);

        // Update MongoDB
        await mongoService.updateTrade(trade.oandaTradeId, {
          tp2Hit: true,
          status: "closed",
          dateClosed: new Date(),
          profitLoss: result.realizedPL,
          isProfit: result.realizedPL > 0,
          isLoss: result.realizedPL < 0,
        });
      }

      // Check SL hit
      else if (
        !trade.slHit &&
        ((isBuy && currentPrice <= trade.sl) ||
          (!isBuy && currentPrice >= trade.sl))
      ) {
        console.log(`SL hit for trade ${trade.oandaTradeId}`);

        // Close entire position
        const result = await oandaService.closeTrade(trade.oandaTradeId);

        // Update MongoDB
        await mongoService.updateTrade(trade.oandaTradeId, {
          slHit: true,
          status: "closed",
          dateClosed: new Date(),
          profitLoss: result.realizedPL,
          isProfit: result.realizedPL > 0,
          isLoss: result.realizedPL < 0,
        });
      }
    } catch (error) {
      console.error(`Error managing trade ${trade.oandaTradeId}:`, error);
    }
  }
}
