import { cn } from '../../utils/cn'
import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('luxury-card rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform,background] duration-200', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-[var(--color-hairline)] px-5 py-4', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}
