import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FilePlus2, WandSparkles } from 'lucide-react'
import {
  confirmContentTaskVersion,
  generateContentTaskCandidate,
  getContentTaskMatrix,
  saveContentTaskVersion,
  type ContentTaskMatrix as TaskMatrix,
  type ContentTaskItem,
  type ContentWorkbenchItem,
} from '../../api/content'
import { Card, CardContent } from '../../components/ui/Card'
import { logger } from '../../utils/logger'

const STATUS_LABELS: Record<string, string> = {
  not_started: '未开始',
  draft_ready: '有候选待确认',
  confirmed: '已人工确认',
}
const SPECIAL_GENERATORS = new Set(['listing_copy', 'video_script'])

export function ContentTaskMatrix({ product, refreshToken = 0 }: { product: ContentWorkbenchItem | null; refreshToken?: number }) {
  const navigate = useNavigate()
  const [matrix, setMatrix] = useState<TaskMatrix | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [activeTaskType, setActiveTaskType] = useState('')
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    if (!product?.id) return
    setError('')
    getContentTaskMatrix(product.id).then((response) => setMatrix(response.data || null)).catch((e: any) => {
      logger.error('Load content task matrix failed', e)
      setError(e?.response?.data?.detail || e?.message || '内容任务矩阵加载失败')
    })
  }

  useEffect(() => {
    setMatrix(null)
    setDrafts({})
    load()
  }, [product?.id, refreshToken])

  const save = async (taskType: string) => {
    const content = drafts[taskType]?.trim()
    if (!product?.id || !content) return
    setSaving(taskType)
    try {
      await saveContentTaskVersion(product.id, taskType, content)
      setDrafts(current => ({ ...current, [taskType]: '' }))
      load()
    } catch (e: any) {
      logger.error('Save content task version failed', e)
      setError(e?.response?.data?.detail || e?.message || '保存失败')
    }
    setSaving('')
  }

  const generate = async (taskType: string) => {
    if (!product?.id) return
    setSaving(taskType)
    try {
      await generateContentTaskCandidate(product.id, {
        task_type: taskType,
        product_name: product.product_name,
        category: product.category,
        platform: product.target_platform,
        market: product.target_market,
        features: product.product_name,
      })
      load()
    } catch (e: any) {
      logger.error('Generate content task candidate failed', e)
      setError(e?.response?.data?.detail || e?.message || '生成候选失败')
    }
    setSaving('')
  }

  const confirmTaskVersion = async (taskType: string, version?: number | null) => {
    if (!product?.id || !version) return
    setSaving(taskType)
    try {
      const response = await confirmContentTaskVersion(product.id, taskType, version)
      setMatrix(response.data || null)
    } catch (e: any) {
      logger.error('Confirm content task version failed', e)
      setError(e?.response?.data?.detail || e?.message || '确认失败')
    }
    setSaving('')
  }

  if (!product) return null
  const tasks = matrix?.tasks || []
  const selectedTask = tasks.find(task => task.task_type === activeTaskType) || tasks[0]

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[var(--color-primary)]" />
            <div>
              <h3 className="font-semibold text-[var(--color-fg)]">Listing 内容任务</h3>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">在当前商品上下文内管理标题、卖点、描述、图片、视频和合规确认。</p>
            </div>
          </div>
          <span className="text-xs text-[var(--color-muted)]">
            定价必做 {matrix?.metrics.required_confirmed ?? matrix?.metrics.confirmed ?? 0}/{matrix?.metrics.required_total ?? matrix?.metrics.total ?? 0}
          </span>
          <span className="text-xs text-[var(--color-muted)]">全部确认 {matrix?.metrics.confirmed || 0}/{matrix?.metrics.total || 0}</span>
          <span className="text-xs text-[var(--color-muted)]">{product.product_name}</span>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        <section aria-label="任务状态分组" className="grid gap-2 md:grid-cols-4">
          <StatusTile label="全部任务" value={tasks.length} active={!activeTaskType} onClick={() => setActiveTaskType('')} />
          <StatusTile label="已人工确认" value={matrix?.metrics.confirmed || 0} tone="success" />
          <StatusTile label="候选待确认" value={matrix?.metrics.draft_ready || 0} tone="warning" />
          <StatusTile label="定价闸门剩余" value={Math.max((matrix?.metrics.required_total || 0) - (matrix?.metrics.required_confirmed || 0), 0)} tone="danger" />
        </section>
        {matrix?.metrics.unconfirmed === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-success)] bg-[var(--color-success-light)] px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
            <p className="mr-auto text-xs text-[var(--color-fg)]">
              七类内容任务已全部确认，商品已进入待定价校验队列。
            </p>
            <button
              onClick={() => navigate(matrix.next_action_route || '/pricing')}
              className="rounded-lg bg-[var(--color-success)] px-3 py-1.5 text-xs text-[var(--color-primary-text)]"
            >
              {matrix.next_action || '进入定价校验'}
            </button>
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="professional-table w-full text-left text-xs" aria-label="Listing 内容任务表格">
              <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">任务</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">最新候选</th>
                  <th className="px-3 py-2 font-medium">闸门</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.task_type} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                    <td className="px-3 py-3">
                      <button onClick={() => setActiveTaskType(task.task_type)} className="text-left">
                        <span className="block font-medium text-[var(--color-fg)]">{task.label}</span>
                        <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{task.task_type} · 版本 {task.version_count}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3"><TaskStatus task={task} /></td>
                    <td className="max-w-[320px] px-3 py-3 text-[var(--color-muted)]">
                      <span className="line-clamp-2">{task.latest_version?.content || '暂无候选，需生成或录入。'}</span>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-muted)]">{task.required_for_pricing ? '定价前必做' : '营销扩展'}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => setActiveTaskType(task.task_type)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[var(--color-fg)]">
                        处理 <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedTask && (
            <aside className="professional-context-rail rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="任务详情诊断">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">任务详情诊断</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{selectedTask.label} · {STATUS_LABELS[selectedTask.status] || selectedTask.status}</p>
                </div>
                <TaskStatus task={selectedTask} />
              </div>
              <div className="mt-3 rounded-lg bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
                <p className="font-medium text-[var(--color-fg)]">定价闸门</p>
                <p className="mt-1">{selectedTask.required_for_pricing ? '必须确认后才允许进入定价校验。' : '不阻断定价，但会影响营销素材完整度。'}</p>
                <p className="mt-2">确认版本：{selectedTask.confirmed_version || '未确认'}；最新版本：{selectedTask.latest_version?.version || '无'}</p>
              </div>
              {selectedTask.latest_version?.content && (
                <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="text-[11px] font-medium text-[var(--color-muted)]">最新候选内容</p>
                  <p className="mt-2 max-h-32 overflow-auto text-xs leading-5 text-[var(--color-fg)]">{selectedTask.latest_version.content}</p>
                </div>
              )}
              <textarea
                className="mt-3 min-h-[112px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)] outline-none"
                placeholder="粘贴或编辑 AI/人工候选内容，保存后再人工确认"
                value={drafts[selectedTask.task_type] || ''}
                onChange={event => setDrafts(current => ({ ...current, [selectedTask.task_type]: event.target.value }))}
              />
              <div className="mt-3 grid gap-2">
                {!SPECIAL_GENERATORS.has(selectedTask.task_type) && (
                  <button onClick={() => generate(selectedTask.task_type)} disabled={saving === selectedTask.task_type} className="rounded-lg border border-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-primary)] disabled:opacity-40">
                    AI生成候选
                  </button>
                )}
                <button onClick={() => save(selectedTask.task_type)} disabled={saving === selectedTask.task_type || !drafts[selectedTask.task_type]?.trim()} className="inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-primary-text)] disabled:opacity-40">
                  <FilePlus2 className="h-3.5 w-3.5" />保存候选
                </button>
                <button onClick={() => confirmTaskVersion(selectedTask.task_type, selectedTask.latest_version?.version)} disabled={saving === selectedTask.task_type || !selectedTask.latest_version} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg)] disabled:opacity-40">
                  确认采用当前候选
                </button>
              </div>
            </aside>
          )}
        </div>
        {matrix?.confidence_reason && <p className="text-[11px] text-[var(--color-muted)]">{matrix.confidence_reason}</p>}
      </CardContent>
    </Card>
  )
}

function StatusTile({ label, value, tone, active, onClick }: { label: string; value: number; tone?: 'success' | 'warning' | 'danger'; active?: boolean; onClick?: () => void }) {
  const color = tone === 'success' ? 'var(--color-success)' : tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-primary)'
  return (
    <button onClick={onClick} className="rounded-xl border px-3 py-2 text-left" style={{ borderColor: active ? color : 'var(--color-border)', background: 'var(--color-bg)' }}>
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold" style={{ color }}>{value}</p>
    </button>
  )
}

function TaskStatus({ task }: { task: ContentTaskItem }) {
  if (task.status === 'confirmed') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] text-[var(--color-success)]"><CheckCircle2 className="h-3 w-3" />已确认</span>
  }
  if (task.status === 'draft_ready') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] text-[var(--color-warning)]"><WandSparkles className="h-3 w-3" />待确认</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger-light)] px-2 py-1 text-[11px] text-[var(--color-danger)]"><AlertTriangle className="h-3 w-3" />未开始</span>
}
