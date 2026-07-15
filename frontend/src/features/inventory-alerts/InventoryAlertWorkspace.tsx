import { useState } from 'react'
import { Plus, AlertTriangle, Bell } from 'lucide-react'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { Button } from '../../components/ui/Button'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import { useAlertLogs, useAlertStats, useInventoryRiskWorkbench } from '../../hooks/useInventoryAlerts'
import { AddRuleModal } from './AddRuleModal'
import { CheckInventoryButton, HistoryTab, InventoryRiskWorkbench, RulesTab } from './InventoryAlertPanels'

export default function InventoryAlertPage() {
  const [tab, setTab] = useState<'rules' | 'history'>('rules')
  const [showAddModal, setShowAddModal] = useState(false)
  const [logStatus, setLogStatus] = useState('')
  const [logSev, setLogSev] = useState('')
  const [logPage, setLogPage] = useState(1)

  const stats = useAlertStats()
  const s = stats.data?.data
  const openAlerts = useAlertLogs({ status: 'open', page: 1, page_size: 8 })
  const riskWorkbench = useInventoryRiskWorkbench()

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="库存预警"
        description="设置安全库存阈值，自动监控库存变化"
        actions={
          <div className="flex items-center gap-2">
            <CheckInventoryButton />
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" /> 添加规则
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="预警规则" value={s?.total_rules ?? 0} icon={<Bell className="w-4 h-4" />} />
        <StatCard label="未处理预警" value={s?.total_open ?? 0} icon={<AlertTriangle className="w-4 h-4" />} />
        <StatCard label="严重" value={s?.critical ?? 0} icon={<AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />} />
        <StatCard label="警告" value={s?.warning ?? 0} icon={<AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />} />
      </div>

      <EvidenceBanner evidence={stats.data} />

      <InventoryRiskWorkbench
        stats={s ?? undefined}
        alerts={openAlerts.data?.data ?? []}
        snapshot={riskWorkbench.data?.data ?? undefined}
        evidence={riskWorkbench.data}
        loading={openAlerts.isLoading || riskWorkbench.isLoading}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-border)' }}>
        <button
          onClick={() => setTab('rules')}
          className="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
          style={{
            color: tab === 'rules' ? 'var(--color-fg)' : 'var(--color-muted)',
            backgroundColor: tab === 'rules' ? 'var(--color-surface)' : 'transparent',
          }}
        >
          预警规则
        </button>
        <button
          onClick={() => setTab('history')}
          className="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
          style={{
            color: tab === 'history' ? 'var(--color-fg)' : 'var(--color-muted)',
            backgroundColor: tab === 'history' ? 'var(--color-surface)' : 'transparent',
          }}
        >
          预警历史
        </button>
      </div>

      {tab === 'rules' ? <RulesTab /> : <HistoryTab status={logStatus} severity={logSev} page={logPage} onStatusChange={setLogStatus} onSevChange={setLogSev} onPageChange={setLogPage} />}

      {showAddModal && <AddRuleModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}
