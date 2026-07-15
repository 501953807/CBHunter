import type { BatchListingDraft } from '../../api/listing'
import { productImageSrc } from '../../utils/productImages'

export function VariantEditor({
  variants,
  onChange,
}: {
  variants: Array<Record<string, unknown>>
  onChange: (variants: Array<Record<string, unknown>>) => void
}) {
  const visibleVariants = variants.length ? variants : [{ sku: '', option_1_name: '', option_1_value: '', price: '', stock: '' }]
  const updateVariant = (rowIndex: number, field: string, value: unknown) => {
    const next = visibleVariants.map((variant, index) => index === rowIndex ? { ...variant, [field]: value } : variant)
    onChange(next)
  }
  const addVariant = () => onChange([...visibleVariants, { sku: '', option_1_name: '', option_1_value: '', price: '', stock: '' }])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="text-[var(--color-muted)]">
          <tr>
            <th className="py-1 pr-2">SKU</th>
            <th className="py-1 pr-2">规格名</th>
            <th className="py-1 pr-2">规格值</th>
            <th className="py-1 pr-2">价格</th>
            <th className="py-1 pr-2">库存</th>
          </tr>
        </thead>
        <tbody>
          {visibleVariants.slice(0, 8).map((variant, rowIndex) => (
            <tr key={rowIndex}>
              {['sku', 'option_1_name', 'option_1_value', 'price', 'stock'].map(field => (
                <td key={field} className="py-1 pr-2">
                  <input
                    value={stringValue(variant[field])}
                    onChange={event => updateVariant(rowIndex, field, field === 'price' || field === 'stock' ? numberOrNull(event.target.value) : event.target.value)}
                    className="w-full min-w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-fg)]"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={addVariant} className="mt-2 text-[11px] font-medium text-[var(--color-primary)]">+ 增加规格</button>
    </div>
  )
}

export function MediaEditor({ draft, onChange }: { draft: BatchListingDraft; onChange: (patch: Partial<BatchListingDraft>) => void }) {
  const images = draft.media_assets?.images || (Array.isArray(draft.images) ? draft.images : draft.images ? [draft.images] : [])
  const videos = draft.media_assets?.videos || []
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.slice(0, 5).map(url => (
          <img key={url} src={productImageSrc(url)} alt="Listing 图片" className="h-14 w-14 shrink-0 rounded-lg border border-[var(--color-border)] object-cover" />
        ))}
        {images.length === 0 && <span className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-5 text-[11px] text-[var(--color-warning)]">图片待补</span>}
      </div>
      <label className="text-[11px] font-medium text-[var(--color-muted)]">
        图片 URL（每行一个）
        <textarea
          value={images.join('\n')}
          onChange={event => {
            const nextImages = splitLines(event.target.value)
            onChange({ images: nextImages, media_assets: { ...(draft.media_assets || {}), images: nextImages, main_image: nextImages[0] || null } })
          }}
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
        />
      </label>
      <label className="text-[11px] font-medium text-[var(--color-muted)]">
        视频 URL（每行一个）
        <textarea
          value={videos.join('\n')}
          onChange={event => onChange({ media_assets: { ...(draft.media_assets || {}), videos: splitLines(event.target.value) } })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
        />
      </label>
    </>
  )
}

export function LogisticsEditor({ draft, onChange }: { draft: BatchListingDraft; onChange: (patch: Partial<BatchListingDraft>) => void }) {
  const logistics = draft.logistics || {}
  const dimensions = logistics.dimensions || {}
  const update = (patch: Record<string, unknown>) => onChange({ logistics: { ...logistics, ...patch } })
  const updateDimension = (field: string, value: number | null) => update({ dimensions: { ...dimensions, [field]: value } })
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberInput label="重量(g)" value={logistics.weight_g} onChange={value => update({ weight_g: value })} />
      <NumberInput label="备货天数" value={logistics.preparation_days} onChange={value => update({ preparation_days: value })} />
      <NumberInput label="长(cm)" value={numberFromUnknown(dimensions.length_cm)} onChange={value => updateDimension('length_cm', value)} />
      <NumberInput label="宽(cm)" value={numberFromUnknown(dimensions.width_cm)} onChange={value => updateDimension('width_cm', value)} />
      <NumberInput label="高(cm)" value={numberFromUnknown(dimensions.height_cm)} onChange={value => updateDimension('height_cm', value)} />
      <label className="text-[11px] font-medium text-[var(--color-muted)]">
        物流模板
        <input
          value={logistics.shipping_template_id || ''}
          onChange={event => update({ shipping_template_id: event.target.value })}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
        />
      </label>
    </div>
  )
}

export function ComplianceEditor({ draft, onChange }: { draft: BatchListingDraft; onChange: (patch: Partial<BatchListingDraft>) => void }) {
  const compliance = draft.compliance || {}
  const update = (patch: Record<string, unknown>) => onChange({ compliance: { ...compliance, ...patch } })
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-medium text-[var(--color-muted)]">
          成色
          <input
            value={compliance.condition || ''}
            onChange={event => update({ condition: event.target.value })}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
          />
        </label>
        <label className="text-[11px] font-medium text-[var(--color-muted)]">
          禁限售复核
          <input
            value={compliance.restricted_check_status || ''}
            onChange={event => update({ restricted_check_status: event.target.value })}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
          />
        </label>
      </div>
      <label className="text-[11px] font-medium text-[var(--color-muted)]">
        认证 / 合规材料（每行一个）
        <textarea
          value={(compliance.certifications || []).join('\n')}
          onChange={event => update({ certifications: splitLines(event.target.value) })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
        />
      </label>
    </>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (value: number | null) => void }) {
  return (
    <label className="text-[11px] font-medium text-[var(--color-muted)]">
      {label}
      <input
        type="number"
        value={value ?? ''}
        onChange={event => onChange(numberOrNull(event.target.value))}
        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
      />
    </label>
  )
}

function splitLines(value: string) {
  return value.split('\n').map(item => item.trim()).filter(Boolean)
}

export function numberOrNull(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function numberFromUnknown(value: unknown) {
  return typeof value === 'number' ? value : null
}

function stringValue(value: unknown) {
  return value == null ? '' : String(value)
}
