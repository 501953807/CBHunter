import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mdiEmailFastOutline } from '@mdi/js'
import { AuthShell } from '../components/shared/AuthShell'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { MdiIcon } from '../components/ui/MdiIcon'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <AuthShell
      eyebrow="Forgot password"
      title="找回密码"
      description="输入账号邮箱，后续接入邮件服务后发送重置链接。"
      asideTitle="密码找回不绕过权限体系"
      asideDescription="找回密码只触发验证流程，不改变当前账号角色、店铺范围和审计记录。"
    >
      <form
        className="auth-v2-form"
        onSubmit={(event) => {
          event.preventDefault()
          setSubmitted(Boolean(email))
        }}
      >
        <Input label="账号邮箱" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        {submitted && (
          <p className="auth-v2-success">已记录找回请求。邮件服务接入后将向 {email} 发送重置链接。</p>
        )}
        <Button type="submit" disabled={!email} className="w-full">
          <MdiIcon path={mdiEmailFastOutline} size={0.82} />
          发送重置链接
        </Button>
        <p className="auth-v2-switch">想起密码？<Link to="/login">返回登录</Link></p>
      </form>
    </AuthShell>
  )
}
