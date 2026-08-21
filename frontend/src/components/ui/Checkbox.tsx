import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ className, label, description, id, ...props }, ref) {
  return (
    <label className={cn('materio-check-control', props.disabled && 'is-disabled')}>
      <input ref={ref} id={id} type="checkbox" className={cn('materio-check-input', className)} {...props} />
      <span className="materio-check-visual" aria-hidden="true" />
      {(label || description) && (
        <span className="materio-check-copy">
          {label && <span className="materio-check-label">{label}</span>}
          {description && <span className="materio-check-description">{description}</span>}
        </span>
      )}
    </label>
  )
})
