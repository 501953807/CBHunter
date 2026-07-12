import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/shared/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
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
    <div className="space-y-6 page-enter">
      <PageHeader title="报表中心" description="经营日报、周期复盘、异常检测与订阅管理" />

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
