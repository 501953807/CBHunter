import { useQuery } from '@tanstack/react-query'
import { getDashboardKPIs, getSalesTrend, getPlatformComparison, getProductPerformance } from '../api/analytics'

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: getDashboardKPIs,
  })
}

export function useSalesTrend(period = '7d') {
  return useQuery({
    queryKey: ['sales-trend', period],
    queryFn: () => getSalesTrend(period),
  })
}

export function usePlatformComparison() {
  return useQuery({
    queryKey: ['platform-comparison'],
    queryFn: getPlatformComparison,
  })
}

export function useProductPerformance() {
  return useQuery({
    queryKey: ['product-performance'],
    queryFn: getProductPerformance,
  })
}
