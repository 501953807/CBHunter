import { useNavigate, useParams } from "react-router-dom"
import AuditLogTab from "../../pages/settings/AuditLogTab"
import SettingsTasksPage from "../../pages/SettingsTasksPage"
import { useToast } from "../../components/ui/Toast"
import { AIProviderSettings, ProfileSettings } from "./SettingsAccountPanels"
import { AccessControlSettings } from "./SettingsAccessPanel"
import { BillingSettings } from "./SettingsBillingPanel"
import { DictSettingsCRUD, FeeRateSettings } from "./SettingsDataPanels"
import { ConfigQualitySettings } from "./SettingsQualityPanel"
import { ApiKeySettings, WarehouseSettings } from "./SettingsSystemPanels"
import { useFullConfig } from "../../hooks/useConfig"
import { cn } from "../../utils/cn"

const TITLE_MAP: Record<string, string> = {
  profile: "账号信息", access: "权限授权", aiproviders: "AI 引擎",
  dict: "业务字典", fees: "费率与汇率", keys: "接口密钥",
  quality: "配置巡检", billing: "套餐权益", warehouse: "仓储配置", tasks: "系统任务", audit: "审计日志",
}

const SETTINGS_NAV_GROUPS = [
  { title: '基础设置', tabs: ['profile', 'dict'] },
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
        </aside>

        <section className="min-w-0">
          {effectiveTab === 'profile' && <ProfileSettings toast={toast} />}
          {effectiveTab === 'access' && <AccessControlSettings toast={toast} />}
          {effectiveTab === 'aiproviders' && <AIProviderSettings toast={toast} />}
          {effectiveTab === 'dict' && <DictSettingsCRUD toast={toast} />}
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
