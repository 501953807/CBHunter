"""Explicit integration errors used when remote platform work is unavailable."""


class PlatformOperationUnavailable(RuntimeError):
    def __init__(self, platform: str, operation: str, reason: str = "真实 Open API 尚未实现"):
        self.platform = platform
        self.operation = operation
        self.reason = reason
        super().__init__(f"{platform} {operation}: {reason}")
