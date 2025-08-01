import fetch from 'node-fetch';

export class OandaService {
  private apiKey: string;
  private accountId: string;
  private baseUrl = 'https://api-fxpractice.oanda.com/v3';

  constructor() {
    this.apiKey = process.env.OANDA_API_KEY || '';
    this.accountId = process.env.OANDA_ACCOUNT_ID || '';

    if (!this.apiKey || !this.accountId) {
      throw new Error('Missing OANDA credentials. Please check your .env file.');
    }
  }

  isMarketOpen(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Convert current time to minutes for easier comparison
    const currentTimeMinutes = utcHour * 60 + utcMinutes;
    
    // Market closure: 22:00-23:10 everyday (1320-1390 minutes)
    const dailyCloseStart = 21 * 60; // 22:00 = 1320 minutes
    const dailyCloseEnd = 22 * 60 + 10; // 23:10 = 1390 minutes
    
    // Check daily closure (22:00-23:10)
    if (currentTimeMinutes >= dailyCloseStart && currentTimeMinutes <= dailyCloseEnd) {
      return false;
    }
    
    // Weekend closure: Friday 22:00 to Sunday 23:10
    if (dayOfWeek === 5) { // Friday
      if (currentTimeMinutes >= dailyCloseStart) { // After 22:00 Friday
        return false;
      }
    } else if (dayOfWeek === 6) { // Saturday - completely closed
      return false;
    } else if (dayOfWeek === 0) { // Sunday
      if (currentTimeMinutes <= dailyCloseEnd) { // Before 23:10 Sunday
        return false;
      }
    }
    
    return true;
  }

  getMarketStatus(): { isOpen: boolean; message?: string; reopensAt?: string } {
    if (this.isMarketOpen()) {
      return { isOpen: true };
    }

    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay();
    const currentTimeMinutes = utcHour * 60 + utcMinutes;
    
    // Daily closure
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
    
    // Weekend closure
    if (dayOfWeek === 5 && currentTimeMinutes >= dailyCloseStart) {
      const reopenTime = new Date(now);
      reopenTime.setUTCDate(reopenTime.getUTCDate() + 2); // Go to Sunday
      reopenTime.setUTCHours(23, 10, 0, 0);
      
      return {
        isOpen: false,
        message: "Market is closed for weekend (Friday 22:00 - Sunday 23:10 UTC)",
        reopensAt: reopenTime.toISOString()
      };
    }
    
    if (dayOfWeek === 6) {
      const reopenTime = new Date(now);
      reopenTime.setUTCDate(reopenTime.getUTCDate() + 1); // Go to Sunday
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

  private formatInstrument(symbol: string): string {
    // Convert XAUUSD -> XAU_USD format
    if (symbol.length >= 6) {
      return symbol.slice(0, 3) + '_' + symbol.slice(3);
    }
    return symbol;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async getCurrentPrice(instrument: string): Promise<{ bid: number; ask: number }> {
    const formattedInstrument = this.formatInstrument(instrument);
    const url = `${this.baseUrl}/accounts/${this.accountId}/pricing?instruments=${formattedInstrument}`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get pricing: ${response.statusText}`);
    }

    const data: any = await response.json();
    const price = data.prices[0];
    
    return {
      bid: parseFloat(price.bids[0].price),
      ask: parseFloat(price.asks[0].price),
    };
  }

  async getAccountBalance(): Promise<{ balance: number; unrealizedPL: number }> {
    const url = `${this.baseUrl}/accounts/${this.accountId}`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get account info: ${response.statusText}`);
    }

    const data: any = await response.json();
    
    return {
      balance: parseFloat(data.account.balance),
      unrealizedPL: parseFloat(data.account.unrealizedPL),
    };
  }

  async getOpenTrades(): Promise<any[]> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/openTrades`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get open trades: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.trades || [];
  }

  validateTradeParameters(params: {
    instrument: string;
    direction: 'buy' | 'sell';
    units: number;
    tp1?: number;
    tp2?: number;
    sl?: number;
    currentPrice?: number;
  }): { isValid: boolean; error?: string } {
    const { direction, tp1, tp2, sl, currentPrice } = params;
    
    if (!currentPrice) {
      return { isValid: false, error: "Unable to get current market price" };
    }
    
    if (tp1 && tp2 && sl) {
      if (direction === 'buy') {
        // For buy orders: TP should be above current price, SL should be below
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
        // For sell orders: TP should be below current price, SL should be above
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

  async placeTrade(params: {
    instrument: string;
    direction: 'buy' | 'sell';
    units: number;
    tp1?: number;
    tp2?: number;
    sl?: number;
    currentPrice?: number;
  }): Promise<{ tradeId: string; price: number }> {
    // Check market hours first
    const marketStatus = this.getMarketStatus();
    if (!marketStatus.isOpen) {
      throw new Error(`${marketStatus.message}${marketStatus.reopensAt ? ` - Market reopens at ${new Date(marketStatus.reopensAt).toLocaleString()}` : ''}`);
    }
    
    // Validate trade parameters
    const validation = this.validateTradeParameters(params);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    const formattedInstrument = this.formatInstrument(params.instrument);
    const units = params.direction === 'buy' ? params.units : -params.units;
    
    const url = `${this.baseUrl}/accounts/${this.accountId}/orders`;
    
    const orderData = {
      order: {
        type: 'MARKET',
        instrument: formattedInstrument,
        units: units.toString(),
        timeInForce: 'FOK',
        positionFill: 'DEFAULT',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OANDA order placement error:', errorText);
      throw new Error(`Failed to place trade: ${response.statusText} - ${errorText}`);
    }

    const data: any = await response.json();
    console.log('OANDA order response:', JSON.stringify(data, null, 2));
    
    // Check for different transaction types
    if (data.orderFillTransaction) {
      return {
        tradeId: data.orderFillTransaction.tradeOpened?.tradeID || data.orderFillTransaction.id,
        price: parseFloat(data.orderFillTransaction.price),
      };
    }
    
    // Check for order create transaction (pending order)
    if (data.orderCreateTransaction) {
      throw new Error(`Order created but not filled. Reason: ${data.orderRejectTransaction?.rejectReason || 'Market closed or insufficient liquidity'}`);
    }
    
    // Check for order reject transaction
    if (data.orderRejectTransaction) {
      const reason = data.orderRejectTransaction.rejectReason;
      if (reason === 'INSUFFICIENT_MARGIN') {
        throw new Error('Insufficient margin - try reducing lot size or close existing positions');
      } else if (reason === 'POSITION_LIMIT_EXCEEDED') {
        throw new Error('Position limit exceeded - close some existing trades first');
      } else if (reason === 'MARKET_HALTED') {
        throw new Error('Market is currently halted - try again later');
      } else {
        throw new Error(`Order rejected: ${reason}`);
      }
    }
    
    throw new Error('Trade placement failed - no fill transaction');
  }

  async closeTrade(tradeId: string, units?: string): Promise<{ realizedPL: number }> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/trades/${tradeId}/close`;
    
    const closeData = units ? { units } : {};

    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(closeData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to close trade: ${response.statusText} - ${errorText}`);
    }

    const data: any = await response.json();
    
    return {
      realizedPL: parseFloat(data.orderFillTransaction?.pl || '0'),
    };
  }

  async updateStopLoss(tradeId: string, stopLossPrice: number): Promise<void> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/trades/${tradeId}/orders`;
    
    const orderData = {
      order: {
        type: 'STOP_LOSS',
        price: stopLossPrice.toString(),
        timeInForce: 'GTC',
        tradeID: tradeId,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error(`Failed to update stop loss: ${response.statusText}`);
    }
  }

  convertUnitsForInstrument(instrument: string, lotSize: number): number {
    // XAUUSD: 1 lot = 100 units
    // Other currencies: 1 lot = 100,000 units
    if (instrument === 'XAUUSD') {
      return lotSize * 100;
    }
    return lotSize * 100000;
  }

  async getCandleData(instrument: string, granularity: string, count: number = 200): Promise<any[]> {
    const formattedInstrument = this.formatInstrument(instrument);
    const url = `${this.baseUrl}/instruments/${formattedInstrument}/candles?granularity=${granularity}&count=${count}`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get candle data: ${response.statusText}`);
    }

    const data: any = await response.json();
    
    return data.candles.map((candle: any) => ({
      time: Math.floor(new Date(candle.time).getTime() / 1000), // Convert to Unix timestamp
      open: parseFloat(candle.mid.o),
      high: parseFloat(candle.mid.h),
      low: parseFloat(candle.mid.l),
      close: parseFloat(candle.mid.c),
      volume: candle.volume || 0,
    }));
  }
}
