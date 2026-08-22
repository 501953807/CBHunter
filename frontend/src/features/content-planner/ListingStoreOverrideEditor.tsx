import { useEffect, useMemo, useState } from 'react'
import type { ContentWorkbenchItem } from '../../api/content'
import { confirmContentTaskVersion, getContentTaskMatrix, saveContentTaskVersion } from '../../api/content'
import type { ToastContextType } from '../../components/ui/Toast'
import { productImageSrc } from '../../utils/productImages'
import { logger } from '../../utils/logger'
import { ListingStoreOverrideEditorView } from './ListingStoreOverrideEditorParts'
import type { OverrideDraft, SkuOverride } from './ListingStoreOverrideEditorParts'

type Props = {
  product: ContentWorkbenchItem | null
  storeId: string
  storeLabel: string
  toast: ToastContextType
  onSaved: () => Promise<void> | void
}

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

  const notifySaved = async () => {
    try {
      await onSaved()
    } catch (error: any) {
      logger.error('Refresh content workbench after store override save failed', error)
      toast.addToast('warning', '店铺 Listing 覆盖字段已保存，但当前商品上下文刷新失败，请重新打开该商品确认')
    }
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
      await notifySaved()
      toast.addToast('success', '店铺 Listing 覆盖字段包已保存并确认')
    } catch (error: any) {
      logger.error('Save listing store override failed', error)
      toast.addToast('error', error?.response?.data?.detail || '店铺 Listing 覆盖字段保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ListingStoreOverrideEditorView
      product={product}
      storeId={storeId}
      storeLabel={storeLabel}
      draft={draft}
      imageCount={imageCount}
      minImages={minImages}
      completion={completion}
      storedOverrideVersion={storedOverrideVersion}
      storedOverrideStoreLabel={storedOverrideStoreLabel}
      loadingStoredOverride={loadingStoredOverride}
      saving={saving}
      onUpdate={update}
      onUpdateImage={updateImage}
      onUpdateSku={updateSku}
      onAddSku={addSku}
      onSave={saveOverride}
    />
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
