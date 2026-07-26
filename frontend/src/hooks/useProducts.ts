import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProducts, getProduct, getProductObjectModel, createProduct, updateProduct, deleteProduct } from '../api/products'
import { useToast } from '../components/ui/Toast'
import type { ProductListParams } from '../api/products'

export function useProductList(params?: ProductListParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => getProducts(params),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    enabled: !!id,
  })
}

export function useProductObjectModel(id: string) {
  return useQuery({
    queryKey: ['product-object-model', id],
    queryFn: () => getProductObjectModel(id),
    enabled: !!id,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.addToast('success', '商品创建成功')
    },
    onError: () => toast.addToast('error', '创建商品失败'),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateProduct(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.addToast('success', '商品更新成功')
    },
    onError: () => toast.addToast('error', '更新商品失败'),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.addToast('success', '商品已删除')
    },
    onError: () => toast.addToast('error', '删除商品失败'),
  })
}
