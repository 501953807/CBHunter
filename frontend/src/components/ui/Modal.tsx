import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] dark:bg-[var(--color-overlay-strong)] transition-all"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        className={cn(
          'bg-[var(--color-surface)] rounded-xl shadow-[var(--shadow-lg)] max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 transition-colors',
          {
            'max-w-sm': size === 'sm',
            'max-w-lg': size === 'md',
            'max-w-2xl': size === 'lg',
          }
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <h3 className="text-lg font-semibold text-[var(--color-fg)]">{title}</h3>
            <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-4 flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
