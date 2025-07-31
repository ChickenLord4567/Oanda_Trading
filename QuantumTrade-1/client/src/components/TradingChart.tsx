import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { CandleData } from '../../shared/schema';

interface TradingChartProps {
  selectedInstrument: string;
  onInstrumentChange: (instrument: string) => void;
}

const timeframes = [
  { value: '1m', label: '1 Min' },
  { value: '5m', label: '5 Min' },
  { value: '15m', label: '15 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hour' },
  { value: '1d', label: '1 Day' },
];

export default function TradingChart({ selectedInstrument, onInstrumentChange }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [previousInstrument, setPreviousInstrument] = useState(selectedInstrument);

  // Fetch chart data
  const { data: chartData, refetch } = useQuery({
    queryKey: [`/api/chart/${selectedInstrument}/${selectedTimeframe}`],
    refetchInterval: 2000, // Update every 5 seconds
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: 'transparent' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: 'rgba(0, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(0, 255, 255, 0.1)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(0, 255, 255, 0.5)',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: 'rgba(0, 255, 255, 0.5)',
          width: 1,
          style: 2,
        },
      },
      timeScale: {
        borderColor: 'rgba(0, 255, 255, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 255, 255, 0.3)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00ffff',
      downColor: '#a855f7',
      borderUpColor: '#00ffff',
      borderDownColor: '#a855f7',
      wickUpColor: '#00ffff',
      wickDownColor: '#a855f7',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (chartData && candleSeriesRef.current && Array.isArray(chartData)) {
      const formattedData: CandlestickData[] = chartData.map((candle: CandleData) => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      candleSeriesRef.current.setData(formattedData);
      
      // Auto-fit when instrument changes (detected by comparing with previous)
      if (selectedInstrument !== previousInstrument) {
        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        }, 100);
        setPreviousInstrument(selectedInstrument);
      }
    }
  }, [chartData, selectedInstrument, previousInstrument]);

  // Handle timeframe change
  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
    refetch();
    // Auto-fit when timeframe changes
    setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }, 100);
  };

  

  return (
    <Card className="card-cyberpunk">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <CardTitle className="text-xl font-bold text-neon-cyan neon-glow">
            LIVE CHART - {selectedInstrument.replace('USD', '/USD')}
          </CardTitle>
          
          <div className="flex items-center space-x-4">
            <Select value={selectedInstrument} onValueChange={onInstrumentChange}>
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

            <Select value={selectedTimeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger className="w-24 bg-card border-neon-blue/50 text-neon-blue">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-neon-blue/50">
                {timeframes.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={chartContainerRef}
          className="w-full border border-neon-cyan/30 rounded-lg overflow-hidden"
          style={{ height: '500px' }}
        />
        <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
          <span>TradingView-style Chart with Live Data</span>
          <span>Updates every 5 seconds</span>
        </div>
      </CardContent>
    </Card>
  );
}