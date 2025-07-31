import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PeriodStatsProps {
  title: string;
  days: number;
}

function PeriodStats({ title, days }: PeriodStatsProps) {
  const { data: stats } = useQuery({
    queryKey: [`/api/trade-statistics/${days}`],
    refetchInterval: 10000,
  });

  const winPercentage = stats?.totalTrades > 0 ? (stats.wins / stats.totalTrades) * 100 : 0;
  const lossPercentage = 100 - winPercentage;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <span className="text-sm text-foreground">{stats?.totalTrades || 0} trades</span>
      </div>
      <div className="relative h-4 bg-background rounded-full overflow-hidden border border-white/20">
        <div 
          className="absolute left-0 top-0 h-full bg-neon-blue rounded-full neon-box-shadow"
          style={{ width: `${winPercentage}%` }}
        />
        <div 
          className="absolute right-0 top-0 h-full bg-neon-purple rounded-full neon-box-shadow"
          style={{ width: `${lossPercentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-neon-blue neon-glow">
          {stats?.wins || 0} wins ({winPercentage.toFixed(0)}%)
        </span>
        <span className="text-neon-purple neon-glow">
          {stats?.losses || 0} losses ({lossPercentage.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}

export default function PerformanceAnalysis() {
  return (
    <Card className="card-cyberpunk">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-neon-cyan neon-glow">
          PERFORMANCE ANALYSIS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PeriodStats title="Last 7 Days" days={7} />
        <PeriodStats title="Last 30 Days" days={30} />
        <PeriodStats title="Last 90 Days" days={90} />
      </CardContent>
    </Card>
  );
}
