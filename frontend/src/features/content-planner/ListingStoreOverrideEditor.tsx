import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ImagePlus, Save, Store } from 'lucide-react'
import type { ContentWorkbenchItem } from '../../api/content'
import { confirmContentTaskVersion, getContentTaskMatrix, saveContentTaskVersion } from '../../api/content'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { ToastContextType } from '../../components/ui/Toast'
import { productImageSrc } from '../../utils/productImages'
import { logger } from '../../utils/logger'

type SkuOverride = {
  sellerSku: string
  variation: string
  price: string
  stock: string
}

type OverrideDraft = {
  storeTitle: string
  shortDescription: string
  longDescription: string
  price: string
  currency: string
  imageUrls: string[]
  videoUrl: string
  skus: SkuOverride[]
  platformAttributes: string
  logistics: string
  compliance: string
  promotionNote: string
}

type Props = {
  product: ContentWorkbenchItem | null
  storeId: string
  storeLabel: string
  toast: ToastContextType
  onSaved: () => void
}

const fieldClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]'
const textareaClass = `${fieldClass} min-h-[84px] leading-5`

export function ListingStoreOverrideEditor({ product, storeId, storeLabel, toast, onSaved }: Props) {
  const [draft, setDraft] = useState<OverrideDraft>(() => buildDraft(null))
  const [storedOverrideVersion, setStoredOverrideVersion] = useState<number | null>(null)
  const [storedOverrideStoreLabel, setStoredOverrideStoreLabel] = useState('')
  const [loadingStoredOverride, setLoadingStoredOverride] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDraft(buildDraft(product))
    setStoredOverrideVersion(null)
    setStoredOverrideStoreLabel('')
    if (!product?.id) return
    setLoadingStoredOverride(true)
    getContentTaskMatrix(product.id)
      .then(response => {
        if (cancelled) return
        const task = response.data?.tasks.find(item => item.task_type === 'listing_store_override')
        const version = task?.latest_version
        const parsed = parseListingStoreOverrideDraft(version?.content || '', product)
        if (!parsed) return
        setStoredOverrideVersion(version?.version || null)
        setStoredOverrideStoreLabel(parsed.storeLabel || '')
        const sameStore = !storeId || !parsed.storeId || parsed.storeId === storeId
        if (sameStore) setDraft(parsed.draft)
      })
      .catch((error: any) => {
        logger.error('Load listing store override failed', error)
      })
      .finally(() => {
        if (!cancelled) setLoadingStoredOverride(false)
      })
    return () => {
      cancelled = true
    }
  }, [product?.id, storeId])

  const imageCount = draft.imageUrls.filter(Boolean).length
  const minImages = product?.media_readiness?.min_platform_images ?? 5
  const requiredAttrs = product?.platform_requirements?.required_attributes || []
  const completion = useMemo(() => {
    const checks = [
      Boolean(draft.storeTitle.trim()),
      imageCount >= Math.min(minImages, 5),
      draft.skus.some(row => row.sellerSku.trim() && row.price.trim()),
      Boolean(draft.platformAttributes.trim() || requiredAttrs.length === 0),
      Boolean(draft.logistics.trim()),
      Boolean(draft.compliance.trim()),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [draft, imageCount, minImages, requiredAttrs.length])

  const update = <K extends keyof OverrideDraft>(key: K, value: OverrideDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const updateImage = (index: number, value: string) => {
    setDraft(current => ({
      ...current,
      imageUrls: current.imageUrls.map((url, i) => i === index ? value : url),
    }))
  }

  const updateSku = (index: number, key: keyof SkuOverride, value: string) => {
    setDraft(current => ({
      ...current,
      skus: current.skus.map((row, i) => i === index ? { ...row, [key]: value } : row),
    }))
  }

  const addSku = () => {
    setDraft(current => ({
      ...current,
      skus: [...current.skus, { sellerSku: '', variation: '', price: '', stock: '' }],
    }))
  }

  const saveOverride = async () => {
    if (!product?.id) {
      toast.addToast('error', '请先选择内容商品')
      return
    }
    setSaving(true)
    try {
      const payload = {
        schema: 'listing_store_override.v1',
        product_id: product.id,
        product_name: product.product_name,
        base_platform: product.target_platform,
        base_market: product.target_market,
        store_id: storeId || null,
        store_label: storeLabel || '店铺待选择',
        override_boundary: '仅用于当前店铺 Listing 实例，不回写基础商品版本，也不影响其他平台/店铺实例。',
        title: draft.storeTitle.trim(),
        short_description: draft.shortDescription.trim(),
        long_description: draft.longDescription.trim(),
        price: draft.price.trim(),
        currency: draft.currency.trim(),
        image_urls: draft.imageUrls.map(url => url.trim()).filter(Boolean),
        video_url: draft.videoUrl.trim(),
        skus: draft.skus
          .map(row => ({
            seller_sku: row.sellerSku.trim(),
            variation: row.variation.trim(),
            price: row.price.trim(),
            stock: row.stock.trim(),
          }))
          .filter(row => row.seller_sku || row.variation || row.price || row.stock),
        platform_attributes_note: draft.platformAttributes.trim(),
        logistics_note: draft.logistics.trim(),
        compliance_note: draft.compliance.trim(),
        promotion_note: draft.promotionNote.trim(),
      }
      const saved = await saveContentTaskVersion(product.id, 'listing_store_override', JSON.stringify(payload, null, 2), 'manual')
      const version = saved.data?.version
      if (version) await confirmContentTaskVersion(product.id, 'listing_store_override', version)
      setStoredOverrideVersion(version || null)
      setStoredOverrideStoreLabel(storeLabel || '店铺待选择')
      toast.addToast('success', '店铺 Listing 覆盖字段包已保存并确认')
      onSaved()
    } catch (error: any) {
      logger.error('Save listing store override failed', error)
      toast.addToast('error', error?.response?.data?.detail || '店铺 Listing 覆盖字段保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label="店铺 Listing 覆盖字段编辑器"
      data-ui="listing-store-override-editor"
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
    >
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">Store Listing Override</p>
            <h2 className="mt-1 text-base font-semibold text-[var(--color-fg)]">店铺 Listing 覆盖字段编辑器</h2>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-[var(--color-muted)]">
              基础商品只保留通用内容；当前区域编辑具体店铺实例的标题、图片、价格、SKU、平台属性、物流、合规和促销备注，保存为 `listing_store_override` 内容任务版本。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={product ? 'success' : 'warning'}>{product ? '商品已选择' : '未选择商品'}</Badge>
            <Badge variant={storeId ? 'success' : 'warning'}>{storeId ? '店铺已选择' : '店铺待选择'}</Badge>
            <Badge variant={storedOverrideVersion ? 'success' : 'outline'}>{storedOverrideVersion ? `已回读版本 v${storedOverrideVersion}` : loadingStoredOverride ? '回读中' : '暂无已保存覆盖'}</Badge>
            <Badge variant={completion >= 75 ? 'success' : 'warning'}>覆盖完整度 {completion}%</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section aria-label="店铺标题与描述覆盖" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="mb-3 flex items-center gap-2">
              <Store className="h-4 w-4 text-[var(--color-primary)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">店铺标题与描述</p>
                <p className="text-xs text-[var(--color-muted)]">{storeLabel || '请先在页面右上角选择目标店铺'} · {product?.target_platform || '平台待补'} / {product?.target_market || '市场待补'}</p>
              </div>
            </div>
            <div className="grid gap-3">
              <Field label="店铺标题" value={draft.storeTitle} onChange={value => update('storeTitle', value)} placeholder="按目标平台长度、关键词和店铺打法编辑标题" />
              <Field label="短描述/五点摘要" value={draft.shortDescription} onChange={value => update('shortDescription', value)} textarea placeholder="把核心卖点、适用场景、规格和信任点压缩成店铺可用摘要" />
              <Field label="长描述/商品详情" value={draft.longDescription} onChange={value => update('longDescription', value)} textarea placeholder="补充材质、尺寸、使用方法、适用人群、包装和售后说明" />
            </div>
          </section>

          <section aria-label="店铺图片视频覆盖" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">图片与视频</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">平台通常至少需要 5 张图，建议补齐主图、细节、尺寸、场景、包装和卖点图。</p>
              </div>
              <Badge variant={imageCount >= minImages ? 'success' : 'warning'}>图片 {imageCount}/{minImages}</Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                {draft.imageUrls[0] ? (
                  <img src={draft.imageUrls[0]} alt={product?.product_name || 'Listing 主图'} className="h-52 w-full object-cover" />
                ) : (
                  <div className="grid h-52 place-items-center text-xs text-[var(--color-muted)]">
                    <ImagePlus className="mb-2 h-7 w-7" />
                    主图待补
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                {draft.imageUrls.map((url, index) => (
                  <Field
                    key={index}
                    label={index === 0 ? '主图 URL' : `辅图 ${index} URL`}
                    value={url}
                    onChange={value => updateImage(index, value)}
                    placeholder={index === 0 ? '商品主图 URL' : '细节/尺寸/场景/包装图 URL'}
                  />
                ))}
                <Field label="视频 URL" value={draft.videoUrl} onChange={value => update('videoUrl', value)} placeholder="商品短视频或平台素材 URL" />
              </div>
            </div>
          </section>

          <section aria-label="店铺 SKU 价格库存覆盖" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">SKU、价格与库存</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">同一基础商品发往不同平台/店铺时，SKU、售价、库存和变体可以独立覆盖。</p>
              </div>
              <Button size="sm" variant="outline" onClick={addSku}>新增 SKU</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-[var(--color-muted)]">
                  <tr>
                    <th className="px-2 py-2 font-medium">店铺 SKU</th>
                    <th className="px-2 py-2 font-medium">变体</th>
                    <th className="px-2 py-2 font-medium">售价</th>
                    <th className="px-2 py-2 font-medium">库存</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.skus.map((row, index) => (
                    <tr key={index} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-2"><input className={fieldClass} value={row.sellerSku} onChange={event => updateSku(index, 'sellerSku', event.target.value)} placeholder="如 SKU-MY-BLK-001" /></td>
                      <td className="px-2 py-2"><input className={fieldClass} value={row.variation} onChange={event => updateSku(index, 'variation', event.target.value)} placeholder="颜色/尺码/规格" /></td>
                      <td className="px-2 py-2"><input className={fieldClass} value={row.price} onChange={event => updateSku(index, 'price', event.target.value)} placeholder="店铺售价" /></td>
                      <td className="px-2 py-2"><input className={fieldClass} value={row.stock} onChange={event => updateSku(index, 'stock', event.target.value)} placeholder="可售库存" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="默认售价" value={draft.price} onChange={value => update('price', value)} placeholder="如 39.90" />
              <Field label="币种" value={draft.currency} onChange={value => update('currency', value)} placeholder="如 MYR / PHP / SGD" />
            </div>
          </section>

          <section aria-label="店铺平台属性物流合规覆盖" className="grid gap-3 lg:grid-cols-2">
            <Field label="平台属性覆盖说明" value={draft.platformAttributes} onChange={value => update('platformAttributes', value)} textarea placeholder="记录店铺实例差异字段，例如颜色、材质、适用机型、认证编号等" />
            <Field label="物流包装覆盖说明" value={draft.logistics} onChange={value => update('logistics', value)} textarea placeholder="记录重量、尺寸、包装方式、发货时效、是否预售等" />
            <Field label="合规覆盖说明" value={draft.compliance} onChange={value => update('compliance', value)} textarea placeholder="记录禁限售、认证、图片文案规则、平台特殊要求" />
            <Field label="促销/店铺打法备注" value={draft.promotionNote} onChange={value => update('promotionNote', value)} textarea placeholder="记录是否参加折扣活动、店铺标签、目标人群和活动价策略" />
          </section>
        </div>

        <aside aria-label="店铺覆盖字段保存状态" className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-sm font-semibold text-[var(--color-fg)]">覆盖边界与门禁</p>
          <StatusLine label="基础商品" value={product?.product_name || '未选择'} ok={Boolean(product)} />
          <StatusLine label="目标店铺" value={storeLabel || '店铺待选择'} ok={Boolean(storeId)} />
          <StatusLine
            label="已保存版本"
            value={storedOverrideVersion ? `v${storedOverrideVersion} · ${storedOverrideStoreLabel || '店铺未记录'}` : loadingStoredOverride ? '回读中' : '暂无'}
            ok={Boolean(storedOverrideVersion)}
          />
          <StatusLine label="标题" value={draft.storeTitle ? '已填写' : '待补'} ok={Boolean(draft.storeTitle.trim())} />
          <StatusLine label="图片" value={`${imageCount}/${minImages}`} ok={imageCount >= Math.min(minImages, 5)} />
          <StatusLine label="SKU/价格" value={draft.skus.some(row => row.sellerSku && row.price) ? '已填写' : '待补'} ok={draft.skus.some(row => row.sellerSku && row.price)} />
          <StatusLine label="覆盖完整度" value={`${completion}%`} ok={completion >= 75} />
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[11px] leading-5 text-[var(--color-muted)]">
            保存后写入当前内容商品的 `listing_store_override` 任务版本。该版本只代表目标店铺实例覆盖草稿，不发布平台，不修改其他店铺，也不覆盖基础商品内容。
            {storedOverrideVersion && storedOverrideStoreLabel && storeLabel && storedOverrideStoreLabel !== storeLabel ? ` 当前已保存版本属于 ${storedOverrideStoreLabel}，不会自动覆盖 ${storeLabel}。` : ''}
          </div>
          <Button className="w-full" onClick={saveOverride} disabled={!product || saving}>
            {saving ? <><Save className="mr-1 h-4 w-4" />保存中...</> : <><CheckCircle2 className="mr-1 h-4 w-4" />保存店铺覆盖草稿</>}
          </Button>
        </aside>
      </div>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  return (
    <label className="grid gap-1 text-xs text-[var(--color-muted)]">
      {label}
      {textarea ? (
        <textarea className={textareaClass} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
      ) : (
        <input className={fieldClass} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
      )}
    </label>
  )
}

function StatusLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <span className={ok ? 'text-xs font-semibold text-[var(--color-success)]' : 'text-xs font-semibold text-[var(--color-warning)]'}>{value}</span>
    </div>
  )
}

function buildDraft(product: ContentWorkbenchItem | null): OverrideDraft {
  const sourceImage = productImageSrc(product?.image_url)
  const attrs = product?.platform_requirements?.attribute_values || {}
  return {
    storeTitle: product?.content_brief?.title || product?.product_name || '',
    shortDescription: (product?.content_brief?.bullets || []).join('\n'),
    longDescription: '',
    price: product?.selling_price_local != null ? String(product.selling_price_local) : '',
    currency: currencyForMarket(product?.target_market),
    imageUrls: [sourceImage || '', '', '', '', '', '', '', '', ''],
    videoUrl: '',
    skus: [{ sellerSku: product ? `${product.id.slice(0, 8).toUpperCase()}-01` : '', variation: '', price: product?.selling_price_local != null ? String(product.selling_price_local) : '', stock: '' }],
    platformAttributes: Object.keys(attrs).length ? JSON.stringify(attrs, null, 2) : '',
    logistics: '',
    compliance: (product?.platform_requirements?.compliance || []).join('\n'),
    promotionNote: '',
  }
}

function parseListingStoreOverrideDraft(content: string, product: ContentWorkbenchItem | null): { draft: OverrideDraft; storeId: string; storeLabel: string } | null {
  if (!content.trim()) return null
  try {
    const payload = JSON.parse(content) as {
      schema?: string
      store_id?: string | null
      store_label?: string | null
      title?: string
      short_description?: string
      long_description?: string
      price?: string
      currency?: string
      image_urls?: string[]
      video_url?: string
      skus?: { seller_sku?: string; variation?: string; price?: string; stock?: string }[]
      platform_attributes_note?: string
      logistics_note?: string
      compliance_note?: string
      promotion_note?: string
    }
    if (payload.schema !== 'listing_store_override.v1') return null
    const fallback = buildDraft(product)
    return {
      storeId: payload.store_id || '',
      storeLabel: payload.store_label || '',
      draft: {
        storeTitle: payload.title || fallback.storeTitle,
        shortDescription: payload.short_description || fallback.shortDescription,
        longDescription: payload.long_description || fallback.longDescription,
        price: payload.price || fallback.price,
        currency: payload.currency || fallback.currency,
        imageUrls: normalizeImageUrls(payload.image_urls, fallback.imageUrls),
        videoUrl: payload.video_url || fallback.videoUrl,
        skus: normalizeSkus(payload.skus, fallback.skus),
        platformAttributes: payload.platform_attributes_note || fallback.platformAttributes,
        logistics: payload.logistics_note || fallback.logistics,
        compliance: payload.compliance_note || fallback.compliance,
        promotionNote: payload.promotion_note || fallback.promotionNote,
      },
    }
  } catch (error: any) {
    logger.error('Parse listing store override failed', error)
    return null
  }
}

function normalizeImageUrls(value: string[] | undefined, fallback: string[]) {
  const urls = Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
  return [...urls, ...Array(Math.max(0, 9 - urls.length)).fill('')].slice(0, Math.max(9, fallback.length))
}

function normalizeSkus(value: { seller_sku?: string; variation?: string; price?: string; stock?: string }[] | undefined, fallback: SkuOverride[]) {
  const rows = Array.isArray(value)
    ? value.map(item => ({
      sellerSku: item.seller_sku || '',
      variation: item.variation || '',
      price: item.price || '',
      stock: item.stock || '',
    }))
    : []
  return rows.length ? rows : fallback
}

function currencyForMarket(market?: string | null) {
  const key = (market || '').toUpperCase()
  if (key.includes('PH')) return 'PHP'
  if (key.includes('SG')) return 'SGD'
  if (key.includes('TH')) return 'THB'
  if (key.includes('ID')) return 'IDR'
  if (key.includes('VN')) return 'VND'
  return 'MYR'
}
