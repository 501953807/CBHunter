import { useEffect, useState } from 'react'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import { useConfig } from '../../hooks/useConfig'
import { captureTrendingProduct, deleteTrendingProduct, listTrendingProducts } from '../../api/scout'
import { listTrendKeywords } from '../../api/discovery'
import { logger } from '../../utils/logger'
import { TrendingProductDetailModal } from './TrendingProductDetailModal'
import { TrendingProductsGrid } from './TrendingProductsGrid'
import { TrendingProductsToolbar } from './TrendingProductsToolbar'
import { matchProductTrends } from './TrendingProductsUtils'

const PAGE_SIZE = 12

export default function TrendingProductsPanel() {
  const toast = useToast()
  const confirmAction = useConfirm()
  const { markets: dictMarkets, categories: dictCategories, platforms: dictPlatforms } = useConfig()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [platformTab, setPlatformTab] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMarket, setFilterMarket] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [detailProduct, setDetailProduct] = useState<any>(null)
  const [detailImgIndex, setDetailImgIndex] = useState(0)
  const [trendKeywords, setTrendKeywords] = useState<any[]>([])
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>({})

  const loadProducts = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: PAGE_SIZE }
      if (platformTab) params.platform = platformTab
      if (searchKeyword) params.keyword = searchKeyword
      if (filterCategory) params.category = filterCategory
      if (filterMarket) params.market = filterMarket
      const res = await listTrendingProducts(params)
      setProducts(res.data?.items || [])
      setTotal(res.data?.total || 0)
      setPlatformCounts(res.data?.platform_counts || {})
    } catch (e: any) {
      logger.error('Load trending products failed', e)
      toast.addToast('error', '热卖商品加载失败')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadProducts() }, [page, platformTab, searchKeyword, filterCategory, filterMarket])

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const res = await listTrendKeywords()
        setTrendKeywords(res.data?.items || [])
      } catch (e: any) {
        logger.error('Load trend keywords failed', e)
      }
    }
    void fetchTrends()
  }, [])

  const handleAddToSourcing = async (product: any) => {
    setAddingId(product.id)
    try {
      await captureTrendingProduct({
        trending_id: product.id,
        market: product.market || '',
        product_url: product.product_url || '',
        tags: product.tags || [],
      })
      toast.addToast('success', `"${(product.name || '').slice(0, 20)}" 已加入热卖备选`)
    } catch (e: any) {
      logger.error('Capture trending product failed', e)
      toast.addToast('error', e?.response?.data?.detail || '添加失败')
    } finally {
      setAddingId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: '删除销售平台商品',
      message: `确定删除「${name.slice(0, 30)}」？删除后不会影响已加入选品库的商品。`,
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteTrendingProduct(id)
      toast.addToast('success', '已删除')
      await loadProducts()
    } catch (e: any) {
      logger.error('Delete trending product failed', e)
      toast.addToast('error', '删除失败')
    }
  }

  const handleSearch = () => {
    setSearchKeyword(searchInput)
    setPage(1)
  }

  const clearFilters = () => {
    setFilterCategory('')
    setFilterMarket('')
    setSearchInput('')
    setSearchKeyword('')
    setPage(1)
  }

  const openDetail = (product: any) => {
    setDetailProduct(product)
    setDetailImgIndex(0)
  }

  const closeDetail = () => {
    setDetailProduct(null)
    setDetailImgIndex(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1
  const marketLabelMap: Record<string, string> = {}
  dictMarkets.forEach((market: any) => { marketLabelMap[market.id] = market.flag ? `${market.flag} ${market.label}` : market.label })
  const platformLabelMap = new Map(dictPlatforms.map((platform) => [platform.id, platform.label]))
  const platformMap = new Map(dictPlatforms.map((platform) => [platform.id, platform]))
  const marketMap = new Map(dictMarkets.map((market) => [market.id, market]))
  const platformTabs = [
    { id: '', label: '全部', count: undefined },
    ...Object.entries(platformCounts).map(([id, count]) => ({
      id,
      label: platformLabelMap.get(id) || id.replaceAll('_', ' ').toUpperCase(),
      count,
    })),
  ]

  return (
    <div className="space-y-3">
      <TrendingProductsToolbar
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        filterCategory={filterCategory}
        filterMarket={filterMarket}
        categories={dictCategories}
        markets={dictMarkets}
        platformTabs={platformTabs}
        platformTab={platformTab}
        onSearch={handleSearch}
        onCategoryChange={(value: string) => { setFilterCategory(value); setPage(1) }}
        onMarketChange={(value: string) => { setFilterMarket(value); setPage(1) }}
        onPlatformChange={(value: string) => { setPlatformTab(value); setPage(1) }}
        onClear={clearFilters}
      />
      <TrendingProductsGrid
        loading={loading}
        products={products}
        total={total}
        page={page}
        totalPages={totalPages}
        hoveredId={hoveredId}
        addingId={addingId}
        marketLabelMap={marketLabelMap}
        platformLabelMap={platformLabelMap}
        platformMap={platformMap}
        marketMap={marketMap}
        onParseSourceError={(e: any) => logger.error('Parse trending product source failed', e)}
        onHover={setHoveredId}
        onOpenDetail={openDetail}
        onAddToSourcing={handleAddToSourcing}
        onDelete={handleDelete}
        onPageChange={setPage}
        matchProductTrends={(product: any) => matchProductTrends(product, trendKeywords, dictCategories)}
      />
      <TrendingProductDetailModal
        product={detailProduct}
        imageIndex={detailImgIndex}
        adding={addingId === detailProduct?.id}
        marketLabelMap={marketLabelMap}
        onParseSourceError={(e: any) => logger.error('Parse trending product source failed', e)}
        onClose={closeDetail}
        onImageIndexChange={setDetailImgIndex}
        onAddToSourcing={handleAddToSourcing}
      />
    </div>
  )
}
