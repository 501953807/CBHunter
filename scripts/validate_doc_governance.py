"""Validate core documentation governance rules."""

from pathlib import Path
import re


PROGRESS_DOC = Path("docs/迭代改造清单_V5.0/04_CBHunter_V5.0分阶段迭代开发排期与实施进度.md")
MODULE_DOC = Path("docs/02_CBHunter_V5.0模块功能说明.md")
MASTER_PLAN_DOC = Path("docs/03_CBHunter_V5.0实施任务总表.md")
SYSTEM_PLAN_DOC = Path("docs/00_CBHunter_V5.0系统建设方案.md")
DATA_FLOW_DOC = Path("docs/01_CBHunter_V5.0全局业务数据流与模块关联总览.md")
MODULE_DESIGN_DIR = Path("docs/功能模块设计")
ACTIVE_DOCS = [
    SYSTEM_PLAN_DOC,
    DATA_FLOW_DOC,
    MODULE_DOC,
    MASTER_PLAN_DOC,
    PROGRESS_DOC,
    Path("docs/05_CBHunter_V5.0三平台开放接口申请协作清单.md"),
    Path("README.md"),
    Path("CLAUDE.md"),
    Path("AGENTS.md"),
]
FORBIDDEN_ACTIVE_REFS = [
    "AnaReports/project/CBHunter",
    "ClaudeWorkspace/AnaReports",
    "/Users/tangxiaochuan/AIWorkspace/ClaudeWorkspace",
    "docs/模块功能说明.md",
    "docs/实施任务进度.md",
    "docs/系统建设方案4.0-实施任务总表.md",
    "docs/test-reports/",
]
def _obsolete_doc(*parts: str) -> Path:
    return Path("docs") / "".join(parts)


OBSOLETE_PLANNING_DOCS = [
    _obsolete_doc("测试报告", "整改统一规划-20260620.md"),
    _obsolete_doc("系统业务架构", "与菜单整改-20260621.md"),
    _obsolete_doc("系统建设", "方案4.0.html"),
]
RECENT_DATE_RE = re.compile(r"^- (2026-(?:06-30|07-01|07-02)) ")


def validate_docs(root: Path | None = None) -> dict:
    base = root or Path(__file__).resolve().parents[1]
    progress = base / PROGRESS_DOC
    module = base / MODULE_DOC
    master = base / MASTER_PLAN_DOC
    system_plan = base / SYSTEM_PLAN_DOC
    data_flow = base / DATA_FLOW_DOC
    if not progress.exists() and not module.exists() and not master.exists():
        return {
            "checked": [],
            "module_recent_dates": [],
            "obsolete_docs_absent": [],
            "skipped": True,
        }
    _require_text(system_plan, [
        "# CBHunter V5.0 系统建设方案",
        "实际源文件核验结论",
        "03` 的实际文件形态是字段标准 CSV",
        "### 1.2 总体升级方案逐章融合对照",
        "### 1.3 V5.0 内容融合硬性清单",
        "## 3. 全链路业务架构",
        "## 6. 技术架构",
        "## 8. 项目工程架构与文档出口",
        "## 11. 硬性融合自检",
        "Shopee",
        "TikTok Shop",
        "TEMU",
        "股票选股器",
        "动态表单",
        "明确时间窗",
        "AI辅助",
        "只读优先",
    ])
    _require_text(data_flow, [
        "# CBHunter V5.0 全局业务数据流与模块关联总览",
        "## 2. 全项目业务流程总览",
        "### 2.1.0 策略反馈闭环",
        "### 2.3.1 技术支撑流",
        "### 2.3.2 经营主体、只读优先与回滚支撑流",
        "## 12. 存量路由与 V5 模块归属",
        "## 14. V5.0 源资料数据流融合校验",
        "FastAPI",
        "React",
        "SQLite",
        "动态表单",
        "图片墙",
        "拖拽策略画布",
        "负向筛选",
        "股票选股器范式",
        "明确时间窗",
        "经营主体",
        "字段映射",
        "多国市场",
        "策略市场",
        "AI辅助",
        "回滚计划",
        "只读优先",
    ])
    _require_text(progress, [
        "# CBHunter V5.0 分阶段迭代开发排期与实施进度",
        "## 0. 与实施任务总表的关系",
        "### 0.1 执行看板总览",
        "任务总账",
        "执行看板",
        "Shopee/TikTok Shop/TEMU",
        "财务回款和策略反馈",
        "股票选股器范式",
        "弹窗/抽屉/拖拽",
        "AR-FUSION-P0-12",
        "四层信号",
        "策略市场",
        "AI辅助",
        "只读优先",
        "回滚",
    ])
    _require_text(module, [
        "最后更新:",
        "## 文档维护规则",
        "模块表为当前状态权威",
        "变更记录按日期递增",
        "### V5.0 当前代码级融合边界摘要",
        "策略反馈",
        "多国市场",
        "字段映射",
        "图片墙",
        "定价模板",
        "股票选股器范式",
        "只读优先",
        "自检",
    ])
    _require_text(master, [
        "本文是实施任务编号和验收标准出口",
        "## 4. 测试报告整改任务矩阵（已合并）",
        "| TR-P0-01 |",
        "| TR-P3-01 |",
        "## 5. AP 审批结论与新增执行任务（已合并）",
        "| AP-01 |",
        "| AP07-E01 |",
        "| AR-FUSION-P0-11 |",
        "| AR-FUSION-P0-12 |",
        "## 6. 业务架构与菜单整改任务（已合并）",
        "一个菜单路由只有一个归属",
        "多国市场",
        "定价模板",
        "策略市场",
        "回滚",
        "只读优先",
    ])
    _require_module_design_fusion(base / MODULE_DESIGN_DIR)
    _require_no_forbidden_refs(base, ACTIVE_DOCS, FORBIDDEN_ACTIVE_REFS)
    _require_absent(base, OBSOLETE_PLANNING_DOCS)
    recent_dates = _recent_module_dates(module)
    if recent_dates != sorted(recent_dates):
        raise RuntimeError(f"{MODULE_DOC} recent changelog dates are not ordered: {recent_dates}")
    unique_dates = []
    for date in recent_dates:
        if date not in unique_dates:
            unique_dates.append(date)
    return {
        "checked": [
            str(SYSTEM_PLAN_DOC),
            str(DATA_FLOW_DOC),
            str(MODULE_DOC),
            str(MASTER_PLAN_DOC),
            str(PROGRESS_DOC),
        ],
        "module_recent_dates": unique_dates,
        "obsolete_docs_absent": [str(path) for path in OBSOLETE_PLANNING_DOCS],
        "forbidden_refs_checked": [str(path) for path in ACTIVE_DOCS if (base / path).exists()],
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


def _require_no_forbidden_refs(base: Path, paths: list[Path], refs: list[str]) -> None:
    failures = []
    for path in paths:
        full_path = base / path
        if not full_path.exists():
            continue
        content = full_path.read_text(encoding="utf-8")
        for ref in refs:
            if ref in content:
                failures.append(f"{path}: {ref}")
    if failures:
        raise RuntimeError("active docs contain forbidden external/obsolete references: " + "; ".join(failures))


def _require_module_design_fusion(path: Path) -> None:
    docs = sorted(path.glob("*/功能设计.md"))
    if len(docs) != 17:
        raise RuntimeError(f"{path} must contain 17 module 功能设计.md files, found {len(docs)}")
    required = [
        "## V5.0 融合后的正式功能设计",
        "V5.0 融合自检",
        "旧系统",
        "新增",
        "冲突",
        "数据流",
        "完整保留",
    ]
    for doc in docs:
        content = doc.read_text(encoding="utf-8")
        missing = [marker for marker in required if marker not in content]
        if missing:
            raise RuntimeError(f"{doc} missing V5 fusion markers: {', '.join(missing)}")


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
