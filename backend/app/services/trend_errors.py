"""Shared error helpers for trend collection."""


def shorten_error(e: Exception) -> str:
    """Extract a short, human-readable error message."""
    msg = str(e)
    if "429" in msg or "Too Many Requests" in msg:
        return "Google Trends 接口限速(429)，请稍后再试"
    if "403" in msg or "Forbidden" in msg:
        return "Google Trends 拒绝访问(403)，可能需要更换IP"
    if "400" in msg:
        return "请求参数错误(400)"
    if "timeout" in msg.lower() or "timed out" in msg.lower():
        return "连接超时，请检查VPN是否正常"
    if "connection" in msg.lower() or "connect" in msg.lower():
        return "网络连接失败，请确认VPN已连接"
    if "proxy" in msg.lower():
        return "代理连接失败"
    if "SSL" in msg or "ssl" in msg or "certificate" in msg:
        return "SSL证书验证失败"
    if "401" in msg or "Unauthorized" in msg:
        return "认证失败(401)，请检查Pinterest账号密码"
    if len(msg) > 80:
        return msg[:80] + "..."
    return msg
