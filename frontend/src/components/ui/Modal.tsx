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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-[4px] dark:bg-[var(--color-overlay-strong)] transition-all"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        className={cn(
          'luxury-modal-panel max-h-[90vh] w-[calc(100vw-2rem)] flex flex-col animate-in fade-in zoom-in-95 rounded-[var(--radius-xl)] transition-colors',
          {
            'max-w-sm': size === 'sm',
            'max-w-lg': size === 'md',
            'max-w-2xl': size === 'lg',
          }
        )}
      >
        {title && (
          <div className="flex items-start justify-between border-b border-[var(--color-hairline)] px-6 py-5">
            <div>
              <p className="luxury-section-kicker">Dialog</p>
              <h3 className="mt-1 text-[18px] font-semibold tracking-tight text-[var(--color-fg)]">{title}</h3>
            </div>
            <button onClick={onClose} className="luxury-modal-close rounded-full p-2" aria-label="关闭弹窗">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-hairline)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
