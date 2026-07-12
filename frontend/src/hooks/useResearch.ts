import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { searchKeywords, saveResearch, deleteResearch, getSavedResearch, getTrendingProducts, syncTrendingProducts, addTrendingProduct, deleteTrendingProduct, getCompetitors, addCompetitor, deleteCompetitor } from '../api/research'
import { addToSourcing } from '../api/sourcing'
import { useToast } from '../components/ui/Toast'

export function useKeywordSearch(q: string, platform: string) {
  return useQuery({
    queryKey: ['keyword-search', q, platform],
    queryFn: () => searchKeywords(q, platform),
    enabled: q.length > 0 && platform.length > 0 })
}

export function useSavedResearch() {
  return useQuery({
    queryKey: ['saved-research'],
    queryFn: getSavedResearch })
}

export function useSaveResearch() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ keyword, platform }: { keyword: string; platform: string }) => saveResearch(keyword, platform),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-research'] })
      toast.addToast('success', '已保存到研究列表')
    },
    onError: () => toast.addToast('error', '保存失败（可能已存在）') })
}

export function useDeleteResearch() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => deleteResearch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-research'] })
      toast.addToast('success', '已删除')
    }})
}

export function useTrendingProducts(platform?: string, category?: string) {
  return useQuery({
    queryKey: ['trending-products', platform, category],
    queryFn: () => getTrendingProducts(platform),
  })
}

export function useSyncTrendingProducts() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: syncTrendingProducts,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['trending-products'] })
      toast.addToast('success', `同步完成: ${data?.data?.total ?? 0} 个商品`)
    },
    onError: () => toast.addToast('error', '同步失败'),
  })
}

export function useAddTrendingProduct() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: addTrendingProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trending-products'] })
      toast.addToast('success', '已添加')
    },
    onError: () => toast.addToast('error', '添加失败'),
  })
}

export function useDeleteTrendingProduct() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: deleteTrendingProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trending-products'] })
      toast.addToast('success', '已删除')
    },
  })
}

export function useAddToSourcing() {
  const toast = useToast()
  return useMutation({
    mutationFn: addToSourcing,
    onSuccess: () => toast.addToast('success', '已添加到选品库'),
    onError: () => toast.addToast('error', '添加失败'),
  })
}

export function useCompetitors(productId?: string) {
  return useQuery({
    queryKey: ['competitors', productId],
    queryFn: () => getCompetitors(),
    enabled: !!productId,
  })
}

export function useAddCompetitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addCompetitor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitors'] }),
  })
}

export function useDeleteCompetitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCompetitor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitors'] }),
  })
}
