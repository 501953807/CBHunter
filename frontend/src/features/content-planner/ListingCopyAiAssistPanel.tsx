import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ContentWorkbenchItem } from '../../api/content'

export function ListingCopyAiAssistPanel({
  product,
  draft,
  sourceBullets,
  updateDraft,
}: {
  product: ContentWorkbenchItem | null
  draft: Record<string, string>
  sourceBullets: string[]
  updateDraft: (field: string, value: string) => void
}) {
  const titleCandidate = buildTitleCandidate(product, draft)
  const descriptionCandidate = buildDescriptionCandidate(product, draft, sourceBullets)

  return (
    <div className="space-y-4" data-ui="listing-copy-field-ai-assist-panel" aria-label="Listing 标题和描述字段旁 AI 辅助">
      <FieldBlock label="商品名称 / Listing 标题" required>
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
            <input id="listing-field-title" value={draft.title || ''} onChange={event => updateDraft('title', event.target.value)} placeholder="按目标平台字数、关键词和类目规则编辑商品标题" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--color-fg)] outline-none" />
            <span className="border-l border-[var(--color-border)] px-3 py-2.5 text-xs text-[var(--color-muted)]">{(draft.title || '').length}/255</span>
          </div>
          <CandidateCard
            title="AI 标题候选"
            content={titleCandidate || '选择商品后，根据品牌、材质、风格、颜色和类目生成标题候选。'}
            disabled={!product || !titleCandidate}
            onApply={() => updateDraft('title', titleCandidate)}
          />
        </div>
      </FieldBlock>
      <FieldBlock label="商品描述 / 图文详情" required>
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
            <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">按平台规则填写材质、尺寸、场景、包装、使用和售后说明</div>
            <textarea id="listing-field-description" value={draft.description || ''} onChange={event => updateDraft('description', event.target.value)} placeholder="商品描述支持纯文本。图文详情图片在上方图片素材中管理；正式发布前按目标平台字段映射。" className="min-h-[260px] w-full bg-transparent px-3 py-3 text-sm leading-6 text-[var(--color-fg)] outline-none" />
          </div>
          <CandidateCard
            title="AI 描述候选"
            content={descriptionCandidate || '选择商品后，根据标题、类目、材质、规格和卖点摘要生成商品描述候选。'}
            disabled={!product || !descriptionCandidate}
            onApply={() => updateDraft('description', descriptionCandidate)}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">AI 只生成候选，点击采用后仍是草稿</span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">图文素材通过图片槽位引用</span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">发布时按平台字段映射</span>
        </div>
      </FieldBlock>
    </div>
  )
}

function CandidateCard({ title, content, disabled, onApply }: { title: string; content: string; disabled: boolean; onApply: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs" data-ui="listing-field-ai-candidate-card">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)]"><Sparkles className="h-3.5 w-3.5" />{title}</p>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">候选未写入</span>
      </div>
      <p className="mt-2 line-clamp-5 leading-5 text-[var(--color-muted)]">{content}</p>
      <button type="button" onClick={onApply} disabled={disabled} className="mt-3 w-full rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-1.5 font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40">
        采用候选到当前字段
      </button>
    </div>
  )
}

function FieldBlock({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--color-fg)]">{required && <span className="text-[var(--color-danger)]">* </span>}{label}</span>
      {children}
    </label>
  )
}

function buildTitleCandidate(product: ContentWorkbenchItem | null, draft: Record<string, string>) {
  if (!product) return ''
  const parts = [draft.brand && draft.brand !== 'No Brand' ? draft.brand : '', product.product_name, draft.material, draft.style, draft.color, draft.category].filter(Boolean)
  return Array.from(new Set(parts)).join(' ').slice(0, 255)
}

function buildDescriptionCandidate(product: ContentWorkbenchItem | null, draft: Record<string, string>, sourceBullets: string[]) {
  if (!product) return ''
  return [
    `${draft.title || product.product_name}。`,
    draft.category ? `适用类目：${draft.category}。` : '',
    draft.material ? `主要材质：${draft.material}。` : '',
    draft.size ? `规格尺寸：${draft.size}。` : '',
    draft.capacity ? `容量信息：${draft.capacity}。` : '',
    sourceBullets.length ? `已确认卖点摘要：${sourceBullets.join('；')}。` : '',
    '请在发布前按目标平台要求补齐包装清单、使用说明、售后说明和禁限售信息。',
  ].filter(Boolean).join('\n')
}
