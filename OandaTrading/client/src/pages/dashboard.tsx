import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import TradeSetup from '@/components/TradeSetup';
import AccountOverview from '@/components/AccountOverview';
import PerformanceAnalysis from '@/components/PerformanceAnalysis';
import ActiveTrades from '@/components/ActiveTrades';
import RecentTrades from '@/components/RecentTrades';
import TradingChart from '@/components/TradingChart';
import { useTradingData } from '@/hooks/useTradingData';

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedInstrument, setSelectedInstrument] = useState('XAUUSD');
  const { toast } = useToast();
  const { currentPrice, isLoading } = useTradingData(selectedInstrument);

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/logout');
      setLocation('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-neon-cyan/30 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-neon-cyan neon-glow">
                OANDA TRADING
              </h1>
              <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
                <SelectTrigger className="w-32 bg-card border-neon-cyan/50 text-neon-cyan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-neon-cyan/50">
                  <SelectItem value="XAUUSD">XAU/USD</SelectItem>
                  <SelectItem value="EURUSD">EUR/USD</SelectItem>
                  <SelectItem value="GBPUSD">GBP/USD</SelectItem>
                  <SelectItem value="USDJPY">USD/JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 flex justify-center items-center">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">
                  CURRENT MARKET PRICE
                </div>
                <div className="text-4xl md:text-6xl font-bold text-neon-cyan neon-glow pulse-glow">
                  {isLoading ? 'Loading...' : 
                   selectedInstrument === 'XAUUSD' ? `$${(currentPrice as any)?.ask?.toFixed(2) || '0.00'}` :
                   (currentPrice as any)?.ask?.toFixed(4) || '0.0000'}
                </div>
              </div>
            </div>

            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10"
            >
              LOGOUT
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Full Width Chart */}
        <div className="mb-8">
          <TradingChart 
            selectedInstrument={selectedInstrument}
            onInstrumentChange={setSelectedInstrument}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            <TradeSetup
              selectedInstrument={selectedInstrument}
              currentPrice={(currentPrice as any)?.ask || 0}
            />
            <AccountOverview />
            <PerformanceAnalysis />
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            <ActiveTrades />
            <RecentTrades />
          </div>
        </div>
      </div>
    </div>
  );
}
