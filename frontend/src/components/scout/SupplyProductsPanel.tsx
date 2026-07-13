import { useState, useEffect } from 'react'
import { RefreshCw, Trash2, Search, ChevronLeft, ChevronRight, Package, Plus, ExternalLink, Image, Factory } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import { addSupplyProductToDiscovery, deleteSupplyProduct, listSupplyProducts } from '../../api/scout'
import { useConfig } from '../../hooks/useConfig'
import { logger } from '../../utils/logger'
import { productImageSrc } from '../../utils/productImages'

const SOURCE_LABELS: Record<string, string> = {
  browser_ext: '扩展采集', manual: '手动录入',
}

export default function SupplyProductsPanel() {
  const toast = useToast()
  const confirmAction = useConfirm()
  const { categories } = useConfig()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const pageSize = 12

  const loadProducts = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize }
      if (searchKeyword) params.keyword = searchKeyword
      const r = await listSupplyProducts(params)
      const items = r.data?.items || []
      setProducts(items)
      setTotal(r.data?.total || 0)
      const alreadyAdded = new Set<string>()
      items.forEach((p: any) => { if (p.added_to_discovery) alreadyAdded.add(p.id) })
      setAddedIds(alreadyAdded)
    } catch (e: any) {
      logger.error('Load supply products failed', e)
      setProducts([])
    }
    setLoading(false)
  }

  useEffect(() => { loadProducts() }, [page, searchKeyword])

  const handleSearch = () => { setSearchKeyword(searchInput); setPage(1) }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: '删除供应渠道商品',
      message: `确定删除「${name.slice(0, 30)}」？删除后不会影响已归并的候选商品。`,
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteSupplyProduct(id)
      toast.addToast('success', '已删除')
      loadProducts()
    } catch (e: any) {
      logger.error('Delete supply product failed', e)
      toast.addToast('error', '删除失败')
    }
  }

  const handleAddToDiscovery = async (product: any) => {
    if (addedIds.has(product.id)) { toast.addToast('info', '已添加到图片选品'); return }
    setAddingId(product.id)
    try {
      await addSupplyProductToDiscovery(product.id)
      toast.addToast('success', `"${product.name.slice(0, 20)}..." 已添加到图片选品`)
      setAddedIds(prev => new Set([...prev, product.id]))
    } catch (e: any) {
      logger.error('Add supply product to discovery failed', e)
      toast.addToast('error', e?.response?.data?.detail || '添加失败')
    }
    setAddingId(null)
  }

  const formatPrice = (p: any) => {
    if (p.price_min && p.price_max && p.price_min !== p.price_max) return `¥${p.price_min.toFixed(1)}-${p.price_max.toFixed(1)}`
    const price = p.price_min || p.price_max
    return price ? `¥${price.toFixed(1)}` : '—'
  }
  const formatSales = (v: number) => { if (!v || v === 0) return '—'; if (v >= 10000) return (v / 10000).toFixed(1) + '万'; return v.toString() }
  const getCategoryLabel = (id?: string) => categories.find(item => item.id === id)?.label || id
  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-[200px] max-w-md">
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索商品名称、分类、店铺..." className="flex-1 text-sm px-3 py-1.5 rounded-lg border bg-transparent"
            style={{ color: 'var(--color-fg)', borderColor: 'var(--color-border)' }} />
          <Button size="sm" variant="outline" onClick={handleSearch}><Search className="w-3.5 h-3.5" /></Button>
        </div>
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>共 {total} 个产品</span>
      </div>

      {/* Grid or empty */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--color-muted)' }} /></div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--color-muted)' }}>
          <Package className="w-12 h-12 opacity-30" />
          <p className="text-sm">暂无供应链产品</p>
          <p className="text-xs">使用 Chrome 扩展在 1688 浏览商品时点击 📦 采集</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {products.map((p: any) => (
              <div key={p.id} className="group relative rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}>
                {/* Image */}
                <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
                  {p.images && p.images.length > 0 ? (
                    <img src={productImageSrc(p.images[0])} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Image className="w-8 h-8 opacity-20" style={{ color: 'var(--color-muted)' }} /></div>
                  )}
                  {hoveredId === p.id && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name) }}
                      className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: 'var(--color-overlay-light)' }}><Trash2 className="w-3 h-3" style={{ color: 'var(--color-danger)' }} /></button>
                  )}
                  {p.images && p.images.length > 1 && (
                    <div className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-overlay)', color: 'white' }}>
                      {hoveredId === p.id ? `${p.images.length} 张` : '1 / ' + p.images.length}</div>
                  )}
                </div>
                {/* Info */}
                <div className="p-3">
                  <h3 className="text-sm font-medium leading-snug mb-1.5 line-clamp-2" style={{ color: 'var(--color-fg)' }}>{p.name}</h3>
                  <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                    {p.category_path && <Badge variant="default">{getCategoryLabel(p.category_path)}</Badge>}
                    {p.shop_name && (
                      <span className="inline-flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
                        <Factory className="w-3 h-3" />{p.shop_name.length > 8 ? p.shop_name.slice(0, 8) + '...' : p.shop_name}</span>
                    )}
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }}>
                      {SOURCE_LABELS[p.source] || '未知'}</span>
                  </div>
                  {p.sku && <p className="text-[11px] mb-1.5 truncate" style={{ color: 'var(--color-muted)' }}>SKU: {p.sku}</p>}
                  {p.moq && p.moq > 1 && <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-muted)' }}>起订: {p.moq} 件</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>{formatPrice(p)}</span>
                    {p.sales_volume > 0 && <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>成交 {formatSales(p.sales_volume)}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    {p.product_url ? (
                      <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-0.5 opacity-60 hover:opacity-100"
                        style={{ color: 'var(--color-muted)' }} onClick={e => e.stopPropagation()}><ExternalLink className="w-2.5 h-2.5" />1688</a>
                    ) : <span />}
                    <button onClick={(e) => { e.stopPropagation(); handleAddToDiscovery(p) }}
                      disabled={addingId === p.id || addedIds.has(p.id)}
                      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md shrink-0 ${addedIds.has(p.id) ? 'opacity-40 cursor-default' : 'hover:opacity-80'} disabled:opacity-40`}
                      style={{ backgroundColor: addedIds.has(p.id) ? 'var(--color-muted)' : 'var(--color-primary)', color: 'white' }}>
                      {addingId === p.id ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : addedIds.has(p.id) ? '已添加' : <><Plus className="w-2.5 h-2.5" />图片选品</>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{page} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
