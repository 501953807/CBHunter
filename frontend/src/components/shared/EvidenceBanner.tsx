import { Database, TriangleAlert } from 'lucide-react'
import type { ApiResponse } from '../../types/common'
import { labelBusinessCode } from '../../utils/businessLabels'

type EvidenceSource = Pick<ApiResponse, 'status' | 'source_refs' | 'evidence_window' | 'confidence_reason' | 'data_gaps'>

export function EvidenceBanner({ evidence, compact = false }: { evidence?: EvidenceSource | null; compact?: boolean }) {
  if (!evidence || (!evidence.evidence_window && !evidence.confidence_reason && !evidence.data_gaps?.length)) return null

  const gaps = evidence.data_gaps ?? []
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${compact ? 'mb-3 text-[11px]' : 'text-xs'}`}
      style={{ borderColor: gaps.length ? 'var(--color-warning)' : 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1 font-medium text-[var(--color-fg)]">
          <Database className="h-3.5 w-3.5 text-[var(--color-primary)]" /> 数据依据
        </span>
        {evidence.evidence_window && <span>{evidence.evidence_window}</span>}
        <span>来源 {evidence.source_refs?.length ?? 0} 条</span>
      </div>
      {!compact && evidence.confidence_reason && <p className="mt-1 text-[var(--color-muted)]">{evidence.confidence_reason}</p>}
      {gaps.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[var(--color-warning)]">
          <TriangleAlert className="h-3.5 w-3.5" />
          {gaps.map((gap) => <span key={gap} className="rounded bg-[var(--color-warning-light)] px-1.5 py-0.5">{labelBusinessCode(gap)}</span>)}
        </div>
      )}
    </div>
  )
}
