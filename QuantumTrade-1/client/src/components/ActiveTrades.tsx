import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export default function ActiveTrades() {
  const { toast } = useToast();

  const { data: activeTrades, isLoading } = useQuery({
    queryKey: ['/api/open-trades'],
    refetchInterval: 5000,
  });

  const handleCloseTrade = async (tradeId: string) => {
    try {
      const response = await apiRequest('POST', '/api/close-trade', { tradeId });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Trade Closed",
          description: `P/L: ${data.profitLoss >= 0 ? '+' : ''}$${data.profitLoss.toFixed(2)}`,
        });
        
        // Refresh trades
        queryClient.invalidateQueries({ queryKey: ['/api/open-trades'] });
        queryClient.invalidateQueries({ queryKey: ['/api/recent-trades'] });
        queryClient.invalidateQueries({ queryKey: ['/api/account-balance'] });
      }
    } catch (error) {
      toast({
        title: "Close Failed",
        description: "Failed to close trade. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCleanupTrades = async () => {
    try {
      const response = await apiRequest('POST', '/api/cleanup-trades', {});
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Cleanup Complete",
          description: data.message,
        });
        
        // Refresh trades
        queryClient.invalidateQueries({ queryKey: ['/api/open-trades'] });
        queryClient.invalidateQueries({ queryKey: ['/api/recent-trades'] });
      }
    } catch (error) {
      toast({
        title: "Cleanup Failed",
        description: "Failed to cleanup trades. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="card-cyberpunk">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-neon-cyan neon-glow">
            ACTIVE TRADES
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-cyberpunk">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold text-neon-cyan neon-glow">
          ACTIVE TRADES
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCleanupTrades}
          className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clean
        </Button>
      </CardHeader>
      <CardContent>
        {!activeTrades || activeTrades.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No active trades
          </div>
        ) : (
          <div className="space-y-4">
            {activeTrades.map((trade: any) => (
              <div
                key={trade.oandaTradeId}
                className={`bg-background border rounded-lg p-4 ${
                  trade.direction === 'buy' 
                    ? 'border-neon-blue/50' 
                    : 'border-neon-purple/50'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`font-bold ${
                      trade.direction === 'buy' ? 'text-neon-blue' : 'text-neon-purple'
                    } neon-glow`}>
                      {trade.instrument.replace('USD', '/USD')}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`${
                        trade.direction === 'buy' 
                          ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/50' 
                          : 'bg-neon-purple/20 text-neon-purple border-neon-purple/50'
                      }`}
                    >
                      {trade.direction.toUpperCase()}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCloseTrade(trade.oandaTradeId)}
                    className="text-neon-purple hover:text-neon-purple/80 border border-neon-purple/50 px-3 py-1 rounded-lg hover:bg-neon-purple/10 transition-colors bg-transparent"
                  >
                    CLOSE
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Entry:</span>
                    <span className="text-foreground ml-1">
                      {trade.instrument === 'XAUUSD' 
                        ? `$${trade.entryPrice.toFixed(2)}`
                        : trade.entryPrice.toFixed(4)
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current:</span>
                    <span className="text-neon-cyan ml-1">
                      {trade.currentPrice 
                        ? trade.instrument === 'XAUUSD' 
                          ? `$${trade.currentPrice.toFixed(2)}`
                          : trade.currentPrice.toFixed(4)
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lot Size:</span>
                    <span className="text-foreground ml-1">{trade.lotSize}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">P/L:</span>
                    <span className={`ml-1 font-bold ${
                      trade.unrealizedPL >= 0 ? 'text-neon-blue' : 'text-neon-purple'
                    } neon-glow`}>
                      {trade.unrealizedPL 
                        ? `${trade.unrealizedPL >= 0 ? '+' : ''}$${trade.unrealizedPL.toFixed(2)}`
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">TP1:</span>
                    <span className="text-foreground ml-1">
                      {trade.instrument === 'XAUUSD' 
                        ? `$${trade.tp1.toFixed(2)}`
                        : trade.tp1.toFixed(4)
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SL:</span>
                    <span className="text-foreground ml-1">
                      {trade.instrument === 'XAUUSD' 
                        ? `$${trade.sl.toFixed(2)}`
                        : trade.sl.toFixed(4)
                      }
                    </span>
                  </div>
                </div>
                
                {trade.partialClosed && (
                  <div className="mt-2 text-xs text-neon-blue border border-neon-blue/30 rounded px-2 py-1 inline-block">
                    75% CLOSED - TP1 HIT
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
