import { Link, useLocation } from 'react-router-dom'
import { mdiEmailCheckOutline, mdiRefresh } from '@mdi/js'
import { AuthShell } from '../components/shared/AuthShell'
import { Button } from '../components/ui/Button'
import { MdiIcon } from '../components/ui/MdiIcon'

export default function VerifyEmailPage() {
  const location = useLocation()
  const state = location.state as { email?: string } | null
  const email = state?.email || '注册邮箱'

  return (
    <AuthShell
      eyebrow="Verify email"
      title="邮箱验证"
      description="参考 Materio verify-email-v2 结构，作为注册后的验证承接页。"
      asideTitle="账号安全必须闭环"
      asideDescription="邮箱验证后再进入店铺授权、角色绑定和权限治理流程。"
    >
      <div className="auth-v2-empty-state">
        <span className="auth-v2-empty-icon"><MdiIcon path={mdiEmailCheckOutline} size={1.4} /></span>
        <h3>验证邮件已准备发送</h3>
        <p>
          当前账号邮箱：<span>{email}</span>。后端邮箱服务接入后，本页将承接验证码发送、重发和验证结果提示。
        </p>
        <Button type="button" variant="secondary" className="w-full">
          <MdiIcon path={mdiRefresh} size={0.8} />
          重新发送验证邮件
        </Button>
        <p className="auth-v2-switch">已完成验证？<Link to="/login">返回登录</Link></p>
      </div>
    </AuthShell>
  )
}
