import { Component, type ReactNode } from 'react'
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
          className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center"
          style={{ color: 'var(--color-muted)' }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'var(--color-danger-light)' }}>
            <svg className="w-6 h-6" style={{ color: 'var(--color-danger)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>页面加载出错</p>
          <p className="text-xs mt-1">请刷新页面重试</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 text-sm px-4 py-1.5 rounded-lg border transition-colors"
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
