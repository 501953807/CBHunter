import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { mdiAccountPlusOutline, mdiEmailCheckOutline } from '@mdi/js'
import { register } from '../api/auth'
import { storage } from '../utils/storage'
import { logger } from '../utils/logger'
import { AuthShell } from '../components/shared/AuthShell'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { MdiIcon } from '../components/ui/MdiIcon'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await register({
        username: form.username,
        display_name: form.display_name || undefined,
        email: form.email,
        password: form.password,
      })
      const token = result.data?.token?.access_token
      if (token) storage.set('token', token)
      navigate('/verify-email', { replace: true, state: { email: form.email, phone: form.phone } })
    } catch (error) {
      logger.error('Register failed', error)
      setError('注册失败，请检查用户名、邮箱或密码是否符合要求')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Create account"
      title="创建 CBHunter 账号"
      description="注册后进入邮箱验证页面；手机号先作为前端联系字段保留。"
      asideTitle="把运营账号纳入统一治理"
      asideDescription="新账号后续可在设置中心绑定角色、权限和店铺访问范围。"
    >
      <form onSubmit={handleSubmit} className="auth-v2-form">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="用户名" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="operator" />
          <Input label="显示名称" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="运营人员姓名" />
        </div>
        <Input label="邮箱" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
        <Input label="手机号码" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+86 138 0000 0000" />
        <Input label="密码" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="至少 8 位" />
        {error && <p className="auth-v2-error">{error}</p>}
        <Button type="submit" disabled={loading || !form.username || !form.email || !form.password} className="w-full">
          <MdiIcon path={mdiAccountPlusOutline} size={0.82} />
          {loading ? '创建中...' : '创建账号'}
        </Button>
        <Link to="/verify-email" className="auth-v2-secondary-action">
          <MdiIcon path={mdiEmailCheckOutline} size={0.82} />
          已注册，去邮箱验证
        </Link>
        <p className="auth-v2-switch">已有账号？<Link to="/login">返回登录</Link></p>
      </form>
    </AuthShell>
  )
}
