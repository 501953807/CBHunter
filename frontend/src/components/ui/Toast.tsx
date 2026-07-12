import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../../utils/cn'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

export interface ToastContextType {
  addToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLORS = {
  success: 'border-l-[var(--color-success)] bg-[var(--color-success-light)] text-[var(--color-success)]',
  error: 'border-l-[var(--color-danger)] bg-[var(--color-danger-light)] text-[var(--color-danger)]',
  warning: 'border-l-[var(--color-warning)] bg-[var(--color-warning-light)] text-[var(--color-warning)]',
  info: 'border-l-[var(--color-info)] bg-[var(--color-info-light)] text-[var(--color-info)]',
}

const ICON_COLORS = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-info)]',
}

function ToastItem({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const Icon = ICONS[toast.type]
  useEffect(() => {
    if (toast.type === 'success' || toast.type === 'info') {
      const timer = setTimeout(() => onRemove(toast.id), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast, onRemove])

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg border-l-4 shadow-md min-w-[300px] max-w-sm animate-in slide-in-from-right',
        COLORS[toast.type]
      )}
    >
      <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', ICON_COLORS[toast.type])} />
      <p className="text-sm flex-1">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
