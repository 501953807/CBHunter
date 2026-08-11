import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/shared/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card, CardContent } from '../../components/ui/Card'
import { Tabs } from '../../components/ui/Tabs'
import { useDailyReport, useMonthlyReport, useSubscriptions, useWeeklyReport } from '../../hooks/useReports'
import { AnomalyTab, DailyTab, MonthlyTab, SubscriptionsTab, WeeklyTab } from './ReportsPanels'

type ReportView = 'daily' | 'weekly' | 'monthly' | 'anomaly' | 'subscriptions'
const REPORT_VIEWS: { id: ReportView; label: string }[] = [
  { id: 'daily', label: '日报' },
  { id: 'weekly', label: '周报' },
  { id: 'monthly', label: '月报' },
  { id: 'anomaly', label: '异常检测' },
  { id: 'subscriptions', label: '订阅管理' },
]

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('view')
  const validTab = REPORT_VIEWS.some((item) => item.id === requestedTab) ? requestedTab as ReportView : 'daily'
  const [tab, setTab] = useState<ReportView>(validTab)
  const [date, setDate] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [month, setMonth] = useState('')

  return (
    <div className="reports-shell space-y-6 page-enter">
      <PageHeader title="报表中心" description="经营日报、周期复盘、异常检测与订阅管理" />

      <ReportOperationsPanel />

      <Tabs
        tabs={REPORT_VIEWS}
        activeTab={tab}
        onChange={(next) => {
          setTab(next as ReportView)
          setSearchParams(next === 'daily' ? {} : { view: next })
        }}
      />

      {tab === 'daily' && <DailyTab date={date} setDate={setDate} />}
      {tab === 'weekly' && <WeeklyTab weekStart={weekStart} setWeekStart={setWeekStart} />}
      {tab === 'monthly' && <MonthlyTab month={month} setMonth={setMonth} />}
      {tab === 'anomaly' && <AnomalyTab />}
      {tab === 'subscriptions' && <SubscriptionsTab />}
    </div>
  )
}

function ReportOperationsPanel() {
  const today = new Date().toISOString().slice(0, 10)
  const week = new Date()
  week.setDate(week.getDate() - 7)
  const weekStart = week.toISOString().slice(0, 10)
  const month = today.slice(0, 7)

  const daily = useDailyReport(today)
  const weekly = useWeeklyReport(weekStart)
  const monthly = useMonthlyReport(month)
  const subscriptions = useSubscriptions()

  const reports = [
    { label: '日报生成', period: today, report: daily.data, loading: daily.isLoading },
    { label: '周报生成', period: `${weekStart} 起`, report: weekly.data, loading: weekly.isLoading },
    { label: '月报生成', period: month, report: monthly.data, loading: monthly.isLoading },
  ]
  const subscriptionsCount = subscriptions.data?.data?.filter(item => item.enabled).length ?? 0
  const maxRevenue = Math.max(1, ...reports.map(item => item.report?.data?.summary?.total_revenue ?? 0))

  return (
    <Card className="reports-operations-panel">
      <CardContent>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">report operations</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--color-fg)]">报表生成与订阅管理</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              统一查看日报、周报、月报生成状态和订阅管理；经营图表只展示接口返回的报表汇总，缺数据时保留空状态。
            </p>
          </div>
          <Badge variant={subscriptionsCount ? 'success' : 'outline'}>订阅管理 {subscriptionsCount} 个启用</Badge>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {reports.map(item => {
            const summary = item.report?.data?.summary
            return (
              <div key={item.label} className="reports-summary-card rounded-[var(--radius-lg)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-fg)]">{item.label}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{item.period}</p>
                  </div>
                  <Badge variant={item.loading ? 'outline' : item.report?.data ? 'success' : 'warning'}>
                    {item.loading ? '加载中' : item.report?.data ? '已生成' : '待生成'}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Metric label="订单" value={summary?.total_orders ?? 0} />
                  <Metric label="收入" value={`¥${Math.round(summary?.total_revenue ?? 0)}`} />
                  <Metric label="利润" value={summary?.gross_profit == null ? '—' : `¥${Math.round(summary.gross_profit)}`} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="reports-chart-panel mt-4 rounded-[var(--radius-lg)] p-4" data-ui="report-business-chart">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">经营数据趋势图</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">按当前日报、周报、月报接口返回收入绘制；不使用 mock 数据。</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {reports.map(item => {
              const revenue = item.report?.data?.summary?.total_revenue ?? 0
              const width = Math.max(4, Math.round((revenue / maxRevenue) * 100))
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--color-fg)]">{item.label.replace('生成', '')}</span>
                    <span className="text-[var(--color-muted)]">¥{Math.round(revenue)}</span>
                  </div>
                  <div className="reports-progress-track h-3 overflow-hidden rounded-full">
                    <div className="reports-progress-bar h-full rounded-full transition-all" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="reports-metric-tile rounded-[var(--radius-md)] px-2 py-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 truncate font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}
