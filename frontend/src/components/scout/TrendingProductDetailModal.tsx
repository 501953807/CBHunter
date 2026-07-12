import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Package, Plus, RefreshCw, Star, Store, X } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { formatPrice, formatSales, getSourceLabel } from './TrendingProductsUtils'

export function TrendingProductDetailModal({
  product,
  imageIndex,
  adding,
  marketLabelMap,
  onParseSourceError,
  onClose,
  onImageIndexChange,
  onAddToSourcing,
}: any) {
  if (!product) return null
  const images: string[] = product.images && product.images.length > 0 ? product.images : []
  const maxIndex = images.length - 1
  const prevImage = () => onImageIndexChange(imageIndex > 0 ? imageIndex - 1 : maxIndex)
  const nextImage = () => onImageIndexChange(imageIndex < maxIndex ? imageIndex + 1 : 0)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-overlay-strong)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ width: 'min(90vw, 800px)', height: 'min(85vh, 550px)', backgroundColor: 'var(--color-surface)' }}
        onClick={e => e.stopPropagation()}>
        <ImageCarousel product={product} images={images} imageIndex={imageIndex} maxIndex={maxIndex} onPrev={prevImage} onNext={nextImage} />
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-bold leading-snug" style={{ color: 'var(--color-fg)' }}>{product.name}</h2>
            <button onClick={onClose}
              className="p-1 rounded-md hover:bg-[var(--color-border)] shrink-0" style={{ color: 'var(--color-muted)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <StatsRow product={product} />
          <DetailAttrs product={product} marketLabelMap={marketLabelMap} sourceLabel={getSourceLabel(product, onParseSourceError)} />
          <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button onClick={(e) => { e.stopPropagation(); onAddToSourcing(product); onClose() }}
              disabled={adding}
              className="flex items-center gap-1 text-xs font-medium px-4 py-2 rounded-lg hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-text)' }}>
              {adding ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              加入备选
            </button>
            {product.product_url && (
              <a href={product.product_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium px-4 py-2 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>
                <ExternalLink className="w-3 h-3" />查看原链接
              </a>
            )}
          </div>
          <Thumbnails images={images} imageIndex={imageIndex} onImageIndexChange={onImageIndexChange} />
        </div>
      </div>
    </div>
  )
}

function ImageCarousel({ product, images, imageIndex, maxIndex, onPrev, onNext }: any) {
  return (
    <div className="relative shrink-0 w-full md:w-[55%] bg-[var(--color-fg)] flex items-center justify-center" style={{ height: '100%' }}>
      {images.length > 0 ? (
        <>
          <img src={images[imageIndex]} alt={product.name} className="w-full h-full object-contain" />
          {maxIndex > 0 && (
            <>
              <button onClick={onPrev} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[var(--color-overlay)] text-[var(--color-primary-text)] hover:bg-[var(--color-overlay-strong)]">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={onNext} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[var(--color-overlay)] text-[var(--color-primary-text)] hover:bg-[var(--color-overlay-strong)]">
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded-full bg-[var(--color-overlay)] text-[var(--color-primary-text)]">
                {imageIndex + 1} / {images.length}
              </span>
            </>
          )}
        </>
      ) : (
        <Package className="w-16 h-16 opacity-20" style={{ color: 'var(--color-muted)' }} />
      )}
    </div>
  )
}

function StatsRow({ product }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>价格</div>
        <div className="text-lg font-bold" style={{ color: 'var(--color-danger)' }}>{formatPrice(product)}</div>
      </div>
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>月销量</div>
        <div className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>{formatSales(product.sales_volume)}</div>
      </div>
    </div>
  )
}

function DetailAttrs({ product, marketLabelMap, sourceLabel }: any) {
  return (
    <div className="space-y-2">
      {product.platform && <Attr icon={<Store className="w-3.5 h-3.5" style={{ color: 'var(--color-muted)' }} />} label="平台"><Badge>{product.platform.toUpperCase()}</Badge></Attr>}
      {product.market && <Attr icon={<MapPin className="w-3.5 h-3.5" style={{ color: 'var(--color-muted)' }} />} label="市场"><span style={{ color: 'var(--color-fg)' }}>{marketLabelMap[product.market] || product.market}</span></Attr>}
      {product.sku && <Attr icon={<Package className="w-3.5 h-3.5" style={{ color: 'var(--color-muted)' }} />} label="SKU"><span style={{ color: 'var(--color-fg)' }}>{product.sku}</span></Attr>}
      {product.shop_name && <Attr icon={<Store className="w-3.5 h-3.5" style={{ color: 'var(--color-muted)' }} />} label="店铺"><span style={{ color: 'var(--color-fg)' }}>{product.shop_name}</span></Attr>}
      {product.rating > 0 && <Attr icon={<Star className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />} label="评分"><span style={{ color: 'var(--color-fg)' }}>{product.rating}</span></Attr>}
      <div className="flex items-center gap-2 text-xs">
        <span style={{ color: 'var(--color-muted)' }}>来源</span>
        <span style={{ color: 'var(--color-fg)' }}>{sourceLabel}</span>
      </div>
    </div>
  )
}

function Attr({ icon, label, children }: any) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {icon}
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      {children}
    </div>
  )
}

function Thumbnails({ images, imageIndex, onImageIndexChange }: any) {
  if (images.length <= 1) return null
  return (
    <div className="flex gap-2 overflow-x-auto pt-1">
      {images.map((src: string, index: number) => (
        <button key={index} onClick={() => onImageIndexChange(index)}
          className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden ${index === imageIndex ? '' : 'opacity-50'}`}
          style={{ borderColor: index === imageIndex ? 'var(--color-primary)' : 'var(--color-border)' }}>
          <img src={src} className="w-full h-full object-cover" alt="" loading="lazy" />
        </button>
      ))}
    </div>
  )
}
