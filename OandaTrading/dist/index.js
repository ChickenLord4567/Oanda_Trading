// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import session from "express-session";

// server/services/oanda.ts
import fetch from "node-fetch";
var OandaService = class {
  apiKey;
  accountId;
  baseUrl = "https://api-fxpractice.oanda.com/v3";
  constructor() {
    this.apiKey = process.env.OANDA_API_KEY || "";
    this.accountId = process.env.OANDA_ACCOUNT_ID || "";
    if (!this.apiKey || !this.accountId) {
      throw new Error("Missing OANDA credentials. Please check your .env file.");
    }
  }
  isMarketOpen() {
    const now = /* @__PURE__ */ new Date();
    const utcHour = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay();
    const currentTimeMinutes = utcHour * 60 + utcMinutes;
    const dailyCloseStart = 21 * 60;
    const dailyCloseEnd = 22 * 60 + 10;
    if (currentTimeMinutes >= dailyCloseStart && currentTimeMinutes <= dailyCloseEnd) {
      return false;
    }
    if (dayOfWeek === 5) {
      if (currentTimeMinutes >= dailyCloseStart) {
        return false;
      }
    } else if (dayOfWeek === 6) {
      return false;
    } else if (dayOfWeek === 0) {
      if (currentTimeMinutes <= dailyCloseEnd) {
        return false;
      }
    }
    return true;
  }
  getMarketStatus() {
    if (this.isMarketOpen()) {
      return { isOpen: true };
    }
    const now = /* @__PURE__ */ new Date();
    const utcHour = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay();
    const currentTimeMinutes = utcHour * 60 + utcMinutes;
    const dailyCloseStart = 22 * 60;
    const dailyCloseEnd = 23 * 60 + 10;
    if (currentTimeMinutes >= dailyCloseStart && currentTimeMinutes <= dailyCloseEnd) {
      const reopenTime = new Date(now);
      reopenTime.setUTCHours(23, 10, 0, 0);
      if (reopenTime <= now) {
        reopenTime.setUTCDate(reopenTime.getUTCDate() + 1);
      }
      return {
        isOpen: false,
        message: "Market is closed for daily maintenance (22:00-23:10 UTC)",
        reopensAt: reopenTime.toISOString()
      };
    }
    if (dayOfWeek === 5 && currentTimeMinutes >= dailyCloseStart) {
      const reopenTime = new Date(now);
      reopenTime.setUTCDate(reopenTime.getUTCDate() + 2);
      reopenTime.setUTCHours(23, 10, 0, 0);
      return {
        isOpen: false,
        message: "Market is closed for weekend (Friday 22:00 - Sunday 23:10 UTC)",
        reopensAt: reopenTime.toISOString()
      };
    }
    if (dayOfWeek === 6) {
      const reopenTime = new Date(now);
      reopenTime.setUTCDate(reopenTime.getUTCDate() + 1);
      reopenTime.setUTCHours(23, 10, 0, 0);
      return {
        isOpen: false,
        message: "Market is closed for weekend (Friday 22:00 - Sunday 23:10 UTC)",
        reopensAt: reopenTime.toISOString()
      };
    }
    if (dayOfWeek === 0 && currentTimeMinutes <= dailyCloseEnd) {
      const reopenTime = new Date(now);
      reopenTime.setUTCHours(23, 10, 0, 0);
      return {
        isOpen: false,
        message: "Market is closed for weekend (Friday 22:00 - Sunday 23:10 UTC)",
        reopensAt: reopenTime.toISOString()
      };
    }
    return { isOpen: false, message: "Market is currently closed" };
  }
  formatInstrument(symbol) {
    if (symbol.length >= 6) {
      return symbol.slice(0, 3) + "_" + symbol.slice(3);
    }
    return symbol;
  }
  getHeaders() {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };
  }
  async getCurrentPrice(instrument) {
    const formattedInstrument = this.formatInstrument(instrument);
    const url = `${this.baseUrl}/accounts/${this.accountId}/pricing?instruments=${formattedInstrument}`;
    const response = await fetch(url, {
      headers: this.getHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to get pricing: ${response.statusText}`);
    }
    const data = await response.json();
    const price = data.prices[0];
    return {
      bid: parseFloat(price.bids[0].price),
      ask: parseFloat(price.asks[0].price)
    };
  }
  async getAccountBalance() {
    const url = `${this.baseUrl}/accounts/${this.accountId}`;
    const response = await fetch(url, {
      headers: this.getHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to get account info: ${response.statusText}`);
    }
    const data = await response.json();
    return {
      balance: parseFloat(data.account.balance),
      unrealizedPL: parseFloat(data.account.unrealizedPL)
    };
  }
  async getOpenTrades() {
    const url = `${this.baseUrl}/accounts/${this.accountId}/openTrades`;
    const response = await fetch(url, {
      headers: this.getHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to get open trades: ${response.statusText}`);
    }
    const data = await response.json();
    return data.trades || [];
  }
  validateTradeParameters(params) {
    const { direction, tp1, tp2, sl, currentPrice } = params;
    if (!currentPrice) {
      return { isValid: false, error: "Unable to get current market price" };
    }
    if (tp1 && tp2 && sl) {
      if (direction === "buy") {
        if (tp1 <= currentPrice) {
          return { isValid: false, error: "Take Profit 1 must be above current price for BUY orders" };
        }
        if (tp2 <= currentPrice) {
          return { isValid: false, error: "Take Profit 2 must be above current price for BUY orders" };
        }
        if (sl >= currentPrice) {
          return { isValid: false, error: "Stop Loss must be below current price for BUY orders" };
        }
        if (tp1 >= tp2) {
          return { isValid: false, error: "Take Profit 2 must be higher than Take Profit 1" };
        }
      } else {
        if (tp1 >= currentPrice) {
          return { isValid: false, error: "Take Profit 1 must be below current price for SELL orders" };
        }
        if (tp2 >= currentPrice) {
          return { isValid: false, error: "Take Profit 2 must be below current price for SELL orders" };
        }
        if (sl <= currentPrice) {
          return { isValid: false, error: "Stop Loss must be above current price for SELL orders" };
        }
        if (tp1 <= tp2) {
          return { isValid: false, error: "Take Profit 2 must be lower than Take Profit 1" };
        }
      }
    }
    return { isValid: true };
  }
  async placeTrade(params) {
    const marketStatus = this.getMarketStatus();
    if (!marketStatus.isOpen) {
      throw new Error(`${marketStatus.message}${marketStatus.reopensAt ? ` - Market reopens at ${new Date(marketStatus.reopensAt).toLocaleString()}` : ""}`);
    }
    const validation = this.validateTradeParameters(params);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    const formattedInstrument = this.formatInstrument(params.instrument);
    const units = params.direction === "buy" ? params.units : -params.units;
    const url = `${this.baseUrl}/accounts/${this.accountId}/orders`;
    const orderData = {
      order: {
        type: "MARKET",
        instrument: formattedInstrument,
        units: units.toString(),
        timeInForce: "FOK",
        positionFill: "DEFAULT"
      }
    };
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(orderData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OANDA order placement error:", errorText);
      throw new Error(`Failed to place trade: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    console.log("OANDA order response:", JSON.stringify(data, null, 2));
    if (data.orderFillTransaction) {
      return {
        tradeId: data.orderFillTransaction.tradeOpened?.tradeID || data.orderFillTransaction.id,
        price: parseFloat(data.orderFillTransaction.price)
      };
    }
    if (data.orderCreateTransaction) {
      throw new Error(`Order created but not filled. Reason: ${data.orderRejectTransaction?.rejectReason || "Market closed or insufficient liquidity"}`);
    }
    if (data.orderRejectTransaction) {
      const reason = data.orderRejectTransaction.rejectReason;
      if (reason === "INSUFFICIENT_MARGIN") {
        throw new Error("Insufficient margin - try reducing lot size or close existing positions");
      } else if (reason === "POSITION_LIMIT_EXCEEDED") {
        throw new Error("Position limit exceeded - close some existing trades first");
      } else if (reason === "MARKET_HALTED") {
        throw new Error("Market is currently halted - try again later");
      } else {
        throw new Error(`Order rejected: ${reason}`);
      }
    }
    throw new Error("Trade placement failed - no fill transaction");
  }
  async closeTrade(tradeId, units) {
    const url = `${this.baseUrl}/accounts/${this.accountId}/trades/${tradeId}/close`;
    const closeData = units ? { units } : {};
    const response = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(closeData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to close trade: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    return {
      realizedPL: parseFloat(data.orderFillTransaction?.pl || "0")
    };
  }
  async updateStopLoss(tradeId, stopLossPrice) {
    const url = `${this.baseUrl}/accounts/${this.accountId}/trades/${tradeId}/orders`;
    const orderData = {
      order: {
        type: "STOP_LOSS",
        price: stopLossPrice.toString(),
        timeInForce: "GTC",
        tradeID: tradeId
      }
    };
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(orderData)
    });
    if (!response.ok) {
      throw new Error(`Failed to update stop loss: ${response.statusText}`);
    }
  }
  convertUnitsForInstrument(instrument, lotSize) {
    if (instrument === "XAUUSD") {
      return lotSize * 100;
    }
    return lotSize * 1e5;
  }
  async getCandleData(instrument, granularity, count = 200) {
    const formattedInstrument = this.formatInstrument(instrument);
    const url = `${this.baseUrl}/instruments/${formattedInstrument}/candles?granularity=${granularity}&count=${count}`;
    const response = await fetch(url, {
      headers: this.getHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to get candle data: ${response.statusText}`);
    }
    const data = await response.json();
    return data.candles.map((candle) => ({
      time: Math.floor(new Date(candle.time).getTime() / 1e3),
      // Convert to Unix timestamp
      open: parseFloat(candle.mid.o),
      high: parseFloat(candle.mid.h),
      low: parseFloat(candle.mid.l),
      close: parseFloat(candle.mid.c),
      volume: candle.volume || 0
    }));
  }
};

// server/services/mongodb.ts
import mongoose from "mongoose";
var TradeSchema = new mongoose.Schema({
  instrument: { type: String, required: true },
  direction: { type: String, enum: ["buy", "sell"], required: true },
  entryPrice: { type: Number, required: true },
  closePrice: { type: Number },
  lotSize: { type: Number, required: true },
  tp1: { type: Number, required: true },
  tp2: { type: Number, required: true },
  sl: { type: Number, required: true },
  dateOpened: { type: Date, required: true },
  dateClosed: { type: Date },
  profitLoss: { type: Number },
  isProfit: { type: Boolean },
  isLoss: { type: Boolean },
  partialClosed: { type: Boolean, default: false },
  tp1Hit: { type: Boolean, default: false },
  tp2Hit: { type: Boolean, default: false },
  slHit: { type: Boolean, default: false },
  oandaTradeId: { type: String, required: true, unique: true },
  status: { type: String, enum: ["open", "partial", "closed"], default: "open" }
}, { timestamps: true });
var TradeModel = mongoose.model("Trade", TradeSchema);
var MongoDBService = class {
  connected = false;
  constructor() {
    this.connect();
  }
  async connect() {
    if (this.connected) return;
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("Missing MONGO_URI. Please check your .env file.");
    }
    try {
      await mongoose.connect(mongoUri, {
        ssl: true,
        serverSelectionTimeoutMS: 5e3,
        socketTimeoutMS: 45e3
      });
      this.connected = true;
      console.log("\u2705 MongoDB connected");
    } catch (error) {
      console.error("\u274C MongoDB connection error:", error);
      setTimeout(() => this.connect(), 5e3);
    }
  }
  async saveTrade(trade) {
    await this.connect();
    const newTrade = new TradeModel(trade);
    const saved = await newTrade.save();
    return saved.toObject();
  }
  async updateTrade(oandaTradeId, updates) {
    await this.connect();
    const updated = await TradeModel.findOneAndUpdate(
      { oandaTradeId },
      updates,
      { new: true }
    );
    return updated ? updated.toObject() : null;
  }
  async getTradeByOandaId(oandaTradeId) {
    await this.connect();
    const trade = await TradeModel.findOne({ oandaTradeId });
    return trade ? trade.toObject() : null;
  }
  async getOpenTrades() {
    await this.connect();
    const trades = await TradeModel.find({ status: { $in: ["open", "partial"] } });
    return trades.map((trade) => trade.toObject());
  }
  async deleteTradeByOandaId(oandaTradeId) {
    await this.connect();
    const result = await TradeModel.deleteOne({ oandaTradeId });
    return result.deletedCount > 0;
  }
  async deleteTradesByOandaIds(oandaTradeIds) {
    await this.connect();
    const result = await TradeModel.deleteMany({ oandaTradeId: { $in: oandaTradeIds } });
    return result.deletedCount || 0;
  }
  async getRecentTrades(limit = 10) {
    await this.connect();
    const trades = await TradeModel.find({
      status: "closed",
      dateClosed: { $exists: true, $ne: null }
    }).sort({ dateClosed: -1, createdAt: -1 }).limit(limit);
    return trades.map((trade) => trade.toObject());
  }
  async getTradeStatistics(days) {
    await this.connect();
    const startDate = /* @__PURE__ */ new Date();
    startDate.setDate(startDate.getDate() - days);
    const trades = await TradeModel.find({
      status: "closed",
      dateClosed: { $gte: startDate.toISOString() }
    });
    const wins = trades.filter((trade) => trade.isProfit).length;
    const losses = trades.filter((trade) => trade.isLoss).length;
    return {
      wins,
      losses,
      totalTrades: trades.length
    };
  }
  async getTotalProfitLoss() {
    await this.connect();
    const trades = await TradeModel.find({ status: "closed" });
    let totalProfit = 0;
    let totalLoss = 0;
    trades.forEach((trade) => {
      if (trade.profitLoss && trade.profitLoss > 0) {
        totalProfit += trade.profitLoss;
      } else if (trade.profitLoss && trade.profitLoss < 0) {
        totalLoss += Math.abs(trade.profitLoss);
      }
    });
    return { totalProfit, totalLoss };
  }
};

// server/services/auth.ts
var AuthService = class {
  validCredentials = {
    username: "trader",
    password: "trading123"
  };
  validateCredentials(username, password) {
    return username === this.validCredentials.username && password === this.validCredentials.password;
  }
  generateSession() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};

// shared/schema.ts
import { z } from "zod";
var users = {
  id: z.string(),
  username: z.string(),
  password: z.string()
};
var insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});
var tradeSchema = z.object({
  instrument: z.string(),
  direction: z.enum(["buy", "sell"]),
  entryPrice: z.number(),
  closePrice: z.number().optional(),
  lotSize: z.number(),
  tp1: z.number(),
  tp2: z.number(),
  sl: z.number(),
  dateOpened: z.date(),
  dateClosed: z.date().optional(),
  profitLoss: z.number().optional(),
  isProfit: z.boolean().optional(),
  isLoss: z.boolean().optional(),
  partialClosed: z.boolean().default(false),
  tp1Hit: z.boolean().default(false),
  tp2Hit: z.boolean().default(false),
  slHit: z.boolean().default(false),
  oandaTradeId: z.string(),
  status: z.enum(["open", "partial", "closed"]).default("open")
});
var insertTradeSchema = tradeSchema.omit({
  closePrice: true,
  dateClosed: true,
  profitLoss: true,
  isProfit: true,
  isLoss: true
});
var placeTradeSchema = z.object({
  instrument: z.string(),
  direction: z.enum(["buy", "sell"]),
  lotSize: z.number().positive(),
  tp1: z.number(),
  tp2: z.number(),
  sl: z.number()
});
var closeTradeSchema = z.object({
  tradeId: z.string()
});

// server/routes.ts
var oandaService = new OandaService();
var mongoService = new MongoDBService();
var authService = new AuthService();
var tradingPollInterval;
async function registerRoutes(app2) {
  app2.use(session({
    secret: process.env.SESSION_SECRET || "trading-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1e3 }
    // 24 hours
  }));
  const requireAuth = (req, res, next) => {
    if (!req.session.authenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };
  app2.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if (authService.validateCredentials(username, password)) {
      req.session.authenticated = true;
      req.session.userId = username;
      res.json({ success: true, message: "Login successful" });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });
  app2.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true, message: "Logout successful" });
    });
  });
  app2.get("/api/auth/check", (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
  });
  app2.get("/api/current-price/:instrument", requireAuth, async (req, res) => {
    try {
      const { instrument } = req.params;
      const price = await oandaService.getCurrentPrice(instrument);
      res.json(price);
    } catch (error) {
      console.error("Price fetch error:", error);
      res.status(500).json({ message: "Failed to fetch current price" });
    }
  });
  app2.get("/api/market-status", requireAuth, async (req, res) => {
    try {
      const status = oandaService.getMarketStatus();
      res.json(status);
    } catch (error) {
      console.error("Market status error:", error);
      res.status(500).json({ message: "Failed to get market status" });
    }
  });
  app2.get("/api/account-balance", requireAuth, async (req, res) => {
    try {
      const balance = await oandaService.getAccountBalance();
      res.json(balance);
    } catch (error) {
      console.error("Balance fetch error:", error);
      res.status(500).json({ message: "Failed to fetch account balance" });
    }
  });
  app2.post("/api/place-trade", requireAuth, async (req, res) => {
    try {
      const tradeData = placeTradeSchema.parse(req.body);
      const currentPrice = await oandaService.getCurrentPrice(tradeData.instrument);
      const marketPrice = tradeData.direction === "buy" ? currentPrice.ask : currentPrice.bid;
      const units = oandaService.convertUnitsForInstrument(tradeData.instrument, tradeData.lotSize);
      const result = await oandaService.placeTrade({
        instrument: tradeData.instrument,
        direction: tradeData.direction,
        units,
        tp1: tradeData.tp1,
        tp2: tradeData.tp2,
        sl: tradeData.sl,
        currentPrice: marketPrice
      });
      const trade = await mongoService.saveTrade({
        ...tradeData,
        entryPrice: result.price,
        dateOpened: /* @__PURE__ */ new Date(),
        oandaTradeId: result.tradeId,
        status: "open",
        partialClosed: false,
        tp1Hit: false,
        tp2Hit: false,
        slHit: false
      });
      res.json({ success: true, trade, oandaTradeId: result.tradeId });
    } catch (error) {
      console.error("Trade placement error:", error);
      let errorMessage = "Failed to place trade";
      let errorType = "UNKNOWN_ERROR";
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes("market is closed")) {
          errorType = "MARKET_CLOSED";
          errorMessage = error.message;
        } else if (errorMsg.includes("take profit") || errorMsg.includes("stop loss")) {
          errorType = "INVALID_PARAMETERS";
          errorMessage = error.message;
        } else if (errorMsg.includes("insufficient margin")) {
          errorType = "INSUFFICIENT_MARGIN";
          errorMessage = "Insufficient margin - reduce lot size or close existing positions";
        } else if (errorMsg.includes("position limit")) {
          errorType = "POSITION_LIMIT";
          errorMessage = "Position limit exceeded - close some existing trades first";
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
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app2.post("/api/close-trade", requireAuth, async (req, res) => {
    try {
      const { tradeId } = closeTradeSchema.parse(req.body);
      const trade = await mongoService.getTradeByOandaId(tradeId);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      const result = await oandaService.closeTrade(tradeId);
      const updateData = {
        status: "closed",
        dateClosed: /* @__PURE__ */ new Date(),
        profitLoss: result.realizedPL,
        isProfit: result.realizedPL > 0,
        isLoss: result.realizedPL < 0
      };
      console.log(`\u{1F504} Updating trade ${tradeId} with:`, updateData);
      await mongoService.updateTrade(tradeId, updateData);
      console.log(`\u2705 Trade ${tradeId} successfully closed at ${updateData.dateClosed}`);
      res.json({ success: true, profitLoss: result.realizedPL });
    } catch (error) {
      console.error("Trade close error:", error);
      res.status(500).json({ message: "Failed to close trade", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  app2.get("/api/open-trades", requireAuth, async (req, res) => {
    try {
      const mongoTrades = await mongoService.getOpenTrades();
      const oandaTrades = await oandaService.getOpenTrades();
      const enrichedTrades = mongoTrades.map((trade) => {
        const oandaTrade = oandaTrades.find((ot) => ot.id === trade.oandaTradeId);
        return {
          ...trade,
          currentPrice: oandaTrade ? parseFloat(oandaTrade.price) : null,
          unrealizedPL: oandaTrade ? parseFloat(oandaTrade.unrealizedPL) : null
        };
      });
      res.json(enrichedTrades);
    } catch (error) {
      console.error("Open trades fetch error:", error);
      res.status(500).json({ message: "Failed to fetch open trades" });
    }
  });
  app2.get("/api/recent-trades", requireAuth, async (req, res) => {
    try {
      const trades = await mongoService.getRecentTrades(10);
      console.log(`\u{1F4CA} Recent trades query returned ${trades.length} trades`);
      if (trades.length > 0) {
        console.log("\u{1F4C5} Most recent trade closed at:", trades[0].dateClosed);
      }
      res.json(trades);
    } catch (error) {
      console.error("Recent trades fetch error:", error);
      res.status(500).json({ message: "Failed to fetch recent trades" });
    }
  });
  app2.get("/api/trade-statistics/:days", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.params.days);
      const stats = await mongoService.getTradeStatistics(days);
      res.json(stats);
    } catch (error) {
      console.error("Statistics fetch error:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });
  app2.get("/api/profit-loss-summary", requireAuth, async (req, res) => {
    try {
      const summary = await mongoService.getTotalProfitLoss();
      res.json(summary);
    } catch (error) {
      console.error("P/L summary fetch error:", error);
      res.status(500).json({ message: "Failed to fetch P/L summary" });
    }
  });
  app2.get("/api/chart/:instrument/:timeframe", requireAuth, async (req, res) => {
    try {
      const { instrument, timeframe } = req.params;
      let granularity = "M15";
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
      const chartData = await oandaService.getCandleData(instrument, granularity, 2e3);
      res.json(chartData);
    } catch (error) {
      console.error("Chart data fetch error:", error);
      res.status(500).json({ message: "Failed to fetch chart data" });
    }
  });
  app2.post("/api/cleanup-trades", requireAuth, async (req, res) => {
    try {
      const mongoTrades = await mongoService.getOpenTrades();
      const oandaTrades = await oandaService.getOpenTrades();
      const oandaTradeIds = new Set(oandaTrades.map((trade) => trade.id));
      const orphanedTrades = mongoTrades.filter((trade) => !oandaTradeIds.has(trade.oandaTradeId));
      const mongoTradeIds = new Set(mongoTrades.map((trade) => trade.oandaTradeId));
      const missingSyncTrades = oandaTrades.filter((trade) => !mongoTradeIds.has(trade.id));
      let message = "";
      let deletedCount = 0;
      let syncedCount = 0;
      if (orphanedTrades.length > 0) {
        const orphanedIds = orphanedTrades.map((trade) => trade.oandaTradeId);
        deletedCount = await mongoService.deleteTradesByOandaIds(orphanedIds);
        console.log(`\u{1F9F9} Cleaned up ${deletedCount} orphaned trades:`, orphanedIds);
      }
      if (missingSyncTrades.length > 0) {
        for (const oandaTrade of missingSyncTrades) {
          try {
            const tradeData = {
              instrument: oandaTrade.instrument.replace("_", ""),
              direction: parseFloat(oandaTrade.currentUnits) > 0 ? "buy" : "sell",
              entryPrice: parseFloat(oandaTrade.price),
              lotSize: Math.abs(parseFloat(oandaTrade.currentUnits)) / 1e5,
              // Convert to standard lot size
              tp1: parseFloat(oandaTrade.price) * 1.01,
              // Default TP1
              tp2: parseFloat(oandaTrade.price) * 1.02,
              // Default TP2  
              sl: parseFloat(oandaTrade.price) * 0.99,
              // Default SL
              dateOpened: oandaTrade.openTime,
              oandaTradeId: oandaTrade.id,
              status: "open"
            };
            await mongoService.saveTrade(tradeData);
            syncedCount++;
          } catch (error) {
            console.error(`Failed to sync trade ${oandaTrade.id}:`, error);
          }
        }
        console.log(`\u{1F504} Synced ${syncedCount} existing OANDA trades to MongoDB`);
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
        syncedTrades: missingSyncTrades.map((t) => t.id)
      });
    } catch (error) {
      console.error("Error cleaning up trades:", error);
      res.status(500).json({
        message: "Failed to cleanup trades",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  startTradeManagement();
  const httpServer = createServer(app2);
  return httpServer;
}
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
  }, 5e3);
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
      if (!trade.tp1Hit && (isBuy && currentPrice >= trade.tp1 || !isBuy && currentPrice <= trade.tp1)) {
        console.log(`TP1 hit for trade ${trade.oandaTradeId}`);
        const partialUnits = Math.floor(parseFloat(oandaTrade.currentUnits) * 0.75).toString();
        await oandaService.closeTrade(trade.oandaTradeId, partialUnits);
        await oandaService.updateStopLoss(trade.oandaTradeId, trade.entryPrice);
        await mongoService.updateTrade(trade.oandaTradeId, {
          tp1Hit: true,
          partialClosed: true,
          status: "partial",
          sl: trade.entryPrice
          // Update SL to breakeven
        });
      } else if (trade.tp1Hit && !trade.tp2Hit && (isBuy && currentPrice >= trade.tp2 || !isBuy && currentPrice <= trade.tp2)) {
        console.log(`TP2 hit for trade ${trade.oandaTradeId}`);
        const result = await oandaService.closeTrade(trade.oandaTradeId);
        await mongoService.updateTrade(trade.oandaTradeId, {
          tp2Hit: true,
          status: "closed",
          dateClosed: /* @__PURE__ */ new Date(),
          profitLoss: result.realizedPL,
          isProfit: result.realizedPL > 0,
          isLoss: result.realizedPL < 0
        });
      } else if (!trade.slHit && (isBuy && currentPrice <= trade.sl || !isBuy && currentPrice >= trade.sl)) {
        console.log(`SL hit for trade ${trade.oandaTradeId}`);
        const result = await oandaService.closeTrade(trade.oandaTradeId);
        await mongoService.updateTrade(trade.oandaTradeId, {
          slHit: true,
          status: "closed",
          dateClosed: /* @__PURE__ */ new Date(),
          profitLoss: result.realizedPL,
          isProfit: result.realizedPL > 0,
          isLoss: result.realizedPL < 0
        });
      }
    } catch (error) {
      console.error(`Error managing trade ${trade.oandaTradeId}:`, error);
    }
  }
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
if (!process.env.OANDA_API_KEY || !process.env.OANDA_ACCOUNT_ID || !process.env.MONGO_URI) {
  console.error("\u274C Missing environment variables. Please check your .env file.");
  console.error("Required: OANDA_API_KEY, OANDA_ACCOUNT_ID, MONGO_URI");
  process.exit(1);
}
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`\u{1F680} Trading server running on port ${port}`);
    log(`\u{1F517} OANDA Practice API connected`);
    log(`\u{1F4CA} MongoDB tracking enabled`);
  });
})();
