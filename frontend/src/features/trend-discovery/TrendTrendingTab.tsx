import { useEffect, useState } from "react"
import { captureTrendingProduct, deleteCapturedTrendingProduct, listCapturedTrendingProducts } from "../../api/scout"
import { useAddTrendingProduct, useSyncTrendingProducts } from "../../hooks/useResearch"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { useToast } from "../../components/ui/Toast"
import { logger } from "../../utils/logger"
import {
  PaginationBar,
  PillFilter,
  TrendingProductsGrid,
  TrendingToolbar,
} from "./TrendTrendingPanels"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import type { ApiResponse } from "../../types/common"

const PAGE_SIZE = 11
const EMPTY_ADD_FORM = { price_min: '', price_max: '', sales_volume: '', sales_growth_rate: '', category_path: '' }

export function TrendingTab({ platformOptions, marketOptions, categoryOptions }: { platformOptions: any[]; marketOptions: any[]; categoryOptions: any[] }) {
  const [selPlatform, setSelPlatform] = useState('')
  const [selMarket, setSelMarket] = useState('')
  const [page, setPage] = useState(1)
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [evidence, setEvidence] = useState<ApiResponse | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const toast = useToast()
  const confirmAction = useConfirm()
  const syncMutation = useSyncTrendingProducts()
  const addMutation = useAddTrendingProduct()

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const res = await listCapturedTrendingProducts({ platform: selPlatform || undefined, page_size: 200 })
      setProducts(res.data?.items || [])
      setEvidence(res)
    } catch (e: any) {
      logger.error('Load captured trending products failed', e)
      setProducts([])
    }
    setIsLoading(false)
  }

  useEffect(() => { loadProducts() }, [selPlatform])
  useEffect(() => { setPage(1) }, [selPlatform, selMarket])

  const filteredProducts = products.filter(product => {
    if (!selMarket) return true
    const tags = product.tags || []
    return tags.includes(selMarket) || tags.length === 0
  })
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleAddProduct = async () => {
    if (!addName.trim() || !selPlatform || !selMarket) {
      toast.addToast('error', '请先选择平台和市场')
      return
    }
    try {
      await addMutation.mutateAsync({
        platform: selPlatform,
        name: addName.trim(),
        price_min: addForm.price_min ? parseFloat(addForm.price_min) : undefined,
        price_max: addForm.price_max ? parseFloat(addForm.price_max) : undefined,
        sales_volume: addForm.sales_volume ? parseInt(addForm.sales_volume) : undefined,
        sales_growth_rate: addForm.sales_growth_rate ? parseFloat(addForm.sales_growth_rate) / 100 : undefined,
        category_path: addForm.category_path || undefined,
        market: selMarket,
      })
      setAddName('')
      setAddForm(EMPTY_ADD_FORM)
      setShowAddForm(false)
      await loadProducts()
    } catch (e: any) {
      logger.error('Add trending product failed', e)
    }
  }

  const handleDeleteProduct = async (product: any) => {
    const ok = await confirmAction({
      title: '删除热卖商品',
      message: `确定删除热卖商品「${product.name}」？删除后不会影响已进入候选验证的商品。`,
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteCapturedTrendingProduct(product.id)
      loadProducts()
    } catch (e: any) {
      logger.error('Delete captured trending product failed', e)
    }
  }

  const handleCaptureProduct = async (product: any) => {
    try {
      await captureTrendingProduct({
        trending_id: product.id,
        market: selMarket,
        product_url: product.product_url || '',
        tags: product.tags || [],
      })
      toast.addToast('success', '已加入备选')
    } catch (e: any) {
      logger.error('Capture trending product failed', e)
      toast.addToast('error', e?.response?.data?.detail || '添加失败')
    }
  }

  const handleSync = async () => {
    await syncMutation.mutateAsync()
    await loadProducts()
  }

  return (
    <div className="space-y-4">
      <PillFilter title="电商平台" allLabel="全部平台" value={selPlatform}
        options={platformOptions} tone="primary" onChange={setSelPlatform} />
      <PillFilter title="国家/市场" allLabel="全部" value={selMarket}
        options={marketOptions} tone="success" onChange={setSelMarket} />
      <TrendingToolbar count={filteredProducts.length} pageSize={PAGE_SIZE} syncMutation={syncMutation} onSync={handleSync} />
      <EvidenceBanner evidence={syncMutation.data || evidence} compact />
      <TrendingProductsGrid
        isLoading={isLoading}
        filteredCount={filteredProducts.length}
        pageProducts={pageProducts}
        showAddForm={showAddForm}
        setShowAddForm={setShowAddForm}
        addName={addName}
        setAddName={setAddName}
        addForm={addForm}
        setAddForm={setAddForm}
        categoryOptions={categoryOptions}
        onAdd={handleAddProduct}
        onDelete={handleDeleteProduct}
        onCapture={handleCaptureProduct}
      />
      <PaginationBar safePage={safePage} totalPages={totalPages} total={filteredProducts.length} onPage={setPage} />
    </div>
  )
}
