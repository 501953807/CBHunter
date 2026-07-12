"""AI provider invocation implementations."""

import asyncio
import json
import logging
import os
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.system_config_service import get_config
from app.services.ai_rule_fallbacks import rule_fallback
logger = logging.getLogger(__name__)


def _api_text_result(provider: str, status: int, payload: dict, text: str) -> dict:
    if status >= 400:
        error = payload.get("error") or payload.get("message") or payload
        return {"success": False, "error": f"{provider} API HTTP {status}: {error}"}
    if not text or not text.strip():
        return {"success": False, "error": f"{provider} API 未返回有效文本"}
    return {"success": True, "data": {"text": text.strip(), "provider": provider}}


async def call_claude_cli(task_type: str, data: dict, image_path: Optional[str] = None) -> dict:
    """Call local Claude Code CLI."""
    prompt_map = {
        "product_analysis": "分析这个产品图片，给出：品类、风格、材质、颜色、目标人群、5个卖点、市场需求评分(1-10)、饱和度、建议售价区间。用中文回答。",
        "trend_analysis": f"分析跨境电商趋势关键词：{data.get('keyword','')}，市场：{data.get('market','')}。给出趋势方向(rising/stable/falling)、增长幅度、竞争度。用中文回答。",
        "culture_signal_analysis": f"分析这个文化信号中的商品机会：{data.get('content','')[:1500]}。给出可能的商品方向、目标市场、竞争度、可行性评分。用中文回答。",
        "title_generation": f"为产品生成跨境电商标题。产品：{data.get('product_name','')}，特性：{data.get('features','')}，平台：{data.get('platform','')}，市场：{data.get('market','')}。给出5个候选标题。",
        "image_ocr": "提取这张图片中的所有文字内容。",
    }
    prompt = prompt_map.get(task_type, f"执行{task_type}任务：{json.dumps(data, ensure_ascii=False)[:500]}")

    cmd = ["claude", "-p", prompt]
    if image_path:
        cmd += ["-f", image_path]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        if proc.returncode == 0:
            text = stdout.decode().strip()
            if not text:
                return {"success": False, "error": "Claude CLI 未返回有效文本"}
            return {"success": True, "data": {"text": text, "provider": "claude_cli"}}
        return {"success": False, "error": stderr.decode().strip() or f"exit code {proc.returncode}"}
    except asyncio.TimeoutError:
        return {"success": False, "error": "Claude CLI 超时(60s)"}


async def call_openclaw(task_type: str, data: dict, image_path: Optional[str] = None) -> dict:
    """Call OpenClaw browser agent."""
    url = data.get("source_url", "")
    if not url:
        return {"success": False, "error": "OpenClaw 需要 URL"}
    try:
        proc = await asyncio.create_subprocess_exec(
            "openclaw",
            url,
            "--extract",
            "--wait",
            "5",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        if proc.returncode == 0:
            text = stdout.decode().strip()
            if not text:
                return {"success": False, "error": "OpenClaw 未返回有效文本"}
            return {"success": True, "data": {"text": text, "provider": "openclaw"}}
        return {"success": False, "error": stderr.decode().strip()[:200]}
    except asyncio.TimeoutError:
        return {"success": False, "error": "OpenClaw 超时(60s)"}


async def call_ollama(task_type: str, data: dict, image_path: Optional[str] = None) -> dict:
    """Call local Ollama model."""
    models = await _detect_ollama_models()
    if not models:
        return {"success": False, "error": "Ollama 未运行或无模型"}
    model = next((m for m in models if "llava" in m.lower() or "hermes" in m.lower() or "qwen" in m.lower()), models[0])
    import aiohttp

    payload = {
        "model": model,
        "prompt": f"分析：{json.dumps(data, ensure_ascii=False)[:500]}",
        "stream": False,
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post("http://localhost:11434/api/generate", json=payload, timeout=30) as resp:
                result = await resp.json()
                return _api_text_result(f"ollama({model})", resp.status, result, result.get("response", ""))
    except Exception as e:
        return {"success": False, "error": f"Ollama 错误: {e}"}


async def call_free_api(
    db: AsyncSession,
    providers: dict,
    provider_id: str,
    task_type: str,
    data: dict,
    image_path: Optional[str] = None,
) -> dict:
    """Unified free-cloud API entry."""
    cfg = providers[provider_id]
    key_field = cfg.get("needs_key", "")
    api_key = await get_config(db, key_field) if key_field else ""
    if not api_key:
        return {"success": False, "error": f"{cfg['name']} 未配置 API Key"}

    prompt = build_prompt(task_type, data)
    if provider_id == "gemini_free":
        return await call_gemini_api(api_key, prompt, image_path)
    if provider_id == "deepseek_free":
        return await call_deepseek_api(api_key, prompt)
    if provider_id == "tongyi_free":
        return await call_tongyi_api(api_key, prompt, image_path)
    if provider_id == "doubao_free":
        return await call_doubao_api(api_key, prompt)
    if provider_id == "wenxin_free":
        return await call_wenxin_api(api_key, prompt)
    if provider_id == "zhipu_free":
        return await call_zhipu_api(api_key, prompt)
    return {"success": False, "error": f"{provider_id} 未实现"}


async def call_paid_api(
    db: AsyncSession,
    providers: dict,
    provider_id: str,
    task_type: str,
    data: dict,
    image_path: Optional[str] = None,
) -> dict:
    """Unified paid-cloud API entry."""
    cfg = providers[provider_id]
    key_field = cfg.get("needs_key", "")
    api_key = await get_config(db, key_field) if key_field else ""
    if not api_key:
        return {"success": False, "error": f"{cfg['name']} 未配置 API Key"}

    prompt = build_prompt(task_type, data)
    if provider_id == "claude_api":
        return await call_claude_api(api_key, prompt, image_path)
    if provider_id == "openai_api":
        return await call_openai_api(api_key, prompt, image_path)
    if provider_id == "gemini_paid":
        return await call_gemini_api(api_key, prompt, image_path)
    return {"success": False, "error": f"{provider_id} 未实现"}


async def call_gemini_api(api_key: str, prompt: str, image_path: Optional[str] = None) -> dict:
    """Call Gemini API."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    loop = asyncio.get_event_loop()
    try:
        response = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: model.generate_content(prompt)),
            timeout=25,
        )
        text = getattr(response, "text", "")
        if not text:
            return {"success": False, "error": "Gemini API 未返回有效文本"}
        return {"success": True, "data": {"text": text, "provider": "gemini"}}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def call_deepseek_api(api_key: str, prompt: str) -> dict:
    """Call DeepSeek API."""
    import aiohttp

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        ) as resp:
            result = await resp.json()
            text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return _api_text_result("deepseek", resp.status, result, text)


async def call_tongyi_api(api_key: str, prompt: str, image_path: Optional[str] = None) -> dict:
    """Call Qwen multimodal API."""
    import aiohttp

    contents = [{"text": prompt}]
    if image_path:
        import base64

        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        contents.insert(0, {"image": f"data:image/jpeg;base64,{b64}"})
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "qwen-vl-plus", "input": {"messages": [{"role": "user", "content": contents}]}},
            timeout=30,
        ) as resp:
            result = await resp.json()
            text = result.get("output", {}).get("text", "")
            return _api_text_result("tongyi", resp.status, result, text)


async def call_doubao_api(api_key: str, prompt: str) -> dict:
    """Call Doubao API."""
    import aiohttp

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": "doubao-lite-32k", "messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        ) as resp:
            result = await resp.json()
            text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return _api_text_result("doubao", resp.status, result, text)


async def call_wenxin_api(api_key: str, prompt: str) -> dict:
    """Call Wenxin API."""
    import aiohttp

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token={api_key}",
            json={"messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        ) as resp:
            result = await resp.json()
            text = result.get("result", "")
            return _api_text_result("wenxin", resp.status, result, text)


async def call_zhipu_api(api_key: str, prompt: str) -> dict:
    """Call Zhipu GLM API."""
    import aiohttp

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": "glm-4-flash", "messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        ) as resp:
            result = await resp.json()
            text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return _api_text_result("zhipu", resp.status, result, text)


async def call_claude_api(api_key: str, prompt: str, image_path: Optional[str] = None) -> dict:
    """Call Anthropic Claude API."""
    import aiohttp

    contents = [{"type": "text", "text": prompt}]
    if image_path:
        import base64

        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        contents.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}})
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": 2048, "messages": [{"role": "user", "content": contents}]},
            timeout=60,
        ) as resp:
            result = await resp.json()
            text = "".join(block.get("text", "") for block in result.get("content", []) if block.get("type") == "text")
            return _api_text_result("claude_api", resp.status, result, text)


async def call_openai_api(api_key: str, prompt: str, image_path: Optional[str] = None) -> dict:
    """Call OpenAI API."""
    import aiohttp

    content = [{"type": "text", "text": prompt}]
    if image_path:
        import base64

        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": "gpt-4o", "messages": [{"role": "user", "content": content}], "max_tokens": 2048},
            timeout=60,
        ) as resp:
            result = await resp.json()
            text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return _api_text_result("openai", resp.status, result, text)


async def call_rule_engine(task_type: str, data: dict, image_path: Optional[str] = None) -> dict:
    """Built-in rule engine for deterministic local tasks."""
    if task_type == "trend_analysis":
        return {
            "success": False,
            "error": "趋势分析需要真实趋势数据或已配置AI Provider，规则引擎不返回固定趋势判断",
        }
    if task_type == "image_ocr":
        try:
            import subprocess

            if image_path and os.path.exists(image_path):
                result = subprocess.run(
                    ["tesseract", image_path, "stdout", "-l", "chi_sim+eng"],
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                if result.returncode == 0 and result.stdout.strip():
                    return {"success": True, "data": {"text": result.stdout.strip(), "provider": "tesseract"}}
            return {"success": False, "error": "OCR 失败"}
        except FileNotFoundError:
            return {"success": False, "error": "Tesseract 未安装"}
    return rule_fallback(task_type, data)


async def _detect_ollama_models() -> list[str]:
    """Detect installed local Ollama models."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ollama",
            "list",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        lines = stdout.decode().strip().split("\n")[1:]
        return [line.split()[0] for line in lines if line.strip()]
    except Exception as exc:
        logger.error("Detect Ollama models failed: %s", exc)
        return []


def build_prompt(task_type: str, data: dict) -> str:
    """Build prompt text for cloud providers."""
    base = json.dumps(data, ensure_ascii=False)[:1000]
    prompts = {
        "product_analysis": f"你是跨境电商选品专家。分析这个产品，给出JSON格式结果：品类、风格、材质、颜色、目标人群、5个卖点、市场需求评分(1-10)、竞争饱和度、1688参考价区间。\n{base}",
        "trend_analysis": f"分析这个跨境电商趋势关键词。\n{base}\n输出JSON：direction(rising/stable/falling)、growth_pct、competition_level、related_keywords。",
        "culture_signal_analysis": f"从以下文化信号中提取商品机会。\n{base}\n输出JSON：product_direction、target_market、competition_level、target_audience、feasibility_score(1-10)。",
        "title_generation": f"生成跨境电商标题。\n{base}\n输出5个候选标题，每个一行。",
        "selling_points": f"为跨境电商 Listing 提炼真实、克制的商品卖点。\n{base}\n输出5条卖点，避免虚构销量、认证、功效。",
        "description": f"生成跨境电商商品描述候选。\n{base}\n要求包含适用场景、材质/规格待补提醒、包装/售后注意事项，并标注需人工确认的信息。",
        "listing_copy": f"生成跨境电商 Listing 文案候选。\n{base}\n输出标题、卖点、描述三段，未经人工确认不得发布。",
        "image_ocr": f"提取图片中的文字内容：\n{base}",
        "image_understanding": f"理解商品图片并输出主体、材质、风格、风险点和需补拍画面。\n{base}\n如果未提供图片，明确说明缺口。",
        "image_edit_plan": f"为商品主图/详情图制定处理建议。\n{base}\n输出背景、构图、尺寸、清晰度、文字遮挡和平台合规检查项。",
        "video_script": f"生成短视频脚本候选。\n{base}\n输出开场钩子、镜头顺序、口播/字幕、CTA 和风险提醒。",
        "compliance_check": f"检查跨境电商 Listing 合规风险。\n{base}\n输出禁限售、侵权、功效夸大、认证声明、图片文字和平台规则缺口。",
        "enhanced_content": f"生成跨境电商 A+ 图文增强内容候选。\n{base}\n输出模块结构、图片需求、短文案和人工补证据项。",
        "ad_creative": f"生成跨境电商广告素材脚本候选。\n{base}\n输出卖点角度、首屏钩子、素材画面、文案和投放前校验项。",
        "influencer_brief": f"生成达人合作 Brief 候选。\n{base}\n输出达人类型、拍摄要求、核心卖点、禁用表达、交付物和验收标准。",
    }
    return prompts.get(task_type, f"任务：{task_type}\n{base}")
