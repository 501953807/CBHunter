import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="luxury-section-header">
      <div className="min-w-0">
        <p className="luxury-section-kicker">CBHunter V5</p>
        <h1 className="luxury-page-title mt-1 text-2xl font-bold">{title}</h1>
        {description && (
          <p className="luxury-page-description mt-2">{description}</p>
        )}
      </div>
      {actions && <div className="luxury-page-actions">{actions}</div>}
    </div>
  )
}
