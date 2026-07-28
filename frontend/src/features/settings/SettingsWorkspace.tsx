import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import AuditLogTab from "../../pages/settings/AuditLogTab"
import SettingsTasksPage from "../../pages/SettingsTasksPage"
import { useToast } from "../../components/ui/Toast"
import { getConfigQuality, type ConfigQuality } from "../../api/config"
import { AIProviderSettings, ProfileSettings } from "./SettingsAccountPanels"
import { AccessControlSettings } from "./SettingsAccessPanel"
import { BillingSettings } from "./SettingsBillingPanel"
import { DictSettingsCRUD, FeeRateSettings, FieldDictionarySettings } from "./SettingsDataPanels"
import { ConfigQualitySettings } from "./SettingsQualityPanel"
import { ApiKeySettings, WarehouseSettings } from "./SettingsSystemPanels"
import { useFullConfig } from "../../hooks/useConfig"
import { cn } from "../../utils/cn"
import { logger } from "../../utils/logger"

const TITLE_MAP: Record<string, string> = {
  profile: "账号信息", access: "权限授权", aiproviders: "AI 引擎",
  dict: "业务字典", fields: "字段字典", fees: "费率与汇率", keys: "接口密钥",
  quality: "配置巡检", billing: "套餐权益", warehouse: "仓储配置", tasks: "系统任务", audit: "审计日志",
}

const SETTINGS_NAV_GROUPS = [
  { title: '基础设置', tabs: ['profile', 'dict', 'fields'] },
  { title: '业务参数', tabs: ['fees', 'warehouse', 'keys', 'quality'] },
  { title: '智能与订阅', tabs: ['aiproviders', 'billing'] },
  { title: '治理审计', tabs: ['access', 'tasks', 'audit'] },
]

export default function SettingsPage() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const config = useFullConfig()
  const governanceTabs = new Set(['access', 'tasks', 'audit'])
  const canViewGovernance = config.loading || config.permissions.is_admin
  const activeTab = tab || 'profile'
  const visibleTabIds = new Set(Object.keys(TITLE_MAP).filter((id) => canViewGovernance || !governanceTabs.has(id)))
  const requestedTab = visibleTabIds.has(activeTab) ? activeTab : 'profile'
  const effectiveTab = !canViewGovernance && governanceTabs.has(requestedTab) ? 'profile' : requestedTab
  const toast = useToast()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>设置中心</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>{TITLE_MAP[effectiveTab] || '账号信息'} · 系统设置与配置管理</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-max rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          {SETTINGS_NAV_GROUPS.map((group) => {
            const tabs = group.tabs.filter((id) => visibleTabIds.has(id))
            if (tabs.length === 0) return null
            return (
              <div key={group.title} className="mb-4 last:mb-0">
                <div className="mb-2 px-2 text-[11px] font-semibold text-[var(--color-muted)]">{group.title}</div>
                <div className="space-y-1">
                  {tabs.map((id) => (
                    <button
                      key={id}
                      onClick={() => navigate(`/settings/${id}`)}
                      className={cn(
                        'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        effectiveTab === id
                          ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                          : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]'
                      )}
                    >
                      {TITLE_MAP[id]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="mt-4 rounded-lg bg-[var(--color-bg)] p-3 text-[11px] leading-5 text-[var(--color-muted)]">
            网络状态和主题切换已并入顶部系统框架；平台同步由右上角“平台同步”统一触发。
          </div>
          <SettingsQualitySummary onOpen={() => navigate('/settings/quality')} onOpenFees={() => navigate('/settings/fees')} />
        </aside>

        <section className="min-w-0">
          {effectiveTab === 'profile' && <ProfileSettings toast={toast} />}
          {effectiveTab === 'access' && <AccessControlSettings toast={toast} />}
          {effectiveTab === 'aiproviders' && <AIProviderSettings toast={toast} />}
          {effectiveTab === 'dict' && <DictSettingsCRUD toast={toast} />}
          {effectiveTab === 'fields' && <FieldDictionarySettings />}
          {effectiveTab === 'fees' && <FeeRateSettings toast={toast} />}
          {effectiveTab === 'keys' && <ApiKeySettings toast={toast} />}
          {effectiveTab === 'quality' && <ConfigQualitySettings toast={toast} />}
          {effectiveTab === 'billing' && <BillingSettings toast={toast} />}
          {effectiveTab === 'warehouse' && <WarehouseSettings toast={toast} />}
          {effectiveTab === 'tasks' && <SettingsTasksPage />}
          {effectiveTab === 'audit' && <AuditLogTab />}
        </section>
      </div>
    </div>
  )
}

function SettingsQualitySummary({ onOpen, onOpenFees }: { onOpen: () => void; onOpenFees: () => void }) {
  const [quality, setQuality] = useState<ConfigQuality | null>(null)

  useEffect(() => {
    getConfigQuality()
      .then((res) => setQuality(res.data || null))
      .catch((e: any) => logger.error('Load settings quality summary failed', e))
  }, [])

  const checks = quality?.checks || []
  const ready = checks.filter((item) => item.status === 'ready').length
  const total = checks.length
  const gapCount = quality?.data_gaps?.length || 0
  const score = total ? Math.round((ready / total) * 100) : null
  const statusText = quality?.status === 'ready' ? '配置可用' : gapCount ? `${gapCount} 个缺口` : '等待巡检'

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">配置健康度</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">{statusText}</p>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-1 text-[11px] font-semibold',
            quality?.status === 'ready'
              ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
              : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
          )}
        >
          {score == null ? '--' : `${score}%`}
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-left text-[11px] text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
      >
        进入配置巡检
      </button>
      <button
        type="button"
        onClick={onOpenFees}
        className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-left text-[11px] text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
      >
        配置费率与汇率
      </button>
    </div>
  )
}
