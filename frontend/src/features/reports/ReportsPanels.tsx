import { useState } from "react"
import { AlertTriangle, BarChart3, BellRing, Mail, Plus, Trash2 } from "lucide-react"
import { Card, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { Modal } from "../../components/ui/Modal"
import { EmptyState } from "../../components/ui/EmptyState"
import { useCreateSubscription, useDailyReport, useDeleteSubscription, useDetectAnomalies, useMonthlyReport, useSubscriptions, useWeeklyReport } from "../../hooks/useReports"
import { ReportSection } from "./ReportDisplay"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"

const CHANNEL_LABELS: Record<string, string> = { in_app: "站内通知" }
const FREQ_LABELS: Record<string, string> = { daily: "每日", weekly: "每周", monthly: "每月" }

/* ── Daily Tab ── */
export function DailyTab({ date, setDate }: { date: string; setDate: (v: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const query = date || today
  const report = useDailyReport(query)
  return (
    <>
      <div className="flex items-center gap-3">
        <input type="date" value={date || today} onChange={e => setDate(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }} />
      </div>
      <ReportSection report={report.data} loading={report.isLoading} />
    </>
  )
}

/* ── Weekly Tab ── */
export function WeeklyTab({ weekStart, setWeekStart }: { weekStart: string; setWeekStart: (v: string) => void }) {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  const weekAgo = d.toISOString().slice(0, 10)
  const query = weekStart || weekAgo
  const report = useWeeklyReport(query)
  return (
    <>
      <div className="flex items-center gap-3">
        <input type="date" value={weekStart || weekAgo} onChange={e => setWeekStart(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }} />
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>起止日期</span>
      </div>
      <ReportSection report={report.data} loading={report.isLoading} />
    </>
  )
}

/* ── Monthly Tab ── */
export function MonthlyTab({ month, setMonth }: { month: string; setMonth: (v: string) => void }) {
  const curMonth = new Date().toISOString().slice(0, 7)
  const query = month || curMonth
  const report = useMonthlyReport(query)
  return (
    <>
      <div className="flex items-center gap-3">
        <input type="month" value={month || curMonth} onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }} />
      </div>
      <ReportSection report={report.data} loading={report.isLoading} />
    </>
  )
}

/* ── Anomaly Tab ── */
export function AnomalyTab() {
  const detect = useDetectAnomalies()
  const [result, setResult] = useState<any>(null)

  const handleDetect = () => {
    detect.mutate(undefined, {
      onSuccess: (d) => setResult(d.data),
      onError: () => setResult(null),
    })
  }
  const anomalies = result?.anomalies ?? []
  const financeRisks = anomalies.filter((item: any) => item.metric === 'financial_risk')
  const metricAnomalies = anomalies.filter((item: any) => item.metric !== 'financial_risk')

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            检测当前数据与7日均值的偏差，发现潜在异常
          </p>
          <button onClick={handleDetect} disabled={detect.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-primary-text)] transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--gradient-accent)' }}>
            <AlertTriangle className="w-4 h-4" />
            {detect.isPending ? '检测中...' : '检测异常'}
          </button>
        </div>

        {!result ? (
          <EmptyState icon={<BarChart3 className="w-10 h-10" />} title="点击上方按钮开始检测" />
        ) : anomalies.length === 0 ? (
          <EmptyState icon={<BarChart3 className="w-10 h-10" />} title="未检测到异常" description="当前数据与近期均值一致" />
        ) : (
          <div className="space-y-4">
            {financeRisks.length > 0 && (
              <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3" data-ui="report-finance-anomaly-list">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-fg)]">财务风险异常</p>
                  <Badge variant="warning">{financeRisks.length} 项</Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {financeRisks.map((a: any) => (
                    <div key={a.risk_code || a.title} className="rounded-lg bg-[var(--color-surface)] p-3">
                      <p className="text-sm font-medium text-[var(--color-fg)]">{a.title || a.actual || a.risk_code}</p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">{a.detail || '财务台账风险待复核'}</p>
                      {a.action_route && (
                        <a href={a.action_route} className="mt-2 inline-block text-xs text-[var(--color-primary)]">
                          对策：{a.action_label || '前往财务处理'}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {metricAnomalies.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>指标</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>预期值</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>实际值</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>偏差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricAnomalies.map((a: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="py-2 px-3" style={{ color: 'var(--color-fg)' }}>
                          {a.metric === 'revenue' ? '营收' : a.metric === 'orders' ? '订单数' : a.metric}
                        </td>
                        <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--color-muted)' }}>{a.expected}</td>
                        <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--color-fg)' }}>{a.actual}</td>
                        <td className="py-2 px-3 text-right">
                          <Badge variant={a.deviation_pct > 50 ? 'danger' : 'warning'}>
                            {a.deviation_pct}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ── Subscriptions Tab ── */
export function SubscriptionsTab() {
  const subs = useSubscriptions()
  const create = useCreateSubscription()
  const remove = useDeleteSubscription()
  const confirmAction = useConfirm()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<{ channel: 'in_app'; frequency: string }>({ channel: 'in_app', frequency: '' })

  const items = subs.data?.data ?? []

  const handleRemove = async (id: string) => {
    const ok = await confirmAction({
      title: '取消报表订阅',
      message: '确定取消该报表订阅？取消后不会再按此频率生成站内通知。',
      confirmText: '取消订阅',
      tone: 'warning',
    })
    if (ok) remove.mutate(id)
  }

  return (
    <Card>
      <CardContent>
        <EvidenceBanner evidence={subs.data} compact />
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>设置定期报表推送</p>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[var(--color-border)]"
            style={{ color: 'var(--color-muted)' }}>
            <Plus className="w-4 h-4" /> 添加订阅
          </button>
        </div>

        {subs.isLoading ? (
          <div className="skeleton-shimmer h-32 rounded-xl" />
        ) : items.length === 0 ? (
          <EmptyState icon={<Mail className="w-10 h-10" />} title="暂无订阅" description="点击「添加订阅」设置推送" />
        ) : (
          <div className="space-y-2">
            {items.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3">
                  <BellRing className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                      {CHANNEL_LABELS[s.channel] || s.channel} · {FREQ_LABELS[s.frequency] || s.frequency}
                    </span>
                    <span className="text-xs ml-2" style={{ color: s.enabled ? 'var(--color-success)' : 'var(--color-muted)' }}>
                      {s.enabled ? '已启用' : '已停用'}
                    </span>
                  </div>
                </div>
                <button onClick={() => void handleRemove(s.id)}
                  className="p-1.5 rounded transition-colors hover:bg-[var(--color-border)]"
                  style={{ color: 'var(--color-danger)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showAdd && (
          <Modal open onClose={() => setShowAdd(false)} title="添加报表订阅" size="sm"
            footer={
              <>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg transition-colors hover:bg-[var(--color-border)]"
                  style={{ color: 'var(--color-muted)' }}>取消</button>
                <button onClick={() => { create.mutate(form, { onSuccess: () => setShowAdd(false) }) }}
                  disabled={create.isPending || !form.frequency} className="px-4 py-2 text-sm rounded-lg text-[var(--color-primary-text)] disabled:opacity-40"
                  style={{ backgroundColor: 'var(--color-primary)' }}>
                  {create.isPending ? '创建中...' : '创建'}
                </button>
              </>
            }>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>推送渠道</label>
                <div className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}>
                  站内通知
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>邮件、钉钉和飞书需配置真实发送渠道后再开放。</p>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>推送频率</label>
                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}>
                  <option value="">请选择频率</option>
                  {Object.entries(FREQ_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </Modal>
        )}
      </CardContent>
    </Card>
  )
}
