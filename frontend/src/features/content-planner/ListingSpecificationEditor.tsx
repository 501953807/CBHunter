import { useEffect, useMemo, useState } from 'react'
import type { ContentAsset, ContentWorkbenchItem } from '../../api/content'
import { confirmContentTaskVersion, getContentAssets, getContentTaskMatrix, saveContentTaskVersion } from '../../api/content'
import { Badge } from '../../components/ui/Badge'
import type { ToastContextType } from '../../components/ui/Toast'
import { PlatformFieldGroupEditor, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import { logger } from '../../utils/logger'
import {
  ComplianceActionSection,
  LogisticsPackagingSection,
  PlatformRequiredFieldStatusTable,
  buildSkuPlatformMappingRows,
  buildSkuReadinessRows,
  buildVariationLabel,
  contentAssetImageUrl,
  emptySkuDraft,
  emptySkuGenerationDraft,
  hasValue,
  isSkuDraftMeaningful,
  normalizeSkuDrafts,
  parseListingOverridePayload,
  parseLogisticsDraft,
  splitSpecValues,
  type ListingOverridePayload,
  type LogisticsDraft,
  type SkuDraft,
  type SkuGenerationDraft,
} from './ListingSpecificationEditorParts'
import { SkuWorkbenchSection } from './ListingSpecificationEditorSkuParts'

export function ListingSpecificationEditor({
  product,
  storeId,
  storeLabel,
  toast,
  onGenerated,
}: {
  product: ContentWorkbenchItem | null
  storeId: string
  storeLabel: string
  toast: ToastContextType
  onGenerated: () => void
}) {
  const [requirements, setRequirements] = useState<PlatformRequirementsLike | undefined>(product?.platform_requirements)
  const [skuDrafts, setSkuDrafts] = useState<SkuDraft[]>([emptySkuDraft()])
  const [skuGenerator, setSkuGenerator] = useState<SkuGenerationDraft>(emptySkuGenerationDraft())
  const [logistics, setLogistics] = useState<LogisticsDraft>({ weight: '', length: '', width: '', height: '', packageType: '', shippingSla: '' })
  const [complianceText, setComplianceText] = useState('')
  const [existingOverride, setExistingOverride] = useState<ListingOverridePayload | null>(null)
  const [storedOverrideVersion, setStoredOverrideVersion] = useState<number | null>(null)
  const [productSkuImageAssets, setProductSkuImageAssets] = useState<ContentAsset[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setRequirements(product?.platform_requirements)
    setSkuDrafts([emptySkuDraft()])
    setSkuGenerator({ ...emptySkuGenerationDraft(), skuPrefix: product?.id ? `SKU-${String(product.id).slice(0, 8)}` : '' })
    setLogistics({ weight: '', length: '', width: '', height: '', packageType: '', shippingSla: '' })
    setComplianceText((product?.platform_requirements?.compliance || []).join('\n'))
    setExistingOverride(null)
    setStoredOverrideVersion(null)
    if (!product?.id) return
    getContentTaskMatrix(product.id)
      .then(response => {
        if (cancelled) return
        const task = response.data?.tasks.find(item => item.task_type === 'listing_store_override')
        const version = task?.latest_version
        const parsed = parseListingOverridePayload(version?.content || '')
        if (!parsed) return
        const sameStore = !storeId || !parsed.store_id || parsed.store_id === storeId
        if (!sameStore) return
        setExistingOverride(parsed)
        setStoredOverrideVersion(version?.version || null)
        const parsedSkus = normalizeSkuDrafts(parsed.skus)
        if (parsedSkus.length) setSkuDrafts(parsedSkus)
        const parsedLogistics = parseLogisticsDraft(parsed.logistics_note || '')
        if (parsedLogistics) setLogistics(parsedLogistics)
        if (parsed.compliance_note) setComplianceText(parsed.compliance_note)
      })
      .catch((error: any) => {
        logger.error('Load specification listing override failed', error)
      })
    return () => {
      cancelled = true
    }
  }, [product?.id, storeId])

  useEffect(() => {
    let cancelled = false
    setProductSkuImageAssets([])
    if (!product?.id) return
    getContentAssets()
      .then(response => {
        if (cancelled) return
        const currentProductImages = (response.data || []).filter(asset => (
          asset.asset_type === 'image' && String(asset.extra?.content_item_id || '') === product.id
        ))
        setProductSkuImageAssets(currentProductImages)
      })
      .catch((error: any) => {
        logger.error('Load SKU image assets failed', error)
        toast.addToast('error', 'SKU图片素材加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [product?.id])

  const requiredAttrs = requirements?.required_attributes || []
  const values = requirements?.attribute_values || {}
  const missingAttrs = requiredAttrs.filter(attr => !hasValue(values[attr]))
  const fieldReady = requiredAttrs.length > 0 && missingAttrs.length === 0
  const skuReadiness = useMemo(() => buildSkuReadinessRows(skuDrafts, product?.target_platform), [skuDrafts, product?.target_platform])
  const skuPlatformMapping = useMemo(() => buildSkuPlatformMappingRows(skuDrafts, product?.target_platform), [skuDrafts, product?.target_platform])
  const enabledSkuRows = skuDrafts.filter(row => row.enabled && isSkuDraftMeaningful(row))
  const skuBlockingGapCount = skuReadiness.reduce((total, row) => total + row.blockingGaps.length, 0)
  const skuWarningGapCount = skuReadiness.reduce((total, row) => total + row.warningGaps.length, 0)
  const skuPlatformMappingGapCount = skuPlatformMapping.reduce((total, row) => total + row.required_gaps.length, 0)
  const skuReady = enabledSkuRows.length > 0 && skuBlockingGapCount === 0
  const logisticsReady = Boolean(logistics.weight.trim() && logistics.length.trim() && logistics.width.trim() && logistics.height.trim())
  const complianceReady = complianceText.trim().length > 0
  const completion = useMemo(() => {
    const checks = [fieldReady, skuReady, logisticsReady, complianceReady]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [fieldReady, skuReady, logisticsReady, complianceReady])

  const updateSku = (index: number, key: keyof SkuDraft, value: string | boolean) => {
    setSkuDrafts(current => current.map((row, i) => i === index ? { ...row, [key]: value } : row))
  }

  const bindSkuImageAsset = (index: number, asset: ContentAsset) => {
    updateSku(index, 'imageUrl', contentAssetImageUrl(asset))
    toast.addToast('success', `已把素材绑定到第 ${index + 1} 条 SKU 图片`)
  }

  const addSku = () => {
    setSkuDrafts(current => [...current, emptySkuDraft()])
  }

  const removeSku = (index: number) => {
    setSkuDrafts(current => current.length <= 1 ? [emptySkuDraft()] : current.filter((_, i) => i !== index))
  }

  const setAllSkuEnabled = (enabled: boolean) => {
    setSkuDrafts(current => current.map(row => ({ ...row, enabled })))
  }

  const clearSkuDrafts = () => {
    setSkuDrafts([emptySkuDraft()])
    toast.addToast('success', '已清空 SKU 草稿，仅保留一条空白规格行')
  }

  const updateSkuGenerator = (key: keyof SkuGenerationDraft, value: string) => {
    setSkuGenerator(current => ({ ...current, [key]: value }))
  }

  const appendGeneratedSkuRows = () => {
    const specOneValues = splitSpecValues(skuGenerator.specOneValues)
    const specTwoValues = splitSpecValues(skuGenerator.specTwoValues)
    if (!skuGenerator.specOneName.trim() || specOneValues.length === 0) {
      toast.addToast('error', '请至少填写规格一名称和规格一选项')
      return
    }
    const combinations = specTwoValues.length
      ? specOneValues.flatMap(valueOne => specTwoValues.map(valueTwo => [valueOne, valueTwo] as const))
      : specOneValues.map(valueOne => [valueOne, ''] as const)
    const generatedRows = combinations.map(([valueOne, valueTwo], index) => {
      const row = emptySkuDraft()
      return {
        ...row,
        sku: skuGenerator.skuPrefix.trim() ? `${skuGenerator.skuPrefix.trim()}-${index + 1}` : '',
        variation: buildVariationLabel(skuGenerator, valueOne, valueTwo),
        price: skuGenerator.price.trim(),
        stock: skuGenerator.stock.trim(),
        weight: skuGenerator.weight.trim(),
      }
    })
    setSkuDrafts(current => {
      const nonEmptyRows = current.filter(row => isSkuDraftMeaningful(row))
      return [...nonEmptyRows, ...generatedRows]
    })
    toast.addToast('success', `已追加 ${generatedRows.length} 条 SKU 规格组合`)
  }

  const rebuildGeneratedSkuRows = () => {
    const specOneValues = splitSpecValues(skuGenerator.specOneValues)
    const specTwoValues = splitSpecValues(skuGenerator.specTwoValues)
    if (!skuGenerator.specOneName.trim() || specOneValues.length === 0) {
      toast.addToast('error', '请至少填写规格一名称和规格一选项')
      return
    }
    const combinations = specTwoValues.length
      ? specOneValues.flatMap(valueOne => specTwoValues.map(valueTwo => [valueOne, valueTwo] as const))
      : specOneValues.map(valueOne => [valueOne, ''] as const)
    setSkuDrafts(combinations.map(([valueOne, valueTwo], index) => ({
      ...emptySkuDraft(),
      sku: skuGenerator.skuPrefix.trim() ? `${skuGenerator.skuPrefix.trim()}-${index + 1}` : '',
      variation: buildVariationLabel(skuGenerator, valueOne, valueTwo),
      price: skuGenerator.price.trim(),
      stock: skuGenerator.stock.trim(),
      weight: skuGenerator.weight.trim(),
    })))
    toast.addToast('success', `已按规格组合重建 ${combinations.length} 条 SKU`)
  }

  const copySpecificationPack = async () => {
    const pack = {
      product_id: product?.id,
      product_name: product?.product_name,
      target_platform: product?.target_platform,
      target_market: product?.target_market,
      sku_drafts: skuDrafts.filter(row => row.sku || row.variation || row.price || row.stock),
      platform_attribute_values: requirements?.attribute_values || {},
      logistics,
      compliance: complianceText,
    }
    await navigator.clipboard.writeText(JSON.stringify(pack, null, 2))
    toast.addToast('success', '已复制当前 Listing 规格字段包')
  }

  const confirmCompliance = async () => {
    if (!product?.id || !complianceText.trim()) return
    setSaving(true)
    try {
      const saved = await saveContentTaskVersion(product.id, 'compliance_check', complianceText.trim(), 'manual')
      const version = saved.data?.version
      if (version) await confirmContentTaskVersion(product.id, 'compliance_check', version)
      toast.addToast('success', '合规检查已确认到当前商品内容任务')
      onGenerated()
    } catch (error: any) {
      logger.error('Confirm listing compliance failed', error)
      toast.addToast('error', error?.response?.data?.detail || '合规检查确认失败')
    } finally {
      setSaving(false)
    }
  }

  const saveSpecificationOverride = async () => {
    if (!product?.id) {
      toast.addToast('error', '请先选择内容商品')
      return
    }
    setSaving(true)
    try {
      const payload: ListingOverridePayload = {
        ...(existingOverride || {}),
        schema: 'listing_store_override.v1',
        product_id: product.id,
        product_name: product.product_name,
        base_platform: product.target_platform,
        base_market: product.target_market,
        store_id: storeId || existingOverride?.store_id || null,
        store_label: storeLabel || existingOverride?.store_label || '店铺待选择',
        override_boundary: '仅用于当前店铺 Listing 实例，不回写基础商品版本，也不影响其他平台/店铺实例。',
        skus: skuDrafts
          .map(row => ({
            enabled: row.enabled,
            seller_sku: row.sku.trim(),
            platform_sku: row.platformSku.trim(),
            spu_skc: row.spuSkc.trim(),
            variation: row.variation.trim(),
            sku_image_role: row.imageRole.trim(),
            sku_image_url: row.imageUrl.trim(),
            price: row.price.trim(),
            stock: row.stock.trim(),
            weight_g: row.weight.trim(),
            length_cm: row.length.trim(),
            width_cm: row.width.trim(),
            height_cm: row.height.trim(),
            barcode: row.barcode.trim(),
          }))
          .filter(row => (
            row.seller_sku || row.platform_sku || row.spu_skc || row.variation || row.sku_image_url ||
            row.price || row.stock || row.weight_g || row.length_cm || row.width_cm || row.height_cm || row.barcode
          )),
        sku_platform_mapping: skuPlatformMapping,
        platform_attributes_note: JSON.stringify(requirements?.attribute_values || {}, null, 2),
        logistics_note: JSON.stringify(logistics, null, 2),
        compliance_note: complianceText.trim(),
      }
      const saved = await saveContentTaskVersion(product.id, 'listing_store_override', JSON.stringify(payload, null, 2), 'manual')
      const version = saved.data?.version
      if (version) await confirmContentTaskVersion(product.id, 'listing_store_override', version)
      setExistingOverride(payload)
      setStoredOverrideVersion(version || null)
      toast.addToast('success', '规格字段已保存到店铺 Listing 覆盖草稿')
      onGenerated()
    } catch (error: any) {
      logger.error('Save listing specification override failed', error)
      toast.addToast('error', error?.response?.data?.detail || '规格字段保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label="Listing SKU 属性物流合规工作台"
      data-ui="listing-spec-editor-seller-console"
      className="listing-spec-workbench overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">Listing 规格与平台字段</p>
            <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">SKU/变体、平台属性、物流包装、合规检查</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--color-muted)]">
              这里处理发布前的结构化字段。平台字段来自当前商品字段组；SKU、物流和合规作为当前 Listing 草稿准备项，不写入其他店铺实例。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={completion >= 75 ? 'success' : 'warning'}>规格完整度 {completion}%</Badge>
            <Badge variant={fieldReady ? 'success' : 'warning'}>平台字段缺 {missingAttrs.length}</Badge>
            <Badge variant={storedOverrideVersion ? 'success' : 'outline'}>{storedOverrideVersion ? `已回读覆盖 v${storedOverrideVersion}` : '未保存覆盖'}</Badge>
          </div>
        </div>
      </div>

      <nav
        aria-label="Listing 规格字段快速定位"
        data-ui="spec-editor-section-nav"
        className="flex flex-wrap gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
      >
        {[
          ['sku', 'SKU/变体'],
          ['attributes', '平台属性'],
          ['logistics', '物流包装'],
          ['compliance', '合规确认'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => document.getElementById(`listing-spec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="space-y-4 p-4">
        <div className="space-y-4">
          <SkuWorkbenchSection
            productAvailable={Boolean(product)}
            skuDrafts={skuDrafts}
            skuGenerator={skuGenerator}
            productSkuImageAssets={productSkuImageAssets}
            skuReadiness={skuReadiness}
            skuPlatformMapping={skuPlatformMapping}
            skuReady={skuReady}
            skuBlockingGapCount={skuBlockingGapCount}
            skuWarningGapCount={skuWarningGapCount}
            skuPlatformMappingGapCount={skuPlatformMappingGapCount}
            onSkuChange={updateSku}
            onSkuGeneratorChange={updateSkuGenerator}
            onBindSkuImageAsset={bindSkuImageAsset}
            onAddSku={addSku}
            onRemoveSku={removeSku}
            onSetAllSkuEnabled={setAllSkuEnabled}
            onClearSkuDrafts={clearSkuDrafts}
            onAppendGeneratedSkuRows={appendGeneratedSkuRows}
            onRebuildGeneratedSkuRows={rebuildGeneratedSkuRows}
          />

          <section id="listing-spec-attributes" aria-label="平台属性编辑工作台" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="mb-3">
              <p className="text-sm font-semibold text-[var(--color-fg)]">平台属性</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">按当前平台/类目字段组编辑；字段组缺失时必须回到平台字段补证，不用自由文本冒充必填字段。</p>
            </div>
            <PlatformRequiredFieldStatusTable requiredAttrs={requiredAttrs} values={values} />
            <PlatformFieldGroupEditor requirements={requirements} onChange={setRequirements} />
          </section>

          <LogisticsPackagingSection logistics={logistics} onChange={(key, value) => setLogistics(current => ({ ...current, [key]: value }))} />
        </div>

        <ComplianceActionSection
          skuReady={skuReady}
          skuReadinessLength={skuReadiness.length}
          skuBlockingGapCount={skuBlockingGapCount}
          fieldReady={fieldReady}
          missingAttrs={missingAttrs}
          logisticsReady={logisticsReady}
          complianceReady={complianceReady}
          complianceText={complianceText}
          saving={saving}
          productAvailable={Boolean(product)}
          onComplianceTextChange={setComplianceText}
          onConfirmCompliance={confirmCompliance}
          onSaveSpecificationOverride={saveSpecificationOverride}
          onCopySpecificationPack={copySpecificationPack}
        />
      </div>
    </section>
  )
}
