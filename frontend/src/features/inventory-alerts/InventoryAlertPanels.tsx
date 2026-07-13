import { Bell, CheckCheck, Trash2 } from "lucide-react"
import { Card, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { EmptyState } from "../../components/ui/EmptyState"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import { useAcknowledgeAlert, useAlertLogs, useAlertRules, useCheckInventory, useClearAlert, useDeleteAlertRule, useUpdateAlertRule } from "../../hooks/useInventoryAlerts"
import { useConfig } from "../../hooks/useConfig"

type DictOption = { id: string; label: string }

function optionLabel(options: DictOption[] = [], id: string) {
  return options.find(item => item.id === id)?.label || id || "—"
}

/* ── Check Inventory Button ── */
export function CheckInventoryButton() {
  const check = useCheckInventory()
  return (
    <button
      onClick={() => check.mutate()}
      disabled={check.isPending}
      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors hover:bg-[var(--color-border)] disabled:opacity-50"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
    >
      <Bell className={`w-3.5 h-3.5 ${check.isPending ? 'animate-pulse' : ''}`} />
      扫描库存
    </button>
  )
}

/* ── Rules Tab ── */
export function RulesTab() {
  const rules = useAlertRules()
  const updateRule = useUpdateAlertRule()
  const deleteRule = useDeleteAlertRule()
  const confirmAction = useConfirm()
  const { inventory_alert_severities = [] } = useConfig()
  const items = (rules.data?.data ?? []) as any[]

  if (rules.isLoading) {
    return <div className="skeleton-shimmer h-48 rounded-xl" />
  }

  const handleDeleteRule = async (id: string) => {
    const ok = await confirmAction({
      title: '删除库存预警规则',
      message: '确定删除此规则？删除后该 SKU 不会再按此阈值触发库存预警。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (ok) deleteRule.mutate(id)
  }

  return (
    <Card>
      <CardContent>
        <EvidenceBanner evidence={rules.data} compact />
        {items.length === 0 ? (
          <EmptyState icon={<Bell className="w-10 h-10" />} title="暂无预警规则" description="点击「添加规则」设置库存阈值" />
        ) : (
          <div className="overflow-x-auto">
            <table className="professional-table w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>SKU</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>商品名称</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>安全库存</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>严重程度</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>状态</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((rule: any) => (
                  <tr key={rule.id} className="transition-colors hover:bg-[var(--color-bg)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="py-2.5 px-3" style={{ color: 'var(--color-fg)' }}>{rule.sku}</td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>{rule.product_name}</td>
                    <td className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-fg)' }}>{rule.safety_stock}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={rule.severity === 'critical' ? 'danger' : rule.severity === 'warning' ? 'warning' : 'info'}>
                        {optionLabel(inventory_alert_severities, rule.severity)}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-xs" style={{ color: rule.enabled ? 'var(--color-success)' : 'var(--color-muted)' }}>
                        {rule.enabled ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => updateRule.mutate({ id: rule.id, enabled: !rule.enabled })}
                          className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-border)]"
                          style={{ color: 'var(--color-muted)' }}
                        >
                          {rule.enabled ? '禁用' : '启用'}
                        </button>
                        <button
                          onClick={() => void handleDeleteRule(rule.id)}
                          className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-border)]"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ── History Tab ── */
export function HistoryTab({ status, severity, page, onStatusChange, onSevChange, onPageChange }: {
  status: string; severity: string; page: number;
  onStatusChange: (v: string) => void; onSevChange: (v: string) => void; onPageChange: (v: number) => void;
}) {
  const logs = useAlertLogs({ status: status || undefined, severity: severity || undefined, page, page_size: 20 })
  const ack = useAcknowledgeAlert()
  const clear = useClearAlert()
  const { inventory_alert_statuses = [], inventory_alert_severities = [] } = useConfig()
  const items = (logs.data?.data ?? []) as any[]
  const meta = logs.data?.meta

  return (
    <Card>
      <CardContent>
        <EvidenceBanner evidence={logs.data} compact />
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={status}
            onChange={(e) => { onStatusChange(e.target.value); onPageChange(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }}
          >
            <option value="">全部状态</option>
            {inventory_alert_statuses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select
            value={severity}
            onChange={(e) => { onSevChange(e.target.value); onPageChange(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }}
          >
            <option value="">全部级别</option>
            {inventory_alert_severities.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>时间</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>SKU</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>商品</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>当前库存</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>阈值</th>
                <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>级别</th>
                <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>状态</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center" style={{ color: 'var(--color-muted)' }}>加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={<Bell className="h-9 w-9" />} title="暂无预警记录" description="先配置库存规则并执行扫描；没有真实库存时会保留数据缺口。" /></td></tr>
              ) : (
                items.map((item: any) => (
                  <tr key={item.id} className="transition-colors hover:bg-[var(--color-bg)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }) : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs" style={{ color: 'var(--color-fg)' }}>{item.sku}</td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>{item.product_name}</td>
                    <td className="py-2.5 px-3 text-right font-mono" style={{ color: item.current_stock < item.threshold ? 'var(--color-danger)' : 'var(--color-fg)' }}>
                      {item.current_stock}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-muted)' }}>{item.threshold}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warning' : 'info'}>
                        {optionLabel(inventory_alert_severities, item.severity)}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-xs" style={{
                        color: item.status === 'open' ? 'var(--color-danger)' : item.status === 'acknowledged' ? 'var(--color-warning)' : 'var(--color-success)'
                      }}>
                        {optionLabel(inventory_alert_statuses, item.status)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === 'open' && (
                          <button onClick={() => ack.mutate(item.id)} className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-border)]"
                            style={{ color: 'var(--color-warning)' }}>
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.status !== 'cleared' && (
                          <button onClick={() => clear.mutate(item.id)} className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-border)]"
                            style={{ color: 'var(--color-success)' }}>
                            清除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>共 {meta.total} 条</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
                className="text-xs px-3 py-1.5 rounded-md border disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>上一页</button>
              <button disabled={page >= meta.total_pages} onClick={() => onPageChange(page + 1)}
                className="text-xs px-3 py-1.5 rounded-md border disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>下一页</button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
