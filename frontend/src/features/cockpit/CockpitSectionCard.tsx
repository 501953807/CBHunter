import type { ReactNode } from 'react'
import { ArrowRight, Database } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { CockpitSourceRef } from '../../types/cockpit'
import { labelBusinessCode } from '../../utils/businessLabels'

interface Props {
  title: string
  icon: ReactNode
  status: 'ready' | 'data_required'
  sourceCount: number
  sourceRefs: CockpitSourceRef[]
  evidenceWindow: string
  gaps: string[]
  onOpen: () => void
  children: ReactNode
}

export function CockpitSectionCard(props: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="flex items-center gap-2">
        <span className="text-[var(--color-primary)]">{props.icon}</span>
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">{props.title}</h2>
        <Badge variant={props.status === 'ready' ? 'success' : 'warning'} className="ml-auto">
          {props.status === 'ready' ? '真实数据' : '待补数据'}
        </Badge>
        <button onClick={props.onOpen} title={`打开${props.title}`}
          className="p-1 text-[var(--color-muted)] hover:text-[var(--color-primary)]">
          <ArrowRight className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.children}
        {props.gaps.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-2">
            {props.gaps.map((gap) => <p key={gap} className="text-[11px] text-[var(--color-warning)]">· {labelBusinessCode(gap)}</p>)}
          </div>
        )}
        <div className="border-t border-[var(--color-border)] pt-2 space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
            <Database className="w-3 h-3" />
            <span>来源 {props.sourceCount} 条</span>
            <span>·</span>
            <span className="truncate">{props.evidenceWindow}</span>
          </div>
          {props.sourceRefs.length > 0 && (
            <p className="text-[11px] font-mono text-[var(--color-muted)] truncate">
              {props.sourceRefs.slice(0, 3).map((ref) => `${ref.type}:${ref.id.slice(0, 8)}`).join(' · ')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
