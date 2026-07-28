"""Validate CBHunter V5.0 documentation governance rules."""

from __future__ import annotations

from pathlib import Path
import re

SYSTEM_PLAN_DOC = Path("docs/00_CBHunter_V5.0系统建设方案.md")
DATA_FLOW_DOC = Path("docs/01_CBHunter_V5.0全局业务数据流与模块关联总览.md")
MODULE_DOC = Path("docs/02_CBHunter_V5.0模块功能说明.md")
MASTER_PLAN_DOC = Path("docs/03_CBHunter_V5.0实施任务总表.md")
PROGRESS_DOC = Path("docs/迭代改造清单_V5.0/04_CBHunter_V5.0分阶段迭代开发排期与实施进度.md")
COLLAB_DOC = Path("docs/05_CBHunter_V5.0三平台开放接口申请协作清单.md")
MODULE_DESIGN_DIR = Path("docs/功能模块设计")
TEST_REPORT_DIRS = {Path("docs/测试报告"), Path("docs/test-reports")}

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

FORBIDDEN_ACTIVE_REFS = [
    "AnaReports/project/CBHunter",
    "ClaudeWorkspace/AnaReports",
    "/Users/tangxiaochuan/AIWorkspace/ClaudeWorkspace",
    "docs/模块功能说明.md",
    "docs/实施任务进度.md",
    "docs/系统建设方案4.0-实施任务总表.md",
    "docs/test-reports/",
]

SOURCE_MARKERS = [
    "总体升级主题",
    "多平台后台调研主题",
    "功能开发方案主题",
    "字段标准主题",
    "UI/UX 交互主题",
    "开发建设主题",
    "缺失功能补充主题",
    "选品策略与数据可行性主题",
    "选品策略解耦架构主题",
    "选品器交互主题",
    "选品数据库设计主题",
]

SELF_CHECKS = [
    "旧系统原有业务需求是否全部保留",
    "V5.0新增调研需求是否完整纳入",
    "新旧逻辑冲突点是否全部识别",
    "模块之间数据流、关联关系和顶层总览保持一致",
    "所有功能差异化规则、限制、数据源可行性分级完整保留",
]

REQUIRED_TASK_IDS = [
    "DOC-V5-001",
    "DOC-V5-002",
    "DOC-V5-003",
    "DOC-V5-004",
    "DOC-V5-005",
    "DOC-V5-006",
    "DOC-V5-007",
    "CORE-V5-001",
    "CORE-V5-002",
    "CORE-V5-003",
    "CORE-V5-004",
    "CORE-V5-005",
    "CORE-V5-006",
    "CORE-V5-007",
    "CORE-V5-008",
    "SCOUT-V5-001",
    "SCOUT-V5-002",
    "SCOUT-V5-003",
    "SCOUT-V5-004",
    "OPS-V5-001",
    "OPS-V5-002",
    "OPS-V5-003",
    "OPS-V5-004",
    "DASH-V5-001",
    "DASH-V5-002",
    "DASH-V5-003",
    "DATA-V5-001",
    "GOV-V5-001",
    "GOV-V5-002",
    "AI-V5-001",
    "UI-V5-001",
]

ALLOWED_DOC_ROOT_FILES = {
    SYSTEM_PLAN_DOC,
    DATA_FLOW_DOC,
    MODULE_DOC,
    MASTER_PLAN_DOC,
    COLLAB_DOC,
}

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
    _validate_module_summary(base / MODULE_DOC)
    _validate_module_designs(base / MODULE_DESIGN_DIR)
    _validate_unique_outlets(base)
    _require_absent(base, OBSOLETE_PLANNING_DOCS)
    _require_no_forbidden_refs(base, ACTIVE_DOCS, FORBIDDEN_ACTIVE_REFS)
    return {
        "checked": [str(path) for path in [SYSTEM_PLAN_DOC, DATA_FLOW_DOC, MODULE_DOC, MASTER_PLAN_DOC, PROGRESS_DOC]],
        "module_designs": 17,
        "task_ids_checked": len(REQUIRED_TASK_IDS),
        "obsolete_docs_absent": [str(path) for path in OBSOLETE_PLANNING_DOCS],
    }


def _require_files(base: Path) -> None:
    missing = [str(path) for path in [SYSTEM_PLAN_DOC, DATA_FLOW_DOC, MODULE_DOC, MASTER_PLAN_DOC, PROGRESS_DOC] if not (base / path).exists()]
    if missing:
        raise RuntimeError("missing active docs: " + ", ".join(missing))


def _validate_system_plan(path: Path) -> None:
    _require_text(path, [
        "# CBHunter V5.0 系统建设方案",
        "## 0. 文档定位与刚性规则",
        "## 1. V5.0 输入资料融合口径",
        "## 2. 系统定位与建设目标",
        "## 3. 系统整体业务架构",
        "## 4. 系统功能架构",
        "## 5. 多平台、多店铺、多市场统一解决方案",
        "## 6. 商品、Listing、SKU、素材和发布核心方案",
        "## 7. 选品引擎与主系统融合方案",
        "## 8. 三大中枢建设方案",
        "## 9. 技术架构与项目架构",
        "## 10. UI/UX 全局标准",
        "## 11. 新旧功能冲突处理规范",
        "## 12. 实施治理与验收",
        "## 13. 模块五项融合自检规则",
        "实际存在的 1 个总方案 + 9 个编号 Markdown 输入文件",
        "编号 03 的 V5.0 输入资料实际为 `03_字段标准对照表.csv`",
        "03 是“任务总账”，04 是“执行看板”",
        "完成状态必须有证据",
        "不得虚造数据、接口、测试结果或平台回执",
        "字段标准必须纳入项目内统一字段字典、平台字段组、动态 Schema、国别差异和配置版本治理",
        "Shopee",
        "TikTok Shop",
        "TEMU",
        "统一底座 + 平台覆盖字段",
        "ABCD 数据等级",
        "D 级数据不得参与自动评分",
        "本周/上周、本月/上月、本季度/上季度",
        "## 14. V5.0 章节融合对照审计",
        "1.4.2 业务架构（全链路闭环）",
        "三、全业务模块整合升级详情",
        "四、多平台、多店铺、多国市场差异化统一解决方案",
        "五、选品引擎与主系统全链路融合方案",
        "六、新旧功能冲突解决与收口规范",
        "七、统一UI/UX全局交互标准",
        "## 16. 源章节逐章融合细化审计",
        "## 17. V5.0 实际输入文件实质融合审计与补写结论",
        "### 17.1 逐输入文件融合结果",
        "### 17.2 融合后系统整体业务架构补写",
        "### 17.3 融合后功能架构补写",
        "### 17.4 融合后技术架构补写",
        "### 17.5 逐章融合五项自检",
        "编号 03 实际为 `03_字段标准对照表.csv`",
        "功能架构按“配置治理层、选品策略层、商品内容层、交易履约层、经营增长层、数据中枢层、智能辅助层”组织",
        "## 18. 开发执行版完整架构基线",
        "### 18.1 系统整体业务架构",
        "### 18.2 功能架构完整分层",
        "### 18.3 技术架构和项目结构",
        "### 18.4 多平台、多店铺、多市场统一适配规则",
        "### 18.5 核心商品链路页面执行标准",
        "### 18.6 三大中枢执行标准",
        "### 18.7 选品引擎执行标准",
        "### 18.8 新旧冲突处理执行标准",
        "### 18.9 文档与实施治理",
        "## 19. DOC-V5-007 逐输入文件硬性融合审计与补写清单",
        "### 19.1 输入文件真实清单与处理口径",
        "### 19.2 系统整体业务架构完整融合",
        "### 19.3 功能架构完整融合",
        "### 19.4 技术架构与项目架构完整融合",
        "### 19.5 17 模块专属融合审计摘要",
        "### 19.6 新旧功能冲突收口",
        "### 19.7 本章五项硬性自检",
        "字段标准 CSV",
        "不得再打开项目外路径作为执行依据",
        "误判 03 CSV 缺失",
        "FastAPI",
        "React",
        "SQLite",
    ] + SOURCE_MARKERS + SELF_CHECKS)


def _validate_data_flow(path: Path) -> None:
    _require_text(path, [
        "# CBHunter V5.0 全局业务数据流与模块关联总览",
        "## 0. 数据流治理规则",
        "## 1. 全链路业务数据流",
        "## 2. 主数据归属表",
        "## 3. 关键业务流程",
        "### 3.1 品源到选品",
        "### 3.2 Listing 制作",
        "### 3.3 定价与发布",
        "### 3.4 订单、履约、财务、库存",
        "### 3.5 增长与复盘",
        "## 4. 多平台差异数据流",
        "## 5. 三大中枢读取规则",
        "## 6. 数据真实性和缺口处理",
        "## 7. 开发前置闸口",
        "商品主档",
        "店铺 Listing",
        "SKU/变体/SPU/SKC",
        "四层信号",
        "8 类 64 条策略",
        "字段字典",
        "D 级数据缺口",
        "## 11. 全业务流程、数据对象与模块关联补全",
        "### 11.1 全链路闭环数据流",
        "### 11.2 商品、平台、店铺、Listing、SKU 关系",
        "### 11.3 多平台差异化数据流",
        "### 11.4 三大中枢数据读取边界",
        "### 11.5 数据流五项自检",
        "## 12. 开发执行版数据流与模块关联基线",
        "### 12.1 主对象唯一写入表",
        "### 12.2 关键链路数据流",
        "### 12.3 模块间写入/只读规则",
        "### 12.4 多店铺隔离数据流",
        "### 12.5 数据缺口处理",
        "## 13. DOC-V5-007 数据流刚性融合审计",
        "### 13.1 平台、店铺、商品、Listing、SKU 的底层关系",
        "### 13.2 商品内容主链路",
        "### 13.3 选品策略主链路",
        "### 13.4 三大中枢只读聚合规则",
        "### 13.5 字段 CSV 内化数据流",
        "### 13.6 本章五项自检",
        "`03_字段标准对照表.csv` 的字段只能作为输入源",
    ])


def _validate_master_and_progress(master: Path, progress: Path) -> None:
    _require_text(master, [
        "# CBHunter V5.0 实施任务总表",
        "## 0. 03 与 04 的关系",
        "## 1. 文档融合与治理任务",
        "## 2. 核心商品、Listing、图片、SKU 与刊登任务",
        "## 3. 选品与策略任务",
        "## 4. 订单、财务、库存、增长任务",
        "## 5. 三大中枢与数据任务",
        "## 6. 设置、权限、AI 与治理任务",
        "## 7. 待讨论任务",
        "## 8. 本轮完成勾选",
        "任务总账",
        "执行看板",
    ] + REQUIRED_TASK_IDS)
    _require_text(progress, [
        "# CBHunter V5.0 分阶段迭代开发排期与实施进度",
        "## 0. 执行规则",
        "## 阶段 0：文档融合、唯一出口和治理基线",
        "## 阶段 1：商品、Listing、图片、SKU、定价、刊登基础链路",
        "## 阶段 2：订单、履约、库存、财务、增长",
        "## 阶段 3：三大中枢和数据中心",
        "## 阶段 4：选品猎手、品源管理、竞品、智能引擎",
        "## 阶段 5：全站 UI/UX 统一与最终联调",
        "## 当前总体进度估算",
        "外部输入目录实际存在 `03_字段标准对照表.csv`",
    ] + REQUIRED_TASK_IDS)
    missing_in_progress = [task_id for task_id in REQUIRED_TASK_IDS if task_id not in progress.read_text(encoding="utf-8")]
    if missing_in_progress:
        raise RuntimeError("progress doc missing task IDs from master: " + ", ".join(missing_in_progress))


def _validate_module_summary(path: Path) -> None:
    _require_text(path, [
        "# CBHunter V5.0 模块功能说明",
        "## 文档维护规则",
        "FastAPI",
        "React",
        "SQLite",
    ])


def _validate_module_designs(path: Path) -> None:
    docs = sorted(path.glob("*/功能设计.md"))
    if len(docs) != 17:
        raise RuntimeError(f"{path} must contain 17 module 功能设计.md files, found {len(docs)}")
    required = [
        "## 0. 模块正式功能设计（V5.0开发执行版）",
        "### 0.1 核心页面与功能",
        "### 0.2 核心数据对象",
        "### 0.3 V5.0 输入内容融合",
        "### 0.4 模块硬性边界",
        "### 0.5 V5.0 五项融合自检",
        "### 0.6 V5.0融合落位审计",
        "### 0.7 源章节到本模块正文落位表",
        "### 0.8 V5.0融合后开发基线",
        "正式角色",
        "核心业务对象",
        "真实数据原则",
        "AI边界",
        "平台差异",
        "新旧冲突",
        "不允许硬编码平台字段",
        "本模块每次改造完成必须更新本文件和02/03/04",
        "## 2026-07-28 DOC-V5-006 融合再审计记录",
        "## 2026-07-28 DOC-V5-007 模块专属融合执行清单",
        "V5.0正式角色",
        "必须承接的输入内容",
        "对应实施任务",
        "数据边界",
        "### DOC-V5-007 五项自检",
    ] + SELF_CHECKS
    for doc in docs:
        content = doc.read_text(encoding="utf-8")
        missing = [marker for marker in required if marker not in content]
        if missing:
            raise RuntimeError(f"{doc} missing V5 module design markers: {', '.join(missing)}")


def _validate_unique_outlets(base: Path) -> None:
    root_markdowns = set(Path(path).relative_to(base) for path in (base / "docs").glob("*.md"))
    extra = sorted(str(path) for path in root_markdowns - ALLOWED_DOC_ROOT_FILES)
    if extra:
        raise RuntimeError("unexpected active docs root markdown files: " + ", ".join(extra))
    for doc in (base / "docs").rglob("*.md"):
        rel = doc.relative_to(base)
        if rel in ALLOWED_DOC_ROOT_FILES or str(rel).startswith("docs/功能模块设计/") or str(rel).startswith("docs/迭代改造清单_V5.0/") or any(str(rel).startswith(str(prefix) + "/") for prefix in TEST_REPORT_DIRS):
            continue
        raise RuntimeError(f"unexpected markdown outside approved outlets: {rel}")


def _require_text(path: Path, markers: list[str]) -> None:
    content = path.read_text(encoding="utf-8")
    missing = [marker for marker in markers if marker not in content]
    if missing:
        raise RuntimeError(f"{path} missing required governance markers: {', '.join(missing)}")


def _require_absent(base: Path, paths: list[Path]) -> None:
    existing = [str(path) for path in paths if (base / path).exists()]
    if existing:
        raise RuntimeError("obsolete planning docs must not exist: " + ", ".join(existing))


def _require_no_forbidden_refs(base: Path, paths: list[Path], refs: list[str]) -> None:
    failures: list[str] = []
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


if __name__ == "__main__":
    print(validate_docs())
