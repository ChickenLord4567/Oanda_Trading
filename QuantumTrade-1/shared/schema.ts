import { z } from "zod";

// User schema for authentication
export const users = {
  id: z.string(),
  username: z.string(),
  password: z.string(),
};

export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = {
  id: string;
  username: string;
  password: string;
};

// Trade schema for MongoDB
export const tradeSchema = z.object({
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
  status: z.enum(["open", "partial", "closed"]).default("open"),
});

export const insertTradeSchema = tradeSchema.omit({
  closePrice: true,
  dateClosed: true,
  profitLoss: true,
  isProfit: true,
  isLoss: true,
});

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = z.infer<typeof tradeSchema>;

// API request/response schemas
export const placeTradeSchema = z.object({
  instrument: z.string(),
  direction: z.enum(["buy", "sell"]),
  lotSize: z.number().positive(),
  tp1: z.number(),
  tp2: z.number(),
  sl: z.number(),
});

export const closeTradeSchema = z.object({
  tradeId: z.string(),
});

export type PlaceTradeRequest = z.infer<typeof placeTradeSchema>;
export type CloseTradeRequest = z.infer<typeof closeTradeSchema>;

// OANDA API response types
export type OandaPricing = {
  prices: Array<{
    instrument: string;
    time: string;
    bids: Array<{ price: string; liquidity: number }>;
    asks: Array<{ price: string; liquidity: number }>;
  }>;
};

export type OandaTrade = {
  id: string;
  instrument: string;
  price: string;
  openTime: string;
  state: string;
  initialUnits: string;
  currentUnits: string;
  unrealizedPL: string;
  realizedPL: string;
};

export type OandaAccount = {
  account: {
    id: string;
    balance: string;
    unrealizedPL: string;
    NAV: string;
    marginUsed: string;
    marginAvailable: string;
  };
};

// Chart data types for Phase 2
export type CandleData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
