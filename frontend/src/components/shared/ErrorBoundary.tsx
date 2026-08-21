import { Component, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { logger } from '../../utils/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logger.error('ErrorBoundary caught render error', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          className="materio-error-state flex min-h-[300px] flex-col items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border)] p-8 text-center shadow-[var(--shadow-sm)]"
          style={{ color: 'var(--color-muted)' }}
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'var(--color-danger-light)' }}>
            <AlertCircle className="h-6 w-6" style={{ color: 'var(--color-danger)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>页面加载出错</p>
          <p className="text-xs mt-1">请刷新页面重试</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-[var(--radius-md)] border px-4 py-1.5 text-sm transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-primary)',
            }}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
