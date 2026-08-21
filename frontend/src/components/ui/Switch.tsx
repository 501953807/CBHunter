import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
}

export function Switch({ className, label, description, id, ...props }: SwitchProps) {
  return (
    <label className={cn('materio-switch-control', props.disabled && 'is-disabled')}>
      <input id={id} type="checkbox" role="switch" className={cn('materio-switch-input', className)} {...props} />
      <span className="materio-switch-track" aria-hidden="true">
        <span className="materio-switch-thumb" />
      </span>
      {(label || description) && (
        <span className="materio-check-copy">
          {label && <span className="materio-check-label">{label}</span>}
          {description && <span className="materio-check-description">{description}</span>}
        </span>
      )}
    </label>
  )
}
