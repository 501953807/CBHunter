"""
CBHunter MCP Server — stdio-based JSON-RPC server for AI agent integration.

Usage:
  python mcp_server.py

Protocol: MCP stdio transport with Content-Length framing.
This server calls CBHunter's REST API rather than importing async models directly.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from typing import Any, Optional

API_BASE = os.environ.get("CBHUNTER_API", "http://localhost:8000/api/v1")
# Token will be read from env or we'll try without auth first
AUTH_TOKEN = os.environ.get("CBHUNTER_TOKEN", "")


# ========== HTTP helpers ==========

def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if AUTH_TOKEN:
        h["Authorization"] = f"Bearer {AUTH_TOKEN}"
    return h


def _get(path: str) -> Any:
    req = urllib.request.Request(f"{API_BASE}{path}", headers=_headers())
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
        return data.get("data")


def _post(path: str, body: dict = None) -> Any:
    data = json.dumps(body or {}).encode() if body else None
    req = urllib.request.Request(
        f"{API_BASE}{path}", data=data, headers=_headers(), method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read()).get("data")


# ========== Tools ==========

TOOLS = [
    {
        "name": "cbhunter_query_trends",
        "description": "查询趋势热点关键词，按市场和品类筛选。跨境电商选品的第一步：了解当前流行什么。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "market": {"type": "string", "description": "目标市场代码: MY(马来)/PH(菲律宾)/SG(新加坡)/TH(泰国)/VN(越南)"},
                "category": {"type": "string", "description": "品类名称，如: 箱包/手机配件/服装/家居收纳"},
                "limit": {"type": "number", "description": "返回数量，默认20"},
            },
        },
    },
    {
        "name": "cbhunter_query_sourcing",
        "description": "查询选品库列表。已确认的选品产品和当前流水线阶段。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "品类筛选"},
                "stage": {"type": "string", "description": "流水线阶段: discovery/jit_testing/active等"},
                "market": {"type": "string", "description": "目标市场"},
            },
        },
    },
    {
        "name": "cbhunter_get_dashboard",
        "description": "获取系统概览：四层信号采集计数、选品流水线各阶段统计、待处理事项。",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "cbhunter_search_1688",
        "description": "搜索1688供应商。输入产品中文名称，返回1688搜索建议链接列表。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "product_name": {"type": "string", "description": "产品中文名称"},
            },
            "required": ["product_name"],
        },
    },
    {
        "name": "cbhunter_get_stages",
        "description": "获取选品流水线所有阶段及其可跳转目标。了解选品从发现到上架的完整路径。",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def execute_tool(name: str, args: dict) -> Any:
    """Execute a tool synchronously via REST API calls."""
    if name == "cbhunter_query_trends":
        params = []
        if args.get("market"):
            params.append(f"market={args['market']}")
        if args.get("category"):
            params.append(f"category={args['category']}")
        qs = "&".join(params)
        items = _get(f"/scout/trend-keywords?{qs}" if qs else "/scout/trend-keywords")
        if isinstance(items, list):
            return [{ "keyword": i.get("keyword",""), "market": i.get("market",""),
                      "volume": i.get("search_volume",0), "direction": i.get("trend_direction",""),
                      "growth": i.get("growth_pct",0)} for i in items[:args.get("limit",20)]]
        return items

    elif name == "cbhunter_query_sourcing":
        params = []
        for k in ("category", "stage", "market"):
            if args.get(k):
                params.append(f"{k}={args[k]}")
        qs = "&".join(params)
        items = _get(f"/sourcing?{qs}" if qs else "/sourcing")
        if isinstance(items, list):
            return [{ "id": i.get("id",""), "name": i.get("product_name",""),
                      "category": i.get("category",""), "market": i.get("market",""),
                      "stage": i.get("pipeline_stage",""), "price": i.get("source_price_rmb",0),
                      "margin": i.get("profit_margin_pct")} for i in items[:args.get("limit", 20)]]
        return items

    elif name == "cbhunter_get_dashboard":
        return _get("/dashboard/summary")

    elif name == "cbhunter_search_1688":
        return _get(f"/sourcing/search-1688?product_name={urllib.parse.quote(args.get('product_name',''))}")

    elif name == "cbhunter_get_stages":
        return _get("/sourcing/stages")

    else:
        raise ValueError(f"Unknown tool: {name}")


# ========== MCP stdio protocol ==========

def handle_request(request: dict) -> Optional[dict]:
    """Handle a JSON-RPC request."""
    req_id = request.get("id")
    method = request.get("method", "")

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": req_id,
            "result": {
                "protocolVersion": "2025-03-26",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "cbhunter-mcp", "version": "0.1.0"},
            },
        }

    elif method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}

    elif method == "tools/call":
        params = request.get("params", {})
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        try:
            result = execute_tool(tool_name, arguments)
            return {"jsonrpc": "2.0", "id": req_id, "result": {
                "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, default=str)}]
            }}
        except Exception as e:
            return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32603, "message": str(e)}}

    elif method in ("notifications/initialized",):
        return None

    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Unknown: {method}"}}


def main():
    """Read Content-Length framed JSON-RPC from stdin."""
    import urllib.parse
    buf = b""
    while True:
        chunk = sys.stdin.buffer.read(4096)
        if not chunk:
            break
        buf += chunk

        while b"\r\n\r\n" in buf:
            header_end = buf.find(b"\r\n\r\n")
            header = buf[:header_end].decode()
            body_start = header_end + 4
            cl = 0
            for h in header.split("\r\n"):
                if h.lower().startswith("content-length:"):
                    cl = int(h.split(":")[1].strip())

            if len(buf) - body_start < cl:
                break  # Need more data

            body = buf[body_start:body_start + cl]
            buf = buf[body_start + cl:]

            try:
                req = json.loads(body)
                resp = handle_request(req)
                if resp:
                    text = json.dumps(resp, ensure_ascii=False)
                    raw = text.encode("utf-8")
                    sys.stdout.buffer.write(f"Content-Length: {len(raw)}\r\n\r\n".encode())
                    sys.stdout.buffer.write(raw)
                    sys.stdout.buffer.flush()
            except json.JSONDecodeError:
                continue


if __name__ == "__main__":
    main()
