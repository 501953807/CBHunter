"""Validate core documentation governance rules."""

from pathlib import Path
import re


PROGRESS_DOC = Path("docs/实施任务进度.md")
MODULE_DOC = Path("docs/模块功能说明.md")
MASTER_PLAN_DOC = Path("docs/系统建设方案4.0-实施任务总表.md")
OBSOLETE_PLANNING_DOCS = [
    Path("docs/测试报告整改统一规划-20260620.md"),
    Path("docs/系统业务架构与菜单整改-20260621.md"),
    Path("docs/系统建设方案4.0.html"),
]
RECENT_DATE_RE = re.compile(r"^- (2026-(?:06-30|07-01|07-02)) ")


def validate_docs(root: Path | None = None) -> dict:
    base = root or Path(__file__).resolve().parents[1]
    progress = base / PROGRESS_DOC
    module = base / MODULE_DOC
    master = base / MASTER_PLAN_DOC
    if not progress.exists() and not module.exists() and not master.exists():
        return {
            "checked": [],
            "module_recent_dates": [],
            "obsolete_docs_absent": [],
            "skipped": True,
        }
    _require_text(progress, ["更新时间：", "## 记录治理规则", "任务索引优先", "完成必须有证据"])
    _require_text(module, ["最后更新:", "## 文档维护规则", "模块表为当前状态权威", "变更记录按日期递增"])
    _require_text(master, [
        "本文是系统建设方案、整改规划和实施任务的唯一规划出口",
        "## 4. 测试报告整改任务矩阵（已合并）",
        "| TR-P0-01 |",
        "| TR-P3-01 |",
        "## 5. AP 审批结论与新增执行任务（已合并）",
        "| AP-01 |",
        "| AP07-E01 |",
        "## 6. 业务架构与菜单整改任务（已合并）",
        "一个菜单路由只有一个归属",
    ])
    _require_absent(base, OBSOLETE_PLANNING_DOCS)
    recent_dates = _recent_module_dates(module)
    if recent_dates != sorted(recent_dates):
        raise RuntimeError(f"{MODULE_DOC} recent changelog dates are not ordered: {recent_dates}")
    unique_dates = []
    for date in recent_dates:
        if date not in unique_dates:
            unique_dates.append(date)
    return {
        "checked": [str(PROGRESS_DOC), str(MODULE_DOC), str(MASTER_PLAN_DOC)],
        "module_recent_dates": unique_dates,
        "obsolete_docs_absent": [str(path) for path in OBSOLETE_PLANNING_DOCS],
    }


def _require_text(path: Path, markers: list[str]) -> None:
    content = path.read_text(encoding="utf-8")
    missing = [marker for marker in markers if marker not in content]
    if missing:
        raise RuntimeError(f"{path} missing required governance markers: {', '.join(missing)}")


def _require_absent(base: Path, paths: list[Path]) -> None:
    existing = [str(path) for path in paths if (base / path).exists()]
    if existing:
        raise RuntimeError(f"obsolete planning docs must not exist: {', '.join(existing)}")


def _recent_module_dates(path: Path) -> list[str]:
    dates = []
    for line in path.read_text(encoding="utf-8").splitlines():
        match = RECENT_DATE_RE.match(line)
        if match:
            dates.append(match.group(1))
    if not dates:
        raise RuntimeError(f"{path} missing recent 2026-06-30/2026-07-01/2026-07-02 changelog entries")
    return dates


if __name__ == "__main__":
    result = validate_docs()
    if result.get("skipped"):
        print("Skipped documentation governance: docs is local-only or absent")
    else:
        print(f"Validated documentation governance: {', '.join(result['checked'])}")
