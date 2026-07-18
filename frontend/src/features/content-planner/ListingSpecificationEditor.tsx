import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clipboard, PackageCheck } from 'lucide-react'
import type { ContentWorkbenchItem } from '../../api/content'
import { confirmContentTaskVersion, getContentTaskMatrix, saveContentTaskVersion } from '../../api/content'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { ToastContextType } from '../../components/ui/Toast'
import { PlatformFieldGroupEditor, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import { logger } from '../../utils/logger'

type SkuDraft = {
  sku: string
  platformSku: string
  spuSkc: string
  variation: string
  price: string
  stock: string
}

type LogisticsDraft = {
  weight: string
  length: string
  width: string
  height: string
  packageType: string
  shippingSla: string
}

type ListingOverridePayload = {
  schema?: string
  product_id?: string
  product_name?: string
  base_platform?: string | null
  base_market?: string | null
  store_id?: string | null
  store_label?: string | null
  override_boundary?: string
  title?: string
  short_description?: string
  long_description?: string
  price?: string
  currency?: string
  image_urls?: string[]
  video_url?: string
  skus?: { seller_sku?: string; platform_sku?: string; spu_skc?: string; variation?: string; price?: string; stock?: string }[]
  platform_attributes_note?: string
  logistics_note?: string
  compliance_note?: string
  promotion_note?: string
}

const inputClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]'

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
  const [logistics, setLogistics] = useState<LogisticsDraft>({ weight: '', length: '', width: '', height: '', packageType: '', shippingSla: '' })
  const [complianceText, setComplianceText] = useState('')
  const [existingOverride, setExistingOverride] = useState<ListingOverridePayload | null>(null)
  const [storedOverrideVersion, setStoredOverrideVersion] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setRequirements(product?.platform_requirements)
    setSkuDrafts([emptySkuDraft()])
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

  const requiredAttrs = requirements?.required_attributes || []
  const values = requirements?.attribute_values || {}
  const missingAttrs = requiredAttrs.filter(attr => !hasValue(values[attr]))
  const fieldReady = requiredAttrs.length > 0 && missingAttrs.length === 0
  const skuReady = skuDrafts.some(row => row.sku.trim() && row.price.trim())
  const logisticsReady = Boolean(logistics.weight.trim() && logistics.length.trim() && logistics.width.trim() && logistics.height.trim())
  const complianceReady = complianceText.trim().length > 0
  const completion = useMemo(() => {
    const checks = [fieldReady, skuReady, logisticsReady, complianceReady]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [fieldReady, skuReady, logisticsReady, complianceReady])

  const updateSku = (index: number, key: keyof SkuDraft, value: string) => {
    setSkuDrafts(current => current.map((row, i) => i === index ? { ...row, [key]: value } : row))
  }

  const addSku = () => {
    setSkuDrafts(current => [...current, emptySkuDraft()])
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
            seller_sku: row.sku.trim(),
            platform_sku: row.platformSku.trim(),
            spu_skc: row.spuSkc.trim(),
            variation: row.variation.trim(),
            price: row.price.trim(),
            stock: row.stock.trim(),
          }))
          .filter(row => row.seller_sku || row.platform_sku || row.spu_skc || row.variation || row.price || row.stock),
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
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
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
          <section id="listing-spec-sku" aria-label="SKU 变体草稿表" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">卖家后台规格编辑主表</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">按平台后台习惯维护商家SKU、平台SKU、SPU/SKC、变体属性、售价和库存。</p>
              </div>
              <Button size="sm" variant="outline" onClick={addSku}>新增规格行</Button>
            </div>
            <div className="overflow-x-auto">
              <table aria-label="卖家后台规格编辑主表" className="w-full min-w-[920px] text-left text-xs">
                <thead className="text-[var(--color-muted)]">
                  <tr>
                    <th className="px-2 py-2 font-medium">商家SKU</th>
                    <th className="px-2 py-2 font-medium">平台SKU</th>
                    <th className="px-2 py-2 font-medium">SPU/SKC</th>
                    <th className="px-2 py-2 font-medium">变体属性</th>
                    <th className="px-2 py-2 font-medium">售价</th>
                    <th className="px-2 py-2 font-medium">库存</th>
                  </tr>
                </thead>
                <tbody>
                  {skuDrafts.map((row, index) => (
                    <tr key={index} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-2"><input className={inputClass} value={row.sku} onChange={event => updateSku(index, 'sku', event.target.value)} placeholder="商家SKU" /></td>
                      <td className="px-2 py-2"><input className={inputClass} value={row.platformSku} onChange={event => updateSku(index, 'platformSku', event.target.value)} placeholder="平台SKU/Model ID" /></td>
                      <td className="px-2 py-2"><input className={inputClass} value={row.spuSkc} onChange={event => updateSku(index, 'spuSkc', event.target.value)} placeholder="SPU/SKC/商品ID" /></td>
                      <td className="px-2 py-2"><input className={inputClass} value={row.variation} onChange={event => updateSku(index, 'variation', event.target.value)} placeholder="颜色/尺码/型号" /></td>
                      <td className="px-2 py-2"><input className={inputClass} value={row.price} onChange={event => updateSku(index, 'price', event.target.value)} placeholder="发布售价" /></td>
                      <td className="px-2 py-2"><input className={inputClass} value={row.stock} onChange={event => updateSku(index, 'stock', event.target.value)} placeholder="店铺库存" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="listing-spec-attributes" aria-label="平台属性编辑工作台" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="mb-3">
              <p className="text-sm font-semibold text-[var(--color-fg)]">平台属性</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">按当前平台/类目字段组编辑；字段组缺失时必须回到平台字段补证，不用自由文本冒充必填字段。</p>
            </div>
            <PlatformRequiredFieldStatusTable requiredAttrs={requiredAttrs} values={values} />
            <PlatformFieldGroupEditor requirements={requirements} onChange={setRequirements} />
          </section>

          <section id="listing-spec-logistics" aria-label="物流包装编辑区" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-sm font-semibold text-[var(--color-fg)]">物流包装</p>
            <div aria-label="物流包裹尺寸表" className="mt-3 grid gap-2 md:grid-cols-3">
              <TextField label="重量(g)" value={logistics.weight} onChange={value => setLogistics(current => ({ ...current, weight: value }))} />
              <TextField label="长(cm)" value={logistics.length} onChange={value => setLogistics(current => ({ ...current, length: value }))} />
              <TextField label="宽(cm)" value={logistics.width} onChange={value => setLogistics(current => ({ ...current, width: value }))} />
              <TextField label="高(cm)" value={logistics.height} onChange={value => setLogistics(current => ({ ...current, height: value }))} />
              <TextField label="包装方式" value={logistics.packageType} onChange={value => setLogistics(current => ({ ...current, packageType: value }))} />
              <TextField label="发货时效" value={logistics.shippingSla} onChange={value => setLogistics(current => ({ ...current, shippingSla: value }))} />
            </div>
          </section>
        </div>

        <section id="listing-spec-compliance" aria-label="规格合规校验面板" className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-sm font-semibold text-[var(--color-fg)]">规格合规校验</p>
          <SpecCheck label="SKU/变体" ok={skuReady} detail={skuReady ? '已有至少一条可发布规格行。' : '至少补一条 SKU 和售价。'} />
          <SpecCheck label="平台属性" ok={fieldReady} detail={fieldReady ? '必填属性已填。' : missingAttrs.length ? `待补：${missingAttrs.slice(0, 4).join('、')}` : '字段组待补齐。'} />
          <SpecCheck label="物流包装" ok={logisticsReady} detail={logisticsReady ? '重量和尺寸已准备。' : '重量、长宽高会影响运费和履约规则。'} />
          <SpecCheck label="合规检查" ok={complianceReady} detail={complianceReady ? '已有合规检查文本。' : '需确认禁限售、认证、图片文案规则。'} />
          <textarea
            className="min-h-[120px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs leading-5 text-[var(--color-fg)] outline-none"
            value={complianceText}
            onChange={event => setComplianceText(event.target.value)}
            placeholder="记录禁限售、认证资料、图片文案、平台规则风险。"
          />
          <Button className="w-full" onClick={confirmCompliance} disabled={!product || !complianceText.trim() || saving}>
            <CheckCircle2 className="mr-1 h-4 w-4" />确认合规检查
          </Button>
          <Button className="w-full" onClick={saveSpecificationOverride} disabled={!product || saving}>
            <PackageCheck className="mr-1 h-4 w-4" />保存规格到店铺覆盖草稿
          </Button>
          <Button className="w-full" variant="outline" onClick={copySpecificationPack} disabled={!product}>
            <Clipboard className="mr-1 h-4 w-4" />复制规格字段包
          </Button>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[11px] leading-5 text-[var(--color-muted)]">
            <PackageCheck className="mb-2 h-4 w-4 text-[var(--color-primary)]" />
            当前草稿用于内容制作阶段准备字段；发布到具体店铺前仍需在平台刊登/店铺 Listing 实例中确认覆盖字段。
          </div>
        </section>
      </div>
    </section>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-[var(--color-muted)]">
      {label}
      <input className={inputClass} value={value} onChange={event => onChange(event.target.value)} />
    </label>
  )
}

function PlatformRequiredFieldStatusTable({ requiredAttrs, values }: { requiredAttrs: string[]; values: Record<string, unknown> }) {
  return (
    <div aria-label="平台必填字段状态表" className="mb-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">平台字段</th>
            <th className="px-3 py-2 font-medium">字段状态</th>
            <th className="px-3 py-2 font-medium">当前值</th>
          </tr>
        </thead>
        <tbody>
          {requiredAttrs.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-3 text-[var(--color-muted)]">当前平台/类目还没有已确认必填字段，需继续补证平台字段组。</td>
            </tr>
          )}
          {requiredAttrs.map(field => {
            const filled = hasValue(values[field])
            return (
              <tr key={field} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-semibold text-[var(--color-fg)]">{field}</td>
                <td className={filled ? 'px-3 py-2 text-[var(--color-success)]' : 'px-3 py-2 text-[var(--color-warning)]'}>
                  {filled ? '已填写' : '待填写'}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{formatFieldValue(values[field])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SpecCheck({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">{label}</p>
        <span className={ok ? 'text-xs font-semibold text-[var(--color-success)]' : 'text-xs font-semibold text-[var(--color-warning)]'}>{ok ? '通过' : '待补'}</span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function formatFieldValue(value: unknown) {
  if (!hasValue(value)) return '--'
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function emptySkuDraft(): SkuDraft {
  return { sku: '', platformSku: '', spuSkc: '', variation: '', price: '', stock: '' }
}

function parseListingOverridePayload(content: string): ListingOverridePayload | null {
  if (!content.trim()) return null
  try {
    const payload = JSON.parse(content) as ListingOverridePayload
    return payload.schema === 'listing_store_override.v1' ? payload : null
  } catch (error: any) {
    logger.error('Parse listing override payload failed in specification editor', error)
    return null
  }
}

function normalizeSkuDrafts(value: ListingOverridePayload['skus']): SkuDraft[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(row => row && (row.seller_sku || row.platform_sku || row.spu_skc || row.variation || row.price || row.stock))
    .map(row => ({
      sku: row.seller_sku || '',
      platformSku: row.platform_sku || '',
      spuSkc: row.spu_skc || '',
      variation: row.variation || '',
      price: row.price || '',
      stock: row.stock || '',
    }))
}

function parseLogisticsDraft(value: string): LogisticsDraft | null {
  if (!value.trim()) return null
  try {
    const parsed = JSON.parse(value) as Partial<LogisticsDraft>
    return {
      weight: parsed.weight || '',
      length: parsed.length || '',
      width: parsed.width || '',
      height: parsed.height || '',
      packageType: parsed.packageType || '',
      shippingSla: parsed.shippingSla || '',
    }
  } catch (error: any) {
    logger.error('Parse logistics draft failed in specification editor', error)
    return null
  }
}
