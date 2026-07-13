import { ChevronLeft, ChevronRight, ExternalLink, Package, Plus, RefreshCw, Trash2, Zap } from 'lucide-react'
import { Button } from '../ui/Button'
import { buildPlatformSearchUrl, formatPrice, formatSales, getSourceLabel } from './TrendingProductsUtils'
import { productImageSrc } from '../../utils/productImages'

export function TrendingProductsGrid({
  loading,
  products,
  total,
  page,
  totalPages,
  hoveredId,
  addingId,
  marketLabelMap,
  platformLabelMap,
  platformMap,
  marketMap,
  onParseSourceError,
  onHover,
  onOpenDetail,
  onAddToSourcing,
  onDelete,
  onPageChange,
  matchProductTrends,
}: any) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>共 {total} 个热卖商品</p>
      </div>
      {loading ? <GridLoading /> : products.length === 0 ? <EmptyProducts /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {products.map((product: any) => (
              <TrendingProductCard
                key={product.id}
                product={product}
                hovered={hoveredId === product.id}
                adding={addingId === product.id}
                marketLabelMap={marketLabelMap}
                platformLabelMap={platformLabelMap}
                platformSearchUrl={buildPlatformSearchUrl(platformMap.get(product.platform), marketMap.get(product.market), product.name)}
                matched={matchProductTrends(product)}
                onParseSourceError={onParseSourceError}
                onHover={onHover}
                onOpenDetail={onOpenDetail}
                onAddToSourcing={onAddToSourcing}
                onDelete={onDelete}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button size="sm" variant="outline" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{page} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}

function GridLoading() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="skeleton-shimmer rounded-xl" style={{ height: '240px' }} />
      ))}
    </div>
  )
}

function EmptyProducts() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--color-muted)' }}>
      <Package className="w-12 h-12 opacity-30" />
      <p className="text-sm">暂无热卖商品</p>
      <p className="text-xs">通过浏览器采集工具从 Shopee、TEMU 或 TikTok Shop 保存真实商品</p>
    </div>
  )
}

function TrendingProductCard({
  product,
  hovered,
  adding,
  marketLabelMap,
  platformLabelMap,
  platformSearchUrl,
  matched,
  onParseSourceError,
  onHover,
  onOpenDetail,
  onAddToSourcing,
  onDelete,
}: any) {
  return (
    <div className="group relative rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      onMouseEnter={() => onHover(product.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onOpenDetail(product)}>
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
        {product.images && product.images.length > 0 ? (
          <img src={productImageSrc(product.images[0])} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 opacity-20" style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
        {product.images && product.images.length > 1 && (
          <div className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-overlay)', color: 'var(--color-primary-text)' }}>
            {hovered ? `${product.images.length} 张` : `1 / ${product.images.length}`}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium leading-snug mb-1.5 line-clamp-2" style={{ color: 'var(--color-fg)', minHeight: '2.5em' }}>{product.name}</h3>
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {product.platform && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
              {platformLabelMap.get(product.platform) || product.platform.toUpperCase()}
            </span>
          )}
          {product.market && marketLabelMap[product.market] && (
            <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }}>
              {marketLabelMap[product.market]}
            </span>
          )}
          <span className="text-[11px] px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }}>
            {getSourceLabel(product, onParseSourceError)}
          </span>
        </div>
        {product.sku && <p className="text-[11px] mb-1.5 truncate" style={{ color: 'var(--color-muted)' }}>SKU: {product.sku}</p>}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>{formatPrice(product)}</span>
          {product.sales_volume > 0 && <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>售 {formatSales(product.sales_volume)}</span>}
        </div>
        {matched.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {matched.slice(0, 3).map((item: any, index: number) => (
              <span key={index} className="text-[11px] px-1 py-0.5 rounded bg-[var(--color-info-light)] text-[var(--color-info)]">
                <Zap className="w-2 h-2 inline mr-0.5" />{item.keyword}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 gap-2">
          {product.product_url ? (
            <a href={product.product_url} target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-0.5 opacity-60 hover:opacity-100"
              style={{ color: 'var(--color-muted)' }} onClick={e => e.stopPropagation()}>
              <ExternalLink className="w-2.5 h-2.5" />来源
            </a>
          ) : <span />}
          {platformSearchUrl && (
            <a href={platformSearchUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-0.5 opacity-60 hover:opacity-100"
              style={{ color: 'var(--color-muted)' }} onClick={e => e.stopPropagation()}>
              <ExternalLink className="w-2.5 h-2.5" />平台搜索
            </a>
          )}
          <button onClick={(e) => { e.stopPropagation(); onAddToSourcing(product) }}
            disabled={adding}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md shrink-0 hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-text)' }}>
            {adding ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
            加入备选
          </button>
        </div>
        {hovered && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(product.id, product.name) }}
            className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: 'var(--color-overlay-light)' }}>
            <Trash2 className="w-3 h-3" style={{ color: 'var(--color-danger)' }} />
          </button>
        )}
      </div>
    </div>
  )
}
