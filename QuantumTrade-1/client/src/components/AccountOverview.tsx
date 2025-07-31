import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccountOverview() {
  const { data: balance } = useQuery({
    queryKey: ['/api/account-balance'],
    refetchInterval: 5000,
  });

  const { data: profitLoss } = useQuery({
    queryKey: ['/api/profit-loss-summary'],
    refetchInterval: 5000,
  });

  const { data: stats7d } = useQuery({
    queryKey: ['/api/trade-statistics/7'],
    refetchInterval: 5000,
  });

  return (
    <Card className="card-cyberpunk">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-neon-cyan neon-glow">
          ACCOUNT OVERVIEW
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">ACCOUNT BALANCE</div>
            <div className="text-3xl font-bold text-neon-cyan neon-glow pulse-glow">
              ${balance?.balance?.toFixed(2) || '0.00'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">TOTAL TRADES</div>
            <div className="text-3xl font-bold text-foreground">
              {stats7d ? stats7d.totalTrades : 0}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">TOTAL PROFIT</div>
            <div className="text-xl font-bold text-neon-blue neon-glow">
              +${profitLoss?.totalProfit?.toFixed(2) || '0.00'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">TOTAL LOSS</div>
            <div className="text-xl font-bold text-neon-purple neon-glow">
              -${profitLoss?.totalLoss?.toFixed(2) || '0.00'}
            </div>
          </div>
        </div>

        {balance?.unrealizedPL && (
          <div className="text-center mt-4">
            <div className="text-sm text-muted-foreground mb-2">UNREALIZED P/L</div>
            <div className={`text-xl font-bold ${balance.unrealizedPL >= 0 ? 'text-neon-blue' : 'text-neon-purple'} neon-glow`}>
              {balance.unrealizedPL >= 0 ? '+' : ''}${balance.unrealizedPL.toFixed(2)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
