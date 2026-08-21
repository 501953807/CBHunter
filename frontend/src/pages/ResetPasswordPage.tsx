import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mdiLockReset } from '@mdi/js'
import { AuthShell } from '../components/shared/AuthShell'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { MdiIcon } from '../components/ui/MdiIcon'

export default function ResetPasswordPage() {
  const [form, setForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  })
  const [message, setMessage] = useState('')
  const mismatch = Boolean(form.nextPassword && form.confirmPassword && form.nextPassword !== form.confirmPassword)

  return (
    <AuthShell
      eyebrow="Reset password"
      title="重置密码"
      description="按要求增加当前密码校验输入；后端接口接入前仅完成前端流程表达。"
      asideTitle="重置密码必须先验证当前密码"
      asideDescription="正式接入后将先校验当前密码，再写入新密码，并记录审计日志。"
    >
      <form
        className="auth-v2-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!mismatch && form.currentPassword && form.nextPassword) {
            setMessage('前端表单校验通过；等待后端密码重置接口接入后执行真实修改。')
          }
        }}
      >
        <Input
          label="当前密码"
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          placeholder="先输入当前密码"
        />
        <Input
          label="新密码"
          type="password"
          value={form.nextPassword}
          onChange={(e) => setForm({ ...form, nextPassword: e.target.value })}
          placeholder="输入新密码"
        />
        <Input
          label="确认新密码"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          placeholder="再次输入新密码"
          error={mismatch ? '两次输入的新密码不一致' : undefined}
        />
        {message && <p className="auth-v2-success">{message}</p>}
        <Button type="submit" disabled={!form.currentPassword || !form.nextPassword || !form.confirmPassword || mismatch} className="w-full">
          <MdiIcon path={mdiLockReset} size={0.82} />
          验证并重置密码
        </Button>
        <p className="auth-v2-switch">不修改了？<Link to="/login">返回登录</Link></p>
      </form>
    </AuthShell>
  )
}
