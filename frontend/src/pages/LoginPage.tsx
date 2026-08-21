import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { mdiLockOutline, mdiLoginVariant, mdiAccountOutline } from '@mdi/js'
import { login } from '../api/auth'
import { storage } from '../utils/storage'
import { logger } from '../utils/logger'
import { AuthShell } from '../components/shared/AuthShell'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { MdiIcon } from '../components/ui/MdiIcon'

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
    <AuthShell
      eyebrow="Welcome back"
      title="登录 CBHunter 工作台"
      description="使用系统账号进入多平台跨境运营后台。"
    >
      <form onSubmit={handleSubmit} className="auth-v2-form">
        <Input
          label="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="admin"
          autoFocus
          className="auth-v2-input"
        />
        <Input
          label="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="输入登录密码"
          className="auth-v2-input"
        />
        <div className="auth-v2-row">
          <label className="auth-v2-check">
            <input type="checkbox" />
            <span>保持登录状态</span>
          </label>
          <Link to="/forgot-password">忘记密码？</Link>
        </div>
        {error && <p className="auth-v2-error">{error}</p>}
        <Button type="submit" disabled={loading || !username || !password} className="w-full">
          <MdiIcon path={mdiLoginVariant} size={0.82} />
          {loading ? '登录中...' : '登录'}
        </Button>
        <div className="auth-v2-divider"><span>New on CBHunter?</span></div>
        <Link to="/register" className="auth-v2-secondary-action">
          <MdiIcon path={mdiAccountOutline} size={0.82} />
          创建账号
        </Link>
        <p className="auth-v2-helper">
          默认管理员账号仍为 <span>admin / Admin@123</span>。生产环境请在设置中心完成密码与权限治理。
        </p>
      </form>
      <div className="auth-v2-security-note">
        <MdiIcon path={mdiLockOutline} size={0.85} />
        登录只复用现有 JWT 鉴权流程，本次改造不改变认证业务逻辑。
      </div>
    </AuthShell>
  )
}
