import type { ReactNode } from 'react'
import { MdiIcon } from '../ui/MdiIcon'
import {
  mdiChartTimelineVariant,
  mdiShieldCheckOutline,
  mdiStorefrontOutline,
} from '@mdi/js'

interface AuthShellProps {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  asideTitle?: string
  asideDescription?: string
}

const AUTH_HIGHLIGHTS = [
  { icon: mdiStorefrontOutline, label: '多平台店铺', value: 'Shopee · TEMU · TikTok Shop' },
  { icon: mdiChartTimelineVariant, label: '业务闭环', value: '选品 · Listing · 订单 · 财务' },
  { icon: mdiShieldCheckOutline, label: '风险治理', value: '履约超期 · 平台规则 · 经营异常' },
]

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  asideTitle = 'CBHunter Cross-border ERP',
  asideDescription = '把多平台商品、订单、履约、利润和风险集中到一个运营工作台。',
}: AuthShellProps) {
  return (
    <main className="auth-v2-shell">
      <section className="auth-v2-visual" aria-label="系统能力概览">
        <div className="auth-v2-brand">
          <span className="auth-v2-brand-mark">CB</span>
          <span>CBHunter</span>
        </div>
        <div className="auth-v2-hero-card">
          <p className="materio-eyebrow">Unified Commerce Console</p>
          <h1>{asideTitle}</h1>
          <p>{asideDescription}</p>
          <div className="auth-v2-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="auth-v2-highlight-grid">
          {AUTH_HIGHLIGHTS.map(item => (
            <article key={item.label} className="auth-v2-highlight">
              <span className="auth-v2-highlight-icon">
                <MdiIcon path={item.icon} size={0.9} />
              </span>
              <div>
                <p>{item.label}</p>
                <span>{item.value}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="auth-v2-panel" aria-label={title}>
        <div className="auth-v2-card">
          <div className="auth-v2-heading">
            <p>{eyebrow}</p>
            <h2>{title}</h2>
            <span>{description}</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}
