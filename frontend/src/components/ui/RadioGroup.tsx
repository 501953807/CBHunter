import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface RadioOption {
  value: string
  label: ReactNode
  description?: ReactNode
}

interface RadioGroupProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  name: string
  value?: string
  options: RadioOption[]
  onChange?: (value: string) => void
  orientation?: 'horizontal' | 'vertical'
}

export function RadioGroup({ name, value, options, onChange, orientation = 'vertical', className, disabled, ...props }: RadioGroupProps) {
  return (
    <div className={cn('materio-radio-group', orientation === 'horizontal' && 'is-horizontal', className)} role="radiogroup">
      {options.map(option => (
        <label key={option.value} className={cn('materio-check-control', disabled && 'is-disabled')}>
          <input
            {...props}
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange?.(option.value)}
            className="materio-radio-input"
          />
          <span className="materio-radio-visual" aria-hidden="true" />
          <span className="materio-check-copy">
            <span className="materio-check-label">{option.label}</span>
            {option.description && <span className="materio-check-description">{option.description}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}
