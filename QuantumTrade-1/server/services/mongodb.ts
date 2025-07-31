import mongoose from 'mongoose';
import { Trade, InsertTrade } from '../../shared/schema';

const TradeSchema = new mongoose.Schema({
  instrument: { type: String, required: true },
  direction: { type: String, enum: ['buy', 'sell'], required: true },
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
  status: { type: String, enum: ['open', 'partial', 'closed'], default: 'open' },
}, { timestamps: true });

const TradeModel = mongoose.model('Trade', TradeSchema);

export class MongoDBService {
  private connected = false;

  constructor() {
    this.connect();
  }

  private async connect() {
    if (this.connected) return;

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('Missing MONGO_URI. Please check your .env file.');
    }

    try {
      await mongoose.connect(mongoUri, {
        ssl: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      this.connected = true;
      console.log('✅ MongoDB connected');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      // Retry connection after 5 seconds
      setTimeout(() => this.connect(), 5000);
    }
  }

  async saveTrade(trade: InsertTrade): Promise<Trade> {
    await this.connect();
    const newTrade = new TradeModel(trade);
    const saved = await newTrade.save();
    return saved.toObject() as Trade;
  }

  async updateTrade(oandaTradeId: string, updates: Partial<Trade>): Promise<Trade | null> {
    await this.connect();
    const updated = await TradeModel.findOneAndUpdate(
      { oandaTradeId },
      updates,
      { new: true }
    );
    return updated ? updated.toObject() as Trade : null;
  }

  async getTradeByOandaId(oandaTradeId: string): Promise<Trade | null> {
    await this.connect();
    const trade = await TradeModel.findOne({ oandaTradeId });
    return trade ? trade.toObject() as Trade : null;
  }

  async getOpenTrades(): Promise<Trade[]> {
    await this.connect();
    const trades = await TradeModel.find({ status: { $in: ['open', 'partial'] } });
    return trades.map(trade => trade.toObject() as Trade);
  }

  async deleteTradeByOandaId(oandaTradeId: string): Promise<boolean> {
    await this.connect();
    const result = await TradeModel.deleteOne({ oandaTradeId });
    return result.deletedCount > 0;
  }

  async deleteTradesByOandaIds(oandaTradeIds: string[]): Promise<number> {
    await this.connect();
    const result = await TradeModel.deleteMany({ oandaTradeId: { $in: oandaTradeIds } });
    return result.deletedCount || 0;
  }

  async getRecentTrades(limit: number = 10): Promise<Trade[]> {
    await this.connect();
    const trades = await TradeModel.find({ 
      status: 'closed',
      dateClosed: { $exists: true, $ne: null }
    })
      .sort({ dateClosed: -1, createdAt: -1 })
      .limit(limit);
    return trades.map(trade => trade.toObject() as Trade);
  }

  async getTradeStatistics(days: number): Promise<{ wins: number; losses: number; totalTrades: number }> {
    await this.connect();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trades = await TradeModel.find({
      status: 'closed',
      dateClosed: { $gte: startDate.toISOString() }
    });

    const wins = trades.filter(trade => trade.isProfit).length;
    const losses = trades.filter(trade => trade.isLoss).length;

    return {
      wins,
      losses,
      totalTrades: trades.length,
    };
  }

  async getTotalProfitLoss(): Promise<{ totalProfit: number; totalLoss: number }> {
    await this.connect();
    const trades = await TradeModel.find({ status: 'closed' });

    let totalProfit = 0;
    let totalLoss = 0;

    trades.forEach(trade => {
      if (trade.profitLoss && trade.profitLoss > 0) {
        totalProfit += trade.profitLoss;
      } else if (trade.profitLoss && trade.profitLoss < 0) {
        totalLoss += Math.abs(trade.profitLoss);
      }
    });

    return { totalProfit, totalLoss };
  }
}