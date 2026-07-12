import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { storage } from '../utils/storage'
import { logger } from '../utils/logger'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login({ username, password })
      const token = result.data?.token?.access_token
      if (token) {
        storage.set('token', token)
        navigate('/', { replace: true })
      } else {
        setError('登录失败，请重试')
      }
    } catch (error) {
      logger.error('Login failed', error)
      setError('用户名或密码错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm relative z-10">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg"
            style={{ background: 'var(--gradient-accent)' }}>
            <span className="text-[var(--color-primary-text)] text-lg font-bold">CB</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>CBHunter</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--color-muted)' }}>个人多平台电商管理系统</p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl py-7 px-8 space-y-5 shadow-[var(--shadow-md)] border"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--color-fg)' }}
            >
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-200 bg-[var(--color-surface)]"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-fg)',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
              placeholder="输入用户名"
              autoFocus
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--color-fg)' }}
            >
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-200 bg-[var(--color-surface)]"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-fg)',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
              placeholder="输入密码"
            />
          </div>

          {error && (
            <p
              className="text-sm rounded-xl px-3.5 py-2.5 flex items-center gap-2"
              style={{
                color: 'var(--color-danger)',
                background: 'var(--color-danger-light)',
              }}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-text)',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
