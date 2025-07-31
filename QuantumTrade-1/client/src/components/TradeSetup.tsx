import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowUp, ArrowDown, Clock, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TradeSetupProps {
  selectedInstrument: string;
  currentPrice: number;
}

export default function TradeSetup({ selectedInstrument, currentPrice }: TradeSetupProps) {
  const [lotSize, setLotSize] = useState<number | ''>('');
  const [tp1, setTp1] = useState(0);
  const [tp2, setTp2] = useState(0);
  const [sl, setSl] = useState(0);
  const [isPlacing, setIsPlacing] = useState(false);
  const { toast } = useToast();

  // Get market status
  const { data: marketStatus } = useQuery({
    queryKey: ['/api/market-status'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  const handlePlaceTrade = async (direction: 'buy' | 'sell') => {
    if (!lotSize || lotSize <= 0 || tp1 <= 0 || tp2 <= 0 || sl <= 0) {
      toast({
        title: "Invalid Parameters",
        description: "Please set valid Lot Size, TP1, TP2, and SL values",
        variant: "destructive",
      });
      return;
    }

    // Check market status before placing trade
    if (marketStatus && !marketStatus.isOpen) {
      toast({
        title: "Market Closed",
        description: marketStatus.message || "Market is currently closed",
        variant: "destructive",
      });
      return;
    }

    setIsPlacing(true);

    try {
      const response = await apiRequest('POST', '/api/place-trade', {
        instrument: selectedInstrument,
        direction,
        lotSize: Number(lotSize),
        tp1,
        tp2,
        sl,
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Trade Placed Successfully",
          description: `${direction.toUpperCase()} order executed at ${currentPrice}`,
        });
        
        // Reset form
        setLotSize('');
        setTp1(0);
        setTp2(0);
        setSl(0);
      } else {
        throw new Error(data.message || 'Trade placement failed');
      }
    } catch (error) {
      console.error('Trade error:', error);
      
      let errorTitle = "Trade Failed";
      let errorDescription = "Failed to place trade. Please try again.";
      
      if (error instanceof Error) {
        const errorMsg = error.message;
        
        if (errorMsg.includes('market is closed') || errorMsg.includes('Market is closed')) {
          errorTitle = "Market Closed";
          errorDescription = errorMsg;
        } else if (errorMsg.includes('Take Profit') || errorMsg.includes('Stop Loss')) {
          errorTitle = "Invalid Parameters";
          errorDescription = errorMsg;
        } else if (errorMsg.includes('insufficient margin')) {
          errorTitle = "Insufficient Margin";
          errorDescription = "Reduce lot size or close existing positions";
        } else if (errorMsg.includes('position limit')) {
          errorTitle = "Position Limit Exceeded";
          errorDescription = "Close some existing trades first";
        } else if (errorMsg.includes('market halted')) {
          errorTitle = "Market Halted";
          errorDescription = "Please try again later";
        } else {
          errorDescription = errorMsg;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <Card className="card-cyberpunk">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-neon-cyan neon-glow">
          TRADE SETUP
        </CardTitle>
        {marketStatus && (
          <div className={`flex items-center space-x-2 text-sm px-3 py-2 rounded-lg border ${
            marketStatus.isOpen 
              ? 'border-neon-blue/30 bg-neon-blue/5 text-neon-blue' 
              : 'border-neon-purple/30 bg-neon-purple/5 text-neon-purple'
          }`}>
            {marketStatus.isOpen ? (
              <>
                <div className="w-2 h-2 bg-neon-blue rounded-full animate-pulse"></div>
                <span>Market Open</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>{marketStatus.message}</span>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <Label className="text-muted-foreground text-sm">Current Price</Label>
            <Input
              value={selectedInstrument === 'XAUUSD' ? `$${currentPrice.toFixed(2)}` : currentPrice.toFixed(4)}
              readOnly
              className="input-cyberpunk text-neon-cyan font-bold text-center neon-border"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">Lot Size</Label>
            <Input
              type="number"
              step="0.1"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
              className="input-cyberpunk"
              placeholder="1.0"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">TP1</Label>
            <Input
              type="number"
              step="0.01"
              value={tp1 || ''}
              onChange={(e) => setTp1(parseFloat(e.target.value) || 0)}
              className="input-cyberpunk focus:border-neon-blue"
              placeholder="Take Profit 1"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">TP2</Label>
            <Input
              type="number"
              step="0.01"
              value={tp2 || ''}
              onChange={(e) => setTp2(parseFloat(e.target.value) || 0)}
              className="input-cyberpunk focus:border-neon-blue"
              placeholder="Take Profit 2"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-muted-foreground text-sm">Stop Loss</Label>
            <Input
              type="number"
              step="0.01"
              value={sl || ''}
              onChange={(e) => setSl(parseFloat(e.target.value) || 0)}
              className="input-cyberpunk focus:border-neon-purple"
              placeholder="Stop Loss"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => handlePlaceTrade('buy')}
            disabled={isPlacing || (marketStatus && !marketStatus.isOpen)}
            variant="outline"
            className="border-neon-blue/50 text-neon-blue hover:bg-neon-blue/10 flex items-center justify-center space-x-2 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowUp className="w-5 h-5" />
            <span>{isPlacing ? 'PLACING...' : 'BUY'}</span>
          </Button>
          <Button
            onClick={() => handlePlaceTrade('sell')}
            disabled={isPlacing || (marketStatus && !marketStatus.isOpen)}
            variant="outline"
            className="border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10 flex items-center justify-center space-x-2 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDown className="w-5 h-5" />
            <span>{isPlacing ? 'PLACING...' : 'SELL'}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
