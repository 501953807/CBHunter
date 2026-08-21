/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type ConfirmTone = 'default' | 'warning' | 'danger'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: ConfirmTone
}

interface ConfirmRequest extends Required<ConfirmOptions> {
  tone: ConfirmTone
}

type ConfirmHandler = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmHandler | null>(null)

const TONE_STYLES: Record<ConfirmTone, { icon: string; button: string }> = {
  default: { icon: 'var(--color-primary)', button: 'var(--color-primary)' },
  warning: { icon: 'var(--color-warning)', button: 'var(--color-warning)' },
  danger: { icon: 'var(--color-danger)', button: 'var(--color-danger)' },
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  const confirmAction = useCallback<ConfirmHandler>((options) => {
    resolverRef.current?.(false)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setRequest({
        title: options.title || '确认操作',
        message: options.message,
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || '取消',
        tone: options.tone || 'default',
      })
    })
  }, [])

  const close = (confirmed: boolean) => {
    resolverRef.current?.(confirmed)
    resolverRef.current = null
    setRequest(null)
  }

  const tone = request ? TONE_STYLES[request.tone] : TONE_STYLES.default

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          style={{ backgroundColor: 'var(--color-overlay)' }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="materio-dialog w-full max-w-md rounded-[var(--radius-md)] border p-5 shadow-[var(--materio-elevation-3)]"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--color-bg)', color: tone.icon }}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-dialog-title" className="text-base font-semibold text-[var(--color-fg)]">
                  {request.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{request.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-[var(--radius-md)] border px-4 py-2 text-sm transition-colors hover:bg-[var(--color-bg)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
              >
                {request.cancelText}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className="rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium text-[var(--color-primary-text)] transition-opacity hover:opacity-90"
                style={{ backgroundColor: tone.button }}
              >
                {request.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider')
  return context
}
