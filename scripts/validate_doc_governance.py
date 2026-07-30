"""Validate CBHunter V5.0 documentation governance rules."""

from __future__ import annotations

from pathlib import Path

SYSTEM_PLAN_DOC = Path("docs/00_CBHunter_V5.0系统建设方案.md")
DATA_FLOW_DOC = Path("docs/01_CBHunter_V5.0全局业务数据流与模块关联总览.md")
MODULE_DOC = Path("docs/02_CBHunter_V5.0模块功能说明.md")
MASTER_PLAN_DOC = Path("docs/03_CBHunter_V5.0实施任务总表.md")
PROGRESS_DOC = Path("docs/迭代改造清单_V5.0/04_CBHunter_V5.0分阶段迭代开发排期与实施进度.md")
COLLAB_DOC = Path("docs/05_CBHunter_V5.0三平台开放接口申请协作清单.md")
MODULE_DESIGN_DIR = Path("docs/功能模块设计")

ACTIVE_DOCS = [
    SYSTEM_PLAN_DOC,
    DATA_FLOW_DOC,
    MODULE_DOC,
    MASTER_PLAN_DOC,
    PROGRESS_DOC,
    COLLAB_DOC,
    Path("README.md"),
    Path("CLAUDE.md"),
    Path("AGENTS.md"),
]

ALLOWED_DOC_ROOT_FILES = {
    SYSTEM_PLAN_DOC,
    DATA_FLOW_DOC,
    MODULE_DOC,
    MASTER_PLAN_DOC,
    COLLAB_DOC,
}

FORBIDDEN_ACTIVE_REFS = [
    "AnaReports/project/CBHunter",
    "ClaudeWorkspace/AnaReports",
    "/Users/tangxiaochuan/AIWorkspace/ClaudeWorkspace",
    "CBHunter_系统整体升级与架构重构总方案.md",
    "01_多平台电商后台调研汇总.md",
    "02_功能开发方案总文档.md",
    "03_字段标准对照表.csv",
    "04_UIUX交互设计指导.md",
    "05_开发建设指导意见.md",
    "06_上次调研缺失功能补充对照表.md",
    "07_跨境选品_全量策略全集_数据可行性分级表.md",
    "08_选品选股器核心架构_策略数据解耦方案.md",
    "09_选品器UIUX交互规范_股票选股器范式.md",
    "10_选品模块数据库完整设计.md",
    "docs/模块功能说明.md",
    "docs/实施任务进度.md",
    "docs/系统建设方案4.0-实施任务总表.md",
    "docs/test-reports/",
]

SELF_CHECKS = [
    "旧系统原有业务需求是否全部保留",
    "V5.0新增调研需求是否完整纳入",
    "新旧逻辑冲突点是否全部识别",
    "模块之间数据流、关联关系和顶层总览保持一致",
    "所有功能差异化规则、限制、数据源可行性分级完整保留",
]

REQUIRED_TASK_IDS = [
    "DOC-V5-001", "DOC-V5-002", "DOC-V5-003", "DOC-V5-004", "DOC-V5-005", "DOC-V5-006", "DOC-V5-007", "DOC-V5-008",
    "CORE-V5-001", "CORE-V5-002", "CORE-V5-003", "CORE-V5-004", "CORE-V5-005", "CORE-V5-006", "CORE-V5-007", "CORE-V5-008",
    "SCOUT-V5-001", "SCOUT-V5-002", "SCOUT-V5-003", "SCOUT-V5-004",
    "OPS-V5-001", "OPS-V5-002", "OPS-V5-003", "OPS-V5-004",
    "DASH-V5-001", "DASH-V5-002", "DASH-V5-003", "DATA-V5-001",
    "GOV-V5-001", "GOV-V5-002", "AI-V5-001", "UI-V5-001",
]

OBSOLETE_PLANNING_DOCS = [
    Path("docs/测试报告整改统一规划-20260620.md"),
    Path("docs/系统业务架构与菜单整改-20260621.md"),
    Path("docs/系统建设方案4.0.html"),
]


def validate_docs(root: Path | None = None) -> dict:
    base = root or Path(__file__).resolve().parents[1]
    _require_files(base)
    _validate_system_plan(base / SYSTEM_PLAN_DOC)
    _validate_data_flow(base / DATA_FLOW_DOC)
    _validate_master_and_progress(base / MASTER_PLAN_DOC, base / PROGRESS_DOC)
    _validate_module_designs(base / MODULE_DESIGN_DIR)
    _validate_unique_outlets(base)
    _require_absent(base, OBSOLETE_PLANNING_DOCS)
    _require_no_forbidden_refs(base, ACTIVE_DOCS, FORBIDDEN_ACTIVE_REFS)
    return {
        "checked": [str(p) for p in [SYSTEM_PLAN_DOC, DATA_FLOW_DOC, MASTER_PLAN_DOC, PROGRESS_DOC]],
        "module_designs": 17,
        "task_ids_checked": len(REQUIRED_TASK_IDS),
    }


def _require_files(base: Path) -> None:
    required = [SYSTEM_PLAN_DOC, DATA_FLOW_DOC, MODULE_DOC, MASTER_PLAN_DOC, PROGRESS_DOC]
    missing = [str(p) for p in required if not (base / p).exists()]
    if missing:
        raise RuntimeError("missing active docs: " + ", ".join(missing))


def _validate_system_plan(path: Path) -> None:
    required = [
        "# CBHunter V5.0 系统建设方案",
        "## 0. 文档定位和治理规则",
        "## 1. 系统定位",
        "## 2. 建设目标",
        "## 3. 业务架构：全链路闭环",
        "## 4. 核心业务对象和关系",
        "## 5. 功能架构：17 个模块",
        "## 6. 多平台、多店铺、多市场统一解决方案",
        "## 7. 商品、Listing、图片、SKU 和发布方案",
        "## 8. 选品引擎与主系统融合",
        "## 9. 三大中枢方案",
        "## 10. 技术架构",
        "## 11. UI/UX 全局标准",
        "## 12. 新旧冲突收口",
        "## 13. 项目架构与开发规范",
        "## 14. 实施排期原则",
        "## 17. V5.0源资料逐章融合对照审计",
        "## 18. 模块融合落位索引",
        "## 19. 任务排期和完成勾选规则",
        "## 20. 刚性融合承诺和防伪规则",
        "V5.0 源资料包已经完整融合为项目内部设计",
        "字段标准对照表",
        "多平台多店铺、多市场、商品编辑、图片/SKU、订单、营销、资金、选品策略",
        "数据库、平台适配器、动态表单、类目树、费率汇率、安全合规、性能",
        "同一基础商品可以发布到多个平台多个店铺",
        "统一底座加差异覆盖",
        "Shopee", "TikTok Shop", "TEMU", "妙手ERP",
        "8类64条原生策略",
        "ABCD 数据可行性",
        "D", "缺口",
        "今日、昨日、本周、上周、本月、上月",
        "03_CBHunter_V5.0实施任务总表.md` 是唯一任务总账",
        "不得虚造数据、接口、平台回执、测试结论、完成状态",
        "多平台电商后台调研",
        "系统整体升级总方案",
        "03与04的关系必须固定",
        "未读取或未核对的资料，不得写“已通读”",
        "未在04记录验证证据的子项，不得在03勾选完成",
    ] + SELF_CHECKS
    _require_text(path, required)


def _validate_data_flow(path: Path) -> None:
    required = [
        "# CBHunter V5.0 全局业务数据流与模块关联总览",
        "## 0. 文档定位",
        "## 1. 全局业务流程",
        "## 2. 主数据对象流",
        "## 3. 平台店铺商品关系",
        "## 4. 模块关联矩阵",
        "## 5. 关键数据流细化",
        "### 5.1 选品到内容",
        "### 5.2 内容到刊登",
        "### 5.3 刊登到商品库存",
        "### 5.4 订单到财务",
        "### 5.5 运营到策略回流",
        "## 6. 数据源可行性等级",
        "## 7. 新旧冲突映射",
        "## 8. 五项融合自检",
        "## 9. 源章节到业务数据流的融合对照",
        "## 10. 03/04任务闭环校验",
        "BaseProduct",
        "StoreListing",
        "SKU",
        "8类64条策略",
    ] + SELF_CHECKS
    _require_text(path, required)


def _validate_master_and_progress(master: Path, progress: Path) -> None:
    master_text = master.read_text(encoding="utf-8")
    progress_text = progress.read_text(encoding="utf-8")
    _require_text(master, [
        "# CBHunter V5.0 实施任务总表",
        "项目唯一实施任务总账",
        "## 0. 文档职责",
        "## 2. 总体任务表",
        "## 3. 已完成子项勾选",
        "完成状态口径",
    ] + REQUIRED_TASK_IDS)
    _require_text(progress, [
        "# CBHunter V5.0 分阶段迭代开发排期与实施进度",
        "项目唯一执行看板",
        "04 不新增任务",
        "## 2. 当前总体进度估算",
    ] + REQUIRED_TASK_IDS)
    for task_id in REQUIRED_TASK_IDS:
        if task_id not in master_text:
            raise RuntimeError(f"{task_id} missing from master plan")
        if task_id not in progress_text:
            raise RuntimeError(f"{task_id} missing from progress plan")


def _validate_module_designs(module_dir: Path) -> None:
    files = sorted(module_dir.glob("*/功能设计.md"))
    if len(files) != 17:
        raise RuntimeError(f"expected 17 module designs, got {len(files)}")
    for path in files:
        _require_text(path, [
            "## 0. 文档定位",
            "## 1. 模块定位",
            "## 2. 完整功能范围",
            "## 3. 页面与操作结构",
            "## 4. 核心数据对象",
            "## 5. 数据流与模块关联",
            "## 6. 平台差异与字段规则",
            "## 7. 新旧冲突与收口",
            "## 8. 实施任务落位",
            "## 10. 五项强制融合自检",
        ] + SELF_CHECKS)


def _validate_unique_outlets(base: Path) -> None:
    root_md = sorted((base / "docs").glob("*.md"))
    unexpected = [p for p in root_md if p.relative_to(base) not in ALLOWED_DOC_ROOT_FILES]
    if unexpected:
        raise RuntimeError("unexpected docs root markdown files: " + ", ".join(str(p.relative_to(base)) for p in unexpected))


def _require_absent(base: Path, paths: list[Path]) -> None:
    existing = [str(p) for p in paths if (base / p).exists()]
    if existing:
        raise RuntimeError("obsolete docs still exist: " + ", ".join(existing))


def _require_no_forbidden_refs(base: Path, paths: list[Path], forbidden: list[str]) -> None:
    errors: list[str] = []
    for rel in paths:
        path = base / rel
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for needle in forbidden:
            if needle in text:
                errors.append(f"{rel}: forbidden ref {needle}")
    if errors:
        raise RuntimeError("forbidden references found: " + "; ".join(errors))


def _require_text(path: Path, needles: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    missing = [needle for needle in needles if needle not in text]
    if missing:
        raise RuntimeError(f"{path} missing required text: {missing[:8]}")


if __name__ == "__main__":
    print(validate_docs())
