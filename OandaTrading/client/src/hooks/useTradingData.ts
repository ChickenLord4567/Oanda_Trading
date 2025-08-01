import { useQuery } from '@tanstack/react-query';

export function useTradingData(instrument: string) {
  const { data: currentPrice, isLoading } = useQuery({
    queryKey: [`/api/current-price/${instrument}`],
    refetchInterval: 2000, // Update every 2 seconds
    staleTime: 1000,
  });

  return {
    currentPrice,
    isLoading,
  };
}
