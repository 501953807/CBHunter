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
V5_SOURCE_MARKERS = [
    "总体升级方案",
    "01 多平台电商后台调研",
    "02 功能开发方案总文档",
    "03 字段标准对照表",
    "04 UIUX 交互设计指导",
    "05 开发建设指导意见",
    "06 缺失功能补充对照",
    "07 全量策略与数据可行性",
    "08 策略数据解耦",
    "09 选品器 UIUX",
    "10 选品数据库设计",
]
MANDATORY_SELF_CHECKS = [
    "旧系统原有业务需求是否全部保留",
    "V5.0 新增调研需求是否完整纳入",
    "新旧逻辑冲突点是否全部识别",
    "模块之间数据流、关联关系和顶层总览保持一致",
    "所有功能差异化规则、限制、数据源可行性分级完整保留",
]


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
        "### 1.4 本次逐章融合复核结论",
        "### 1.5 刚性落实规则",
        "### 1.6 逐源资料融合审计矩阵",
        "### 1.7 正式方案可开发性复核结论",
        "### 1.8 本轮刚性要求落实审计",
        "### 1.9 本轮严肃复核修正记录",
        "### 1.10 本轮最终融合审计承诺与执行边界",
        "#### 1.10.1 已核验的输入范围",
        "#### 1.10.2 融合必须达到的正文深度",
        "#### 1.10.3 文档目录清理结论",
        "#### 1.10.4 03 与 04 的不可变关系",
        "#### 1.10.5 执行承诺",
        "### 1.11 本轮刚性复核执行结果",
        "### 1.12 V5.0 源资料到 17 模块的最终归属表",
        "## 0. 正式建设方案总纲（开发执行版）",
        "### 0.1 系统建设目标",
        "### 0.2 系统整体业务架构",
        "### 0.3 系统整体功能架构",
        "### 0.4 系统整体技术架构",
        "### 0.5 系统整体项目架构和文档出口",
        "### 0.6 本轮严肃复核承诺转为硬规则",
        "## 3. 全链路业务架构",
        "### 2.5 系统整体能力清单",
        "### 2.6 总体功能边界与不建设范围",
        "### 2.7 系统整体架构详述",
        "#### 2.7.1 业务架构：跨境经营闭环",
        "#### 2.7.2 功能架构：17 个模块的唯一职责",
        "#### 2.7.3 数据架构：统一底座 + 平台覆盖",
        "#### 2.7.4 技术架构：现有栈渐进升级",
        "#### 2.7.5 项目架构：文档、代码、测试的执行关系",
        "### 3.4 端到端业务闭环验收口径",
        "## 6. 技术架构",
        "### 6.6 数据库与统一字段架构完整方案",
        "### 6.7 统一字段字典与动态表单落地规则",
        "### 7.6 页面设计落地标准",
        "## 8. 项目工程架构与文档出口",
        "## 11. 硬性融合自检",
        "AR-FUSION-P0-20",
        "AR-FUSION-P0-21",
        "AR-FUSION-P0-22",
        "AR-FUSION-P0-23",
        "03_字段标准对照表.csv",
        "不得写成已读取 `03_*.md`",
        "开发读取顺序固定为",
        "V5.0 自检只用于证明正文未漏项",
        "完成状态证据化",
        "完成状态必须有证据",
        "选品数据库完整规划应覆盖 16 类策略表/对象",
        "Shopee",
        "TikTok Shop",
        "TEMU",
        "股票选股器",
        "动态表单",
        "明确时间窗",
        "AI辅助",
        "只读优先",
        "不得虚造数据或完成状态",
        "不伪造平台数据、商品数据、费用数据、订单数据、策略结果或完成状态",
        "未发现需删除的临时 Markdown 或过期规划文件",
        "03 是任务总账",
        "04 是执行看板",
        "经营主体 → 平台 → 店铺 → 商品主档",
        "任务总账，`04` 是执行看板",
        "不虚造平台数据、商品数据、订单数据、费用数据、策略结果或完成状态",
        "公司经营主体 → 平台 → 店铺 → 商品 → 店铺 Listing → SKU/变体 → 订单 → 费用 → 利润 → 复盘 → 选品策略反馈",
        "统一底座 + 平台覆盖",
    ])
    _require_text(system_plan, V5_SOURCE_MARKERS + MANDATORY_SELF_CHECKS)
    _require_text(data_flow, [
        "# CBHunter V5.0 全局业务数据流与模块关联总览",
        "## 2. 全项目业务流程总览",
        "### 2.1.0 策略反馈闭环",
        "### 2.3.1 技术支撑流",
        "### 2.3.2 经营主体、只读优先与回滚支撑流",
        "### 2.5 主数据归属与跨模块读写边界",
        "### 2.6 全业务流程与模块关联细化",
        "#### 2.6.1 选品到商品入库",
        "#### 2.6.2 商品 Listing 制作",
        "#### 2.6.3 定价、发布与平台回执",
        "#### 2.6.4 订单、财务、风险和增长闭环",
        "#### 2.6.5 三大中枢读取规则",
        "## 12. 存量路由与 V5 模块归属",
        "## 14. V5.0 源资料数据流融合校验",
        "### 14.1 逐源资料到数据对象的承接表",
        "### 14.2 统一字段与选品策略数据流补充",
        "## 15. 刚性融合校验与执行闭环",
        "AR-FUSION-P0-20",
        "### 15.1 开发前置闸口",
        "业务对象闸口",
        "模块主责闸口",
        "多平台差异闸口",
        "UI/UX 闸口",
        "数据真实性闸口",
        "任务闸口",
        "AR-FUSION-P0-22",
        "对象落地顺序固定为",
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
    _require_text(data_flow, V5_SOURCE_MARKERS)
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
        "AR-FUSION-P0-13",
        "AR-FUSION-P0-15",
        "AR-FUSION-P0-16",
        "AR-FUSION-P0-17",
        "AR-FUSION-P0-18",
        "AR-FUSION-P0-19",
        "AR-FUSION-P0-20",
        "AR-FUSION-P0-21",
        "AR-FUSION-P0-22",
        "开发前置闸口",
        "03_字段标准对照表.csv",
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
        "| AR-FUSION-P0-13 |",
        "| AR-FUSION-P0-15 |",
        "| AR-FUSION-P0-16 |",
        "| AR-FUSION-P0-17 |",
        "| AR-FUSION-P0-18 |",
        "| AR-FUSION-P0-19 |",
        "| AR-FUSION-P0-20 |",
        "| AR-FUSION-P0-21 |",
        "| AR-FUSION-P0-22 |",
        "| AR-FUSION-P0-23 |",
        "## 6. 业务架构与菜单整改任务（已合并）",
        "一个菜单路由只有一个归属",
        "多国市场",
        "定价模板",
        "策略市场",
        "回滚",
        "本轮刚性要求落实审计",
        "本轮最终融合审计承诺与任务出口固化",
        "系统建设方案正式总纲前置与文档唯一出口复核",
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
        "## 正式功能设计收口（V5.0 已融入正文）",
        "V5.0 五项融合自检",
        "## V5.0 硬性融合自检（固定问题格式）",
        "## 本轮正式融合复核补充（AR-FUSION-P0-20）",
        "旧系统",
        "新增",
        "冲突",
        "数据流",
        "完整保留",
        "逐份资料融合落点",
    ]
    for doc in docs:
        content = doc.read_text(encoding="utf-8")
        if "## V5.0 融合后的正式功能设计" in content:
            raise RuntimeError(f"{doc} must not keep V5 content as a late supplement heading")
        missing = [marker for marker in required if marker not in content]
        if missing:
            raise RuntimeError(f"{doc} missing V5 fusion markers: {', '.join(missing)}")
        self_check_start = content.find("V5.0 五项融合自检")
        if self_check_start == -1:
            raise RuntimeError(f"{doc} missing V5 fusion self check section")
        self_check_text = content[self_check_start : self_check_start + 900]
        for marker in ["旧系统", "新增", "冲突", "数据流", "完整保留"]:
            if marker not in self_check_text:
                raise RuntimeError(f"{doc} self check missing marker: {marker}")
        fixed_check_start = content.find("## V5.0 硬性融合自检（固定问题格式）")
        if fixed_check_start == -1:
            raise RuntimeError(f"{doc} missing fixed-format V5 fusion self check section")
        fixed_check_text = content[fixed_check_start : fixed_check_start + 1600]
        for marker in MANDATORY_SELF_CHECKS:
            if marker not in fixed_check_text:
                raise RuntimeError(f"{doc} fixed self check missing mandatory question: {marker}")


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
