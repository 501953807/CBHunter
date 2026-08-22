import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PlatformFieldGroupEditor, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import type { ListingInstanceMatrixItem, ProductListingMatrix } from '../../api/listing'
import { productImageSrc } from '../../utils/productImages'
import { SectionHeading, type StoreListingEditForm, type VariantEditRow } from './ProductListingEditorChrome'

type FieldEvidenceGap = { key: string; label: string; group: string; state: string }

export function ListingFieldEvidencePanel({ requirements, platform }: { requirements: PlatformRequirementsLike; platform: string }) {
  const gaps = platformFieldEvidenceGaps(requirements)
  const totalGapCount = gaps.category.length + gaps.editPage.length + gaps.api.length
  const recheckNotes = requirements.evidence?.needs_recheck || []

  if (totalGapCount === 0 && recheckNotes.length === 0) {
    return (
      <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3" aria-label="平台字段补证队列">
        <p className="text-xs font-semibold text-[var(--color-fg)]">平台字段补证队列</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">字段资料状态：当前 {platform.toUpperCase()} Listing 字段未标记待补证。发布前仍需按目标店铺类目、平台后台校验和官方接口返回复核。</p>
      </div>
    )
  }

  return (
    <div className="mb-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-bg)] p-3" aria-label="平台字段补证队列">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">平台字段补证队列</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">字段资料状态：{platform.toUpperCase()} 当前类目仍有 {totalGapCount} 个字段需要补证，不能把未实测字段冒充为平台强规则。</p>
        </div>
        <Badge variant="warning">补证后再发布</Badge>
      </div>
      {recheckNotes.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">补证说明</p>
          <ul className="mt-1 space-y-1 text-[11px] text-[var(--color-muted)]">
            {recheckNotes.map(note => <li key={note}>• {note}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <EvidenceGapList title="类目待补证字段" items={gaps.category} emptyText="当前类目字段未标记待补证" />
        <EvidenceGapList title="编辑页待补证字段" items={gaps.editPage} emptyText="当前编辑页字段未标记待补证" />
        <EvidenceGapList title="接口待补证字段" items={gaps.api} emptyText="当前接口字段未标记待补证" />
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-warning)]">补证后再发布：先在对应平台卖家后台确认类目、编辑页字段和接口返回，再更新字段组配置或当前 Listing 属性；未补证字段只作为提示，不作为已确认发布规则。</p>
    </div>
  )
}

export function ListingContinuousEditSections({
  editForm,
  masterImages,
  matrix,
  selectedListing,
  selectedListingImageSet,
  selectedListingRequirements,
  setEditForm,
  setSelectedListingRequirements,
  setVariantRows,
  toggleListingImage,
  variantRows,
}: {
  editForm: StoreListingEditForm
  masterImages: string[]
  matrix: ProductListingMatrix | null
  selectedListing: ListingInstanceMatrixItem
  selectedListingImageSet: Set<string>
  selectedListingRequirements: PlatformRequirementsLike
  setEditForm: (form: StoreListingEditForm) => void
  setSelectedListingRequirements: (requirements: PlatformRequirementsLike) => void
  setVariantRows: (rows: VariantEditRow[]) => void
  toggleListingImage: (url: string) => void
  variantRows: VariantEditRow[]
}) {
  return (
    <div aria-label="当前 Listing 连续编辑分区" data-ui="listing-continuous-edit-sections" data-route-param="listing_section" className="space-y-4">
      <ListingBasicSection editForm={editForm} selectedListing={selectedListing} setEditForm={setEditForm} />
      <ListingDetailSection editForm={editForm} setEditForm={setEditForm} />
      <ListingSalesSection
        editForm={editForm}
        setEditForm={setEditForm}
        setVariantRows={setVariantRows}
        variantRows={variantRows}
      />
      <ListingMediaSection
        editForm={editForm}
        masterImages={masterImages}
        selectedListingImageSet={selectedListingImageSet}
        setEditForm={setEditForm}
        toggleListingImage={toggleListingImage}
      />
      <ListingLogisticsSection editForm={editForm} matrix={matrix} selectedListing={selectedListing} setEditForm={setEditForm} />
      <ListingAttributesSection
        selectedListing={selectedListing}
        selectedListingRequirements={selectedListingRequirements}
        setSelectedListingRequirements={setSelectedListingRequirements}
      />
    </div>
  )
}

function ListingBasicSection({
  editForm,
  selectedListing,
  setEditForm,
}: {
  editForm: StoreListingEditForm
  selectedListing: ListingInstanceMatrixItem
  setEditForm: (form: StoreListingEditForm) => void
}) {
  return (
    <section id="listing-section-basic" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <SectionHeading title="基础信息" note="店铺标题、货源链接和当前平台店铺身份。" />
      <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-3">
          <Input label="店铺专属标题" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
          <Input label="货源链接" value={editForm.sourceUrl} onChange={e => setEditForm({ ...editForm, sourceUrl: e.target.value })} placeholder="如 1688、供应商或采集来源链接，仅保存到当前店铺 Listing" />
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-sm font-semibold text-[var(--color-fg)]">当前店铺覆盖</p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">平台：{selectedListing.platform.toUpperCase()}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">店铺：{selectedListing.store.account_name}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">市场：{selectedListing.store.market || '市场待补'}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">状态：{selectedListing.status}</p>
        </div>
      </div>
    </section>
  )
}

function ListingDetailSection({ editForm, setEditForm }: { editForm: StoreListingEditForm; setEditForm: (form: StoreListingEditForm) => void }) {
  return (
    <section id="listing-section-detail" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <SectionHeading title="商品详情" note="描述、卖点和买家可见的商品说明集中维护。" />
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">店铺专属描述</label>
          <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={5} className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
          <p className="font-semibold text-[var(--color-fg)]">商品详情编写规则</p>
          <p className="mt-2">Listing 详情应围绕标题、卖点、材质、尺寸、使用场景、包装清单和售后说明组织；AI 文案优化后仍要落到当前店铺 Listing 实例，不能直接覆盖其他平台/店铺。</p>
        </div>
      </div>
    </section>
  )
}

function ListingSalesSection({
  editForm,
  setEditForm,
  setVariantRows,
  variantRows,
}: {
  editForm: StoreListingEditForm
  setEditForm: (form: StoreListingEditForm) => void
  setVariantRows: (rows: VariantEditRow[]) => void
  variantRows: VariantEditRow[]
}) {
  return (
    <section id="listing-section-sales" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <SectionHeading title="销售资料/SKU" note="当前店铺售价、库存、SKU 和规格矩阵。" />
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="店铺售价" type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
          <Input label="店铺库存" type="number" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} />
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]" aria-label="促销活动独立模块提示">
          促销折扣是独立活动模块：一个活动可包含多个商品。请到“运营增长 / 促销活动”创建活动、添加商品和维护折扣，当前 Listing 编辑页只维护商品本身的售价和库存。
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-3" aria-label="SKU 变体结构化编辑">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-fg)]">SKU 变体结构化编辑</p>
              <p className="text-xs text-[var(--color-muted)]">按当前店铺 Listing 维护平台 SKU、规格名、库存和售价。</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setVariantRows([...variantRows, { sku: '', name: '', stock: '0', price: '' }])}><Plus className="mr-1 h-4 w-4" />添加变体</Button>
          </div>
          {variantRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">单规格商品可不添加变体。</p>
          ) : variantRows.map((row, index) => (
            <div key={index} className="mb-2 grid grid-cols-1 gap-2 rounded-lg border border-[var(--color-border)] p-2 md:grid-cols-[1fr_1fr_90px_100px_36px]">
              <Input label="平台 SKU" value={row.sku} onChange={e => updateVariantRow(index, { sku: e.target.value }, variantRows, setVariantRows)} />
              <Input label="规格名" value={row.name} onChange={e => updateVariantRow(index, { name: e.target.value }, variantRows, setVariantRows)} placeholder="如：黑色 / L" />
              <Input label="库存" type="number" value={row.stock} onChange={e => updateVariantRow(index, { stock: e.target.value }, variantRows, setVariantRows)} />
              <Input label="售价" type="number" value={row.price} onChange={e => updateVariantRow(index, { price: e.target.value }, variantRows, setVariantRows)} />
              <button type="button" aria-label="删除变体" className="mt-6 text-[var(--color-danger)]" onClick={() => setVariantRows(variantRows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ListingMediaSection({
  editForm,
  masterImages,
  selectedListingImageSet,
  setEditForm,
  toggleListingImage,
}: {
  editForm: StoreListingEditForm
  masterImages: string[]
  selectedListingImageSet: Set<string>
  setEditForm: (form: StoreListingEditForm) => void
  toggleListingImage: (url: string) => void
}) {
  return (
    <section id="listing-section-media" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <SectionHeading title="媒体素材" note="主图、辅图、店铺视频和主档图片复用。" />
      <div className="space-y-3">
        <Input label="店铺视频 URL" value={editForm.videoUrl} onChange={e => setEditForm({ ...editForm, videoUrl: e.target.value })} placeholder="生成或采集的视频素材 URL；平台发布前按 TikTok/Shopee 规则复核格式和大小" />
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">图片 URL（第一张主图，其余辅图）</label>
          <textarea value={editForm.imagesText} onChange={e => setEditForm({ ...editForm, imagesText: e.target.value })} rows={6} className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" placeholder="每行一张真实图片 URL" />
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-3" aria-label="从商品图片选择">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-fg)]">从商品图片选择</p>
              <p className="text-xs text-[var(--color-muted)]">商品主档已入库图片可直接用于当前店铺 Listing；勾选后会写入店铺图片列表。</p>
            </div>
            <span className="text-xs text-[var(--color-muted)]">使用主档图片 {masterImages.filter(url => selectedListingImageSet.has(url)).length}/{masterImages.length}</span>
          </div>
          {masterImages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">商品主档暂无已入库图片；请先到“图片”分区上传或采集图片入库。</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {masterImages.map((url, index) => {
                const selected = selectedListingImageSet.has(url)
                return (
                  <button key={`${url}-${index}`} type="button" onClick={() => toggleListingImage(url)} className={`rounded-xl border p-2 text-left transition ${selected ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}>
                    <img src={productImageSrc(url)} alt="商品主档已入库图片" className="aspect-square w-full rounded-lg object-cover" />
                    <p className="mt-2 truncate text-[11px] text-[var(--color-muted)]">{selected ? '已用于当前 Listing' : '点击使用主档图片'}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
          <p className="font-semibold text-[var(--color-fg)]">视频与图片处理</p>
          <p className="mt-2">当前页先管理 Listing 主图/辅图引用；图片编辑、视频翻译、AI 图生视频等制作动作从内容与刊登模块进入，生成后应回填到当前店铺 Listing。</p>
        </div>
      </div>
    </section>
  )
}

function ListingLogisticsSection({
  editForm,
  matrix,
  selectedListing,
  setEditForm,
}: {
  editForm: StoreListingEditForm
  matrix: ProductListingMatrix | null
  selectedListing: ListingInstanceMatrixItem
  setEditForm: (form: StoreListingEditForm) => void
}) {
  return (
    <section id="listing-section-logistics" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <SectionHeading title="物流与发布" note="包裹重量、尺寸、本地发布计划和平台同步边界。" />
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-sm font-semibold text-[var(--color-fg)]">物流资料</p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">商品主档重量：{matrix?.product_master.weight_g == null ? '待补' : `${matrix.product_master.weight_g}g`}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input label="包裹重量(g)" type="number" value={editForm.packageWeightG} onChange={e => setEditForm({ ...editForm, packageWeightG: e.target.value })} />
            <Input label="物流备注" value={editForm.logisticsNote} onChange={e => setEditForm({ ...editForm, logisticsNote: e.target.value })} placeholder="如平台物流模板、特殊包装说明" />
          </div>
          <p className="mt-3 text-xs font-semibold text-[var(--color-fg)]">包裹长宽高(cm)</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Input label="长" type="number" value={editForm.packageLengthCm} onChange={e => setEditForm({ ...editForm, packageLengthCm: e.target.value })} />
            <Input label="宽" type="number" value={editForm.packageWidthCm} onChange={e => setEditForm({ ...editForm, packageWidthCm: e.target.value })} />
            <Input label="高" type="number" value={editForm.packageHeightCm} onChange={e => setEditForm({ ...editForm, packageHeightCm: e.target.value })} />
          </div>
          <p className="mt-3 text-xs text-[var(--color-muted)]">包裹尺寸：按当前店铺覆盖保存为 shipping_config；发布前必须满足对应平台校验。</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">平台参考：TikTok 编辑页将包裹重量、长宽高作为独立必填物流分区。</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-sm font-semibold text-[var(--color-fg)]">发布边界</p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">发布状态：{selectedListing.platform_publish_status || selectedListing.platform_api_status || '本地草稿'}</p>
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="本地发布计划">
            <p className="text-xs font-semibold text-[var(--color-fg)]">本地发布计划</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-fg)]">
              <label className="inline-flex items-center gap-2"><input type="radio" checked={editForm.publishMode === 'immediate'} onChange={() => setEditForm({ ...editForm, publishMode: 'immediate', scheduledAt: '' })} />立即计划</label>
              <label className="inline-flex items-center gap-2"><input type="radio" checked={editForm.publishMode === 'scheduled'} onChange={() => setEditForm({ ...editForm, publishMode: 'scheduled' })} />定时计划</label>
            </div>
            {editForm.publishMode === 'scheduled' && (
              <div className="mt-3">
                <Input label="定时发布时间" value={editForm.scheduledAt} onChange={e => setEditForm({ ...editForm, scheduledAt: e.target.value })} placeholder="2026-07-16T10:30:00+08:00" />
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-[var(--color-muted)]">当前保存只更新本地 Listing；平台 API 接通后，由平台刊登流程执行同步、更新或定时发布。</p>
        </div>
      </div>
    </section>
  )
}

function ListingAttributesSection({
  selectedListing,
  selectedListingRequirements,
  setSelectedListingRequirements,
}: {
  selectedListing: ListingInstanceMatrixItem
  selectedListingRequirements: PlatformRequirementsLike
  setSelectedListingRequirements: (requirements: PlatformRequirementsLike) => void
}) {
  return (
    <section id="listing-section-attributes" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <SectionHeading title="平台属性" note="按 Shopee / TEMU / TikTok Shop 类目字段组补齐平台要求。" />
      <div className="rounded-lg border border-[var(--color-border)] p-3" aria-label="按三平台字段组编辑">
        <div className="mb-3">
          <p className="text-sm font-semibold text-[var(--color-fg)]">按三平台字段组编辑</p>
          <p className="text-xs text-[var(--color-muted)]">根据当前 Listing 的 `field_groups` 渲染平台字段组编辑，不再要求手工猜属性 Key。</p>
        </div>
        <ListingFieldEvidencePanel requirements={selectedListingRequirements} platform={selectedListing.platform} />
        <PlatformFieldGroupEditor requirements={selectedListingRequirements} onChange={setSelectedListingRequirements} />
      </div>
    </section>
  )
}

function updateVariantRow(index: number, patch: Partial<VariantEditRow>, rows: VariantEditRow[], setRows: (rows: VariantEditRow[]) => void) {
  setRows(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
}

function EvidenceGapList({ title, items, emptyText }: { title: string; items: FieldEvidenceGap[]; emptyText: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
      <p className="text-[11px] font-semibold text-[var(--color-fg)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map(item => (
            <li key={`${item.state}-${item.key}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px]">
              <span className="font-semibold text-[var(--color-fg)]">{item.label}</span>
              <span className="ml-1 text-[var(--color-muted)]">({item.key})</span>
              <p className="mt-0.5 text-[var(--color-muted)]">字段组：{item.group}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function platformFieldEvidenceGaps(requirements: PlatformRequirementsLike) {
  const result: { category: FieldEvidenceGap[]; editPage: FieldEvidenceGap[]; api: FieldEvidenceGap[] } = {
    category: [],
    editPage: [],
    api: [],
  }
  const groups = (requirements.field_groups || []).filter((item): item is { label?: string; id?: string; fields?: Array<{ key?: string; label?: string; evidence_state?: string }> } => Boolean(item && typeof item === 'object'))
  for (const group of groups) {
    for (const field of group.fields || []) {
      const state = field.evidence_state || ''
      const gap = {
        key: field.key || field.label || 'unknown_field',
        label: field.label || field.key || '未命名字段',
        group: group.label || group.id || '未命名字段组',
        state,
      }
      if (state === 'needs_category_recheck') result.category.push(gap)
      if (state === 'needs_edit_page_recheck') result.editPage.push(gap)
      if (state === 'needs_api_recheck') result.api.push(gap)
    }
  }
  return result
}
