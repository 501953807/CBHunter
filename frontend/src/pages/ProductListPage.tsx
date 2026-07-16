import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Database, Download, Plus, Search, Upload } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { Select } from '../components/ui/Select'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useProductList, useDeleteProduct } from '../hooks/useProducts'
import { useToast } from '../components/ui/Toast'
import { batchUpdatePrice, batchUpdateStock, exportProducts, importProducts, seedSampleProducts } from '../api/products'
import { toDomainOptions, withAllOption } from '../utils/domainOptions'
import { logger } from '../utils/logger'
import { useConfig } from '../hooks/useConfig'
import { ProductBulkToolbar } from '../features/products/ProductBulkToolbar'
import { ProductSellerWorkbench } from '../features/products/ProductSellerWorkbench'
import { PlatformStoreProductsPanel } from '../features/products/PlatformStoreProductsPanel'
import { ProfessionalWorkspaceFrame } from '../components/shared/ProfessionalWorkspaceFrame'
import { StoreContextBanner } from '../components/shared/StoreContextBanner'
import { Tabs } from '../components/ui/Tabs'
import { usePlatformStatuses } from '../hooks/usePlatforms'

export default function ProductListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const importInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const confirmAction = useConfirm()
  const { product_statuses = [] } = useConfig()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState('')
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkStock, setBulkStock] = useState('')
  const [updatingPrice, setUpdatingPrice] = useState(false)
  const [updatingStock, setUpdatingStock] = useState(false)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'master' ? 'master' : 'platform_store_products')
  const initialPlatform = searchParams.get('platform') || ''
  const initialPlatformAccountId = searchParams.get('platform_account_id') || ''
  const platformStatusesQuery = usePlatformStatuses()

  const productListQuery = useProductList({ status: status || undefined, search: search || undefined, page, page_size: 20 })
  const { data, isLoading, refetch } = productListQuery
  const deleteMutation = useDeleteProduct()

  const products = data?.data ?? []
  const pagination = data?.meta ?? undefined
  const productStatusOptions = toDomainOptions(product_statuses)

  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    const ok = await confirmAction({
      title: '删除商品主档',
      message: `确认删除已选的 ${selectedIds.size} 个商品主档？删除主档会影响对应商品资料、选品链路和后续 Listing 维护，请确认已不再使用。`,
      confirmText: '确认删除',
      tone: 'danger',
    })
    if (!ok) return
    selectedIds.forEach((id) => deleteMutation.mutate(id))
    setSelectedIds(new Set())
  }

  const handleBulkPrice = async () => {
    if (selectedIds.size === 0 || bulkPrice === '') return
    setUpdatingPrice(true)
    try {
      const result = await batchUpdatePrice({ product_ids: Array.from(selectedIds), operation: 'set', value: Number(bulkPrice) })
      await refetch()
      toast.addToast('success', `已更新 ${result.data?.updated_count ?? 0} 个商品成本价`)
      setBulkPrice('')
    } catch (e: any) {
      logger.error('Product batch price update failed', e)
      toast.addToast('error', e?.response?.data?.detail || '批量改价失败')
    } finally {
      setUpdatingPrice(false)
    }
  }

  const handleBulkStock = async () => {
    if (selectedIds.size === 0 || bulkStock === '') return
    setUpdatingStock(true)
    try {
      const result = await batchUpdateStock({ product_ids: Array.from(selectedIds), operation: 'set', value: Number(bulkStock) })
      await refetch()
      toast.addToast('success', `已更新 ${result.data?.updated_count ?? 0} 个店铺 Listing 库存`)
      setBulkStock('')
    } catch (e: any) {
      logger.error('Product batch stock update failed', e)
      toast.addToast('error', e?.response?.data?.detail || '批量改库存失败')
    } finally {
      setUpdatingStock(false)
    }
  }

  const handleBulkPublish = () => {
    if (selectedIds.size === 0) return
    navigate(`/publish?product_ids=${Array.from(selectedIds).join(',')}`)
  }

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await exportProducts(format)
      downloadBlob(blob, `CBHunter-products.${format}`)
      toast.addToast('success', `商品${format.toUpperCase()}导出已开始`)
    } catch (e: any) {
      logger.error('Product export failed', e)
      toast.addToast('error', e?.response?.data?.detail || '商品导出失败')
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const res = await importProducts(file)
      const result = res.data
      await refetch()
      toast.addToast(
        result?.failed_count ? 'warning' : 'success',
        `导入完成：成功 ${result?.created_count ?? 0} 条，失败 ${result?.failed_count ?? 0} 条`,
      )
    } catch (e: any) {
      logger.error('Product import failed', e)
      toast.addToast('error', e?.response?.data?.detail || '商品导入失败')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const handleSeedSamples = async () => {
    try {
      const res = await seedSampleProducts()
      await refetch()
      const linkedCount = Object.values(res.data?.created_counts ?? {}).reduce((sum, count) => sum + count, 0)
      toast.addToast(
        linkedCount ? 'success' : 'warning',
        linkedCount
          ? `已导入 ${res.data?.created_count ?? 0} 条商品样本，补齐 ${linkedCount} 条链路数据`
          : '验证样本已存在，未重复创建',
      )
    } catch (e: any) {
      logger.error('Seed sample products failed', e)
      toast.addToast('error', e?.response?.data?.detail || '验证样本导入失败')
    }
  }

  return (
    <div className="space-y-6">
      <ProfessionalWorkspaceFrame
        eyebrow="Product Console"
        title="平台店铺商品库"
        description="优先管理 Shopee、TEMU、TikTok Shop 各店铺同步或本地创建的 Listing 实例；基础商品资料只作为跨店铺复用底座。"
        metrics={[
          { label: '当前列表', value: products.length, hint: pagination ? `共 ${pagination.total} 条` : '等待数据加载' },
          { label: '已选择', value: selectedIds.size, hint: '可批量定价或进入刊登' },
          { label: '当前筛选', value: status || '全部状态', hint: search || '未输入搜索词' },
        ]}
        actions={<div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => handleExport('csv')}>
            <Download className="w-4 h-4 mr-1.5" />
            导出CSV
          </Button>
          <Button variant="secondary" onClick={() => handleExport('xlsx')}>
            <Download className="w-4 h-4 mr-1.5" />
            导出Excel
          </Button>
          <Button variant="secondary" onClick={() => importInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1.5" />
            导入商品
          </Button>
          <Button variant="secondary" onClick={handleSeedSamples}>
            <Database className="w-4 h-4 mr-1.5" />
            导入验证样本
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => handleImport(event.target.files?.[0])}
          />
          <Button onClick={() => navigate('/products/new')}>
            <Plus className="w-4 h-4 mr-1.5" />
            新建商品
          </Button>
        </div>}
      />

      <EvidenceBanner evidence={data} />
      <StoreContextBanner
        platformAccountId={initialPlatformAccountId}
        platform={initialPlatform}
        statuses={platformStatusesQuery.data?.data || []}
        currentModule="products"
        clearHref="/products?tab=platform_store_products"
      />

      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'platform_store_products', label: '平台店铺商品' },
          { id: 'master', label: '基础商品资料', count: pagination?.total },
        ]}
      />

      {activeTab === 'platform_store_products' ? (
        <PlatformStoreProductsPanel initialPlatform={initialPlatform} initialPlatformAccountId={initialPlatformAccountId} />
      ) : <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 mb-4">
            <Select
              options={withAllOption('全部状态', productStatusOptions)}
              value={status}
              onChange={(v) => { setStatus(v); setPage(1) }}
              className="w-36"
            />
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
              <input
                type="text"
                placeholder="搜索商品名称或 SKU..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {productListQuery.isError && (
            <div
              data-ui="product-list-error"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs"
            >
              <span className="text-[var(--color-danger)]">基础商品资料列表加载失败，当前筛选下的商品主档、状态诊断和 Listing 衔接暂不可用。</span>
              <Button size="sm" variant="secondary" onClick={() => productListQuery.refetch()}>
                重新加载商品列表
              </Button>
            </div>
          )}

          {selectedIds.size > 0 && (
          <ProductBulkToolbar
              selectedCount={selectedIds.size}
              priceValue={bulkPrice}
              stockValue={bulkStock}
              updatingPrice={updatingPrice}
              updatingStock={updatingStock}
              onPriceChange={setBulkPrice}
              onStockChange={setBulkStock}
              onApplyPrice={handleBulkPrice}
              onApplyStock={handleBulkStock}
              onPublish={handleBulkPublish}
              onDelete={() => void handleDelete()}
              onClear={() => setSelectedIds(new Set())}
            />
          )}

          <ProductSellerWorkbench
            products={products}
            selectedIds={selectedIds}
            activeId={activeId || products[0]?.id || ''}
            productStatuses={product_statuses}
            loading={isLoading}
            pagination={pagination}
            onPageChange={setPage}
            onSelectIds={setSelectedIds}
            onActiveIdChange={setActiveId}
            onEdit={(id) => navigate(`/products/${id}`)}
            onPublish={(id) => navigate(`/publish?product_id=${id}`)}
          />
        </CardContent>
      </Card>}
    </div>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
