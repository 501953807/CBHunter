import { CheckCircle2, ImagePlus, Save, Store } from 'lucide-react'
import type { ContentWorkbenchItem } from '../../api/content'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'

export type SkuOverride = {
  sellerSku: string
  variation: string
  price: string
  stock: string
}

export type OverrideDraft = {
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

type StoreOverrideEditorViewProps = {
  product: ContentWorkbenchItem | null
  storeId: string
  storeLabel: string
  draft: OverrideDraft
  imageCount: number
  minImages: number
  completion: number
  storedOverrideVersion: number | null
  storedOverrideStoreLabel: string
  loadingStoredOverride: boolean
  saving: boolean
  onUpdate: <K extends keyof OverrideDraft>(key: K, value: OverrideDraft[K]) => void
  onUpdateImage: (index: number, value: string) => void
  onUpdateSku: (index: number, key: keyof SkuOverride, value: string) => void
  onAddSku: () => void
  onSave: () => void
}

const fieldClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]'
const textareaClass = `${fieldClass} min-h-[84px] leading-5`

export function ListingStoreOverrideEditorView({
  product,
  storeId,
  storeLabel,
  draft,
  imageCount,
  minImages,
  completion,
  storedOverrideVersion,
  storedOverrideStoreLabel,
  loadingStoredOverride,
  saving,
  onUpdate,
  onUpdateImage,
  onUpdateSku,
  onAddSku,
  onSave,
}: StoreOverrideEditorViewProps) {
  return (
    <section
      aria-label="店铺 Listing 覆盖字段编辑器"
      data-ui="listing-store-override-editor"
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
    >
      <StoreOverrideHeader
        product={product}
        storeId={storeId}
        completion={completion}
        storedOverrideVersion={storedOverrideVersion}
        loadingStoredOverride={loadingStoredOverride}
      />

      <div className="space-y-4 p-4">
        <div className="space-y-4">
          <StoreCopySection
            product={product}
            storeLabel={storeLabel}
            draft={draft}
            onUpdate={onUpdate}
          />
          <StoreMediaSection
            product={product}
            draft={draft}
            imageCount={imageCount}
            minImages={minImages}
            onUpdate={onUpdate}
            onUpdateImage={onUpdateImage}
          />
          <StoreSkuSection
            draft={draft}
            onUpdate={onUpdate}
            onUpdateSku={onUpdateSku}
            onAddSku={onAddSku}
          />
          <StoreRuleSection draft={draft} onUpdate={onUpdate} />
        </div>

        <StoreSaveGate
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
          onSave={onSave}
        />
      </div>
    </section>
  )
}

function StoreOverrideHeader({
  product,
  storeId,
  completion,
  storedOverrideVersion,
  loadingStoredOverride,
}: {
  product: ContentWorkbenchItem | null
  storeId: string
  completion: number
  storedOverrideVersion: number | null
  loadingStoredOverride: boolean
}) {
  return (
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
  )
}

function StoreCopySection({
  product,
  storeLabel,
  draft,
  onUpdate,
}: {
  product: ContentWorkbenchItem | null
  storeLabel: string
  draft: OverrideDraft
  onUpdate: StoreOverrideEditorViewProps['onUpdate']
}) {
  return (
    <section aria-label="店铺标题与描述覆盖" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3 flex items-center gap-2">
        <Store className="h-4 w-4 text-[var(--color-primary)]" />
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">店铺标题与描述</p>
          <p className="text-xs text-[var(--color-muted)]">{storeLabel || '请先在页面右上角选择目标店铺'} · {product?.target_platform || '平台待补'} / {product?.target_market || '市场待补'}</p>
        </div>
      </div>
      <div className="grid gap-3">
        <Field label="店铺标题" value={draft.storeTitle} onChange={value => onUpdate('storeTitle', value)} placeholder="按目标平台长度、关键词和店铺打法编辑标题" />
        <Field label="短描述/五点摘要" value={draft.shortDescription} onChange={value => onUpdate('shortDescription', value)} textarea placeholder="把核心卖点、适用场景、规格和信任点压缩成店铺可用摘要" />
        <Field label="长描述/商品详情" value={draft.longDescription} onChange={value => onUpdate('longDescription', value)} textarea placeholder="补充材质、尺寸、使用方法、适用人群、包装和售后说明" />
      </div>
    </section>
  )
}

function StoreMediaSection({
  product,
  draft,
  imageCount,
  minImages,
  onUpdate,
  onUpdateImage,
}: {
  product: ContentWorkbenchItem | null
  draft: OverrideDraft
  imageCount: number
  minImages: number
  onUpdate: StoreOverrideEditorViewProps['onUpdate']
  onUpdateImage: (index: number, value: string) => void
}) {
  return (
    <section aria-label="店铺图片视频覆盖" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">发布图与视频</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">平台通常至少需要 5 张发布图，建议补齐主图、细节、尺寸、场景、包装和卖点图。</p>
        </div>
        <Badge variant={imageCount >= minImages ? 'success' : 'warning'}>发布图 {imageCount}/{minImages}</Badge>
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
              onChange={value => onUpdateImage(index, value)}
              placeholder={index === 0 ? '商品主图 URL' : '细节/尺寸/场景/包装图 URL'}
            />
          ))}
          <Field label="视频 URL" value={draft.videoUrl} onChange={value => onUpdate('videoUrl', value)} placeholder="商品短视频或平台素材 URL" />
        </div>
      </div>
    </section>
  )
}

function StoreSkuSection({
  draft,
  onUpdate,
  onUpdateSku,
  onAddSku,
}: {
  draft: OverrideDraft
  onUpdate: StoreOverrideEditorViewProps['onUpdate']
  onUpdateSku: (index: number, key: keyof SkuOverride, value: string) => void
  onAddSku: () => void
}) {
  return (
    <section aria-label="店铺 SKU 价格库存覆盖" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">SKU、价格与库存</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">同一基础商品发往不同平台/店铺时，SKU、售价、库存和变体可以独立覆盖。</p>
        </div>
        <Button size="sm" variant="outline" onClick={onAddSku}>新增 SKU</Button>
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
                <td className="px-2 py-2"><input className={fieldClass} value={row.sellerSku} onChange={event => onUpdateSku(index, 'sellerSku', event.target.value)} placeholder="如 SKU-MY-BLK-001" /></td>
                <td className="px-2 py-2"><input className={fieldClass} value={row.variation} onChange={event => onUpdateSku(index, 'variation', event.target.value)} placeholder="颜色/尺码/规格" /></td>
                <td className="px-2 py-2"><input className={fieldClass} value={row.price} onChange={event => onUpdateSku(index, 'price', event.target.value)} placeholder="店铺售价" /></td>
                <td className="px-2 py-2"><input className={fieldClass} value={row.stock} onChange={event => onUpdateSku(index, 'stock', event.target.value)} placeholder="可售库存" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="默认售价" value={draft.price} onChange={value => onUpdate('price', value)} placeholder="如 39.90" />
        <Field label="币种" value={draft.currency} onChange={value => onUpdate('currency', value)} placeholder="如 MYR / PHP / SGD" />
      </div>
    </section>
  )
}

function StoreRuleSection({
  draft,
  onUpdate,
}: {
  draft: OverrideDraft
  onUpdate: StoreOverrideEditorViewProps['onUpdate']
}) {
  return (
    <section aria-label="店铺平台属性物流合规覆盖" className="grid gap-3 lg:grid-cols-2">
      <Field label="平台属性覆盖说明" value={draft.platformAttributes} onChange={value => onUpdate('platformAttributes', value)} textarea placeholder="记录店铺实例差异字段，例如颜色、材质、适用机型、认证编号等" />
      <Field label="物流包装覆盖说明" value={draft.logistics} onChange={value => onUpdate('logistics', value)} textarea placeholder="记录重量、尺寸、包装方式、发货时效、是否预售等" />
      <Field label="合规覆盖说明" value={draft.compliance} onChange={value => onUpdate('compliance', value)} textarea placeholder="记录禁限售、认证、图片文案规则、平台特殊要求" />
      <Field label="促销/店铺打法备注" value={draft.promotionNote} onChange={value => onUpdate('promotionNote', value)} textarea placeholder="记录是否参加折扣活动、店铺标签、目标人群和活动价策略" />
    </section>
  )
}

function StoreSaveGate({
  product,
  storeId,
  storeLabel,
  draft,
  imageCount,
  minImages,
  completion,
  storedOverrideVersion,
  storedOverrideStoreLabel,
  loadingStoredOverride,
  saving,
  onSave,
}: {
  product: ContentWorkbenchItem | null
  storeId: string
  storeLabel: string
  draft: OverrideDraft
  imageCount: number
  minImages: number
  completion: number
  storedOverrideVersion: number | null
  storedOverrideStoreLabel: string
  loadingStoredOverride: boolean
  saving: boolean
  onSave: () => void
}) {
  return (
    <section aria-label="店铺覆盖字段保存状态" className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
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
      <Button className="w-full" onClick={onSave} disabled={!product || saving}>
        {saving ? <><Save className="mr-1 h-4 w-4" />保存中...</> : <><CheckCircle2 className="mr-1 h-4 w-4" />保存店铺覆盖草稿</>}
      </Button>
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
