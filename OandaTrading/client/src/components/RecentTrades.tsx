import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function RecentTrades() {
  const { data: recentTrades, isLoading } = useQuery({
    queryKey: ['/api/recent-trades'],
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale
  });

  if (isLoading) {
    return (
      <Card className="card-cyberpunk">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-neon-cyan neon-glow">
            RECENT TRADES
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
      <CardHeader>
        <CardTitle className="text-xl font-bold text-neon-cyan neon-glow">
          RECENT TRADES
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!recentTrades || recentTrades.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No recent trades
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neon-cyan/30">
                  <th className="text-left text-neon-cyan py-3 px-2 font-bold neon-glow">
                    DATE
                  </th>
                  <th className="text-left text-neon-cyan py-3 px-2 font-bold neon-glow">
                    PAIR
                  </th>
                  <th className="text-left text-neon-cyan py-3 px-2 font-bold neon-glow">
                    TYPE
                  </th>
                  <th className="text-right text-neon-cyan py-3 px-2 font-bold neon-glow">
                    ENTRY
                  </th>
                  <th className="text-right text-neon-cyan py-3 px-2 font-bold neon-glow">
                    P/L
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...recentTrades]
                  .filter((trade: any) => !!trade.dateClosed) // only closed trades
                  .sort((a, b) => {
                    const aTime = new Date(a.dateClosed).getTime();
                    const bTime = new Date(b.dateClosed).getTime();
                    return bTime - aTime; // newest first
                  })
                  .map((trade: any) => (
                    <tr
                      key={trade._id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-2 text-muted-foreground">
                        {new Date(trade.dateClosed).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false, // 24-hour format
                        })}
                      </td>
                      <td className="py-3 px-2 text-foreground">
                        {trade.instrument.replace('USD', '/USD')}
                      </td>
                      <td className="py-3 px-2">
                        <Badge
                          variant="outline"
                          className={`${
                            trade.direction === 'buy'
                              ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/50'
                              : 'bg-neon-purple/20 text-neon-purple border-neon-purple/50'
                          } text-xs`}
                        >
                          {trade.direction.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {trade.instrument === 'XAUUSD'
                          ? `$${trade.entryPrice.toFixed(2)}`
                          : trade.entryPrice.toFixed(4)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`font-bold ${
                            trade.profitLoss >= 0 ? 'text-neon-blue' : 'text-neon-purple'
                          } neon-glow`}
                        >
                          {trade.profitLoss
                            ? `${trade.profitLoss >= 0 ? '+' : ''}$${trade.profitLoss.toFixed(2)}`
                            : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}