import { cn } from '../../utils/cn'
import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('materio-card luxury-card rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform,background] duration-200', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('materio-card-header border-b border-[var(--color-hairline)] px-5 py-4', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('materio-card-content px-5 py-4', className)} {...props} />
}
