#!/usr/bin/env python3
"""Lightweight HTTP server that proxies prompts to Claude Code via the Python SDK.

This server exposes two endpoints:

    GET /health -> Basic heartbeat payload
    POST /chat  -> Body: {"prompt": "..."}, returns Claude's reply and metadata

Configuration is driven by environment variables so it mirrors the existing
Node.js workflow as closely as possible. The most important variable is
ANTHROPIC_API_KEY (or CLAUDE_API_KEY) which must already be configured for the
Claude Code CLI. Optional variables:

    PYTHON_SERVER_HOST (default: 127.0.0.1)
    PYTHON_SERVER_PORT (default: 8888)
    CLAUDE_PERMISSION_MODE (default: bypassPermissions)
    CLAUDE_ALLOWED_TOOLS (comma separated tool names)
    CLAUDE_DISALLOWED_TOOLS (comma separated tool names)
    CLAUDE_MODEL (Claude model name/alias)
    CLAUDE_MAX_TURNS (int)
    CLAUDE_MCP_CONFIG_PATH (path to MCP config file)
    CLAUDE_CWD (working directory passed to Claude)

The implementation uses ClaudeSDKClient, as mandated by the SDK documentation,
so each request spins up a fresh conversation and collects the assistant's
reply and final result payload.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List, Optional

from claude_code_sdk import (
    AssistantMessage,
    ClaudeCodeOptions,
    ClaudeSDKError,
    ResultMessage,
    TextBlock,
    query,
)

try:  # Preferred modern SDK interface
    from claude_code_sdk import ClaudeSDKClient  # type: ignore[attr-defined]
except ImportError:  # pragma: no cover - provide a lightweight compatibility wrapper
    from claude_code_sdk._internal.client import InternalClient

    class ClaudeSDKClient:  # type: ignore[override]
        """Minimal ClaudeSDKClient compatibility wrapper.

        Provides the async context manager and streaming methods described in the
        official documentation while delegating to the internal client shipped in
        earlier claude-code-sdk releases.
        """

        def __init__(self, options: Optional[ClaudeCodeOptions] = None) -> None:
            self._options = options or ClaudeCodeOptions()
            self._internal = InternalClient()
            self._iterator: Optional[AsyncIterator[Any]] = None

        async def __aenter__(self) -> "ClaudeSDKClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # noqa: D401
            return None

        async def connect(self, prompt: Optional[str] = None) -> None:
            if prompt:
                await self.query(prompt)

        async def query(self, prompt: str, session_id: str = "default") -> None:  # noqa: ARG002
            self._iterator = self._internal.process_query(prompt, self._options)

        async def receive_messages(self) -> AsyncIterator[Any]:
            if self._iterator is None:
                raise RuntimeError("query() must be called before receive_messages()")
            try:
                async for message in self._iterator:
                    yield message
            finally:
                self._iterator = None

        async def receive_response(self) -> AsyncIterator[Any]:
            async for message in self.receive_messages():
                yield message
                if isinstance(message, ResultMessage):
                    break

        async def interrupt(self) -> None:  # pragma: no cover - not supported in fallback
            raise NotImplementedError("Interrupt not supported in legacy SDK")

        async def disconnect(self) -> None:  # pragma: no cover
            return None

HOST = os.environ.get("PYTHON_SERVER_HOST", "127.0.0.1")
PORT = int(os.environ.get("PYTHON_SERVER_PORT", "8888"))
DEFAULT_MCP_CONFIG = os.environ.get("CLAUDE_MCP_CONFIG_PATH")


def _comma_separated(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def build_options() -> ClaudeCodeOptions:
    """Construct ClaudeCodeOptions from environment variables."""
    kwargs: Dict[str, Any] = {}

    permission_mode = os.environ.get("CLAUDE_PERMISSION_MODE")
    if not permission_mode:
        permission_mode = "bypassPermissions"
    kwargs["permission_mode"] = permission_mode

    allowed_tools = _comma_separated(os.environ.get("CLAUDE_ALLOWED_TOOLS"))
    if allowed_tools:
        kwargs["allowed_tools"] = allowed_tools

    disallowed_tools = _comma_separated(os.environ.get("CLAUDE_DISALLOWED_TOOLS"))
    if disallowed_tools:
        kwargs["disallowed_tools"] = disallowed_tools

    model = os.environ.get("CLAUDE_MODEL")
    if model:
        kwargs["model"] = model

    max_turns = os.environ.get("CLAUDE_MAX_TURNS")
    if max_turns:
        try:
            kwargs["max_turns"] = int(max_turns)
        except ValueError:
            print(f"[WARN] Invalid CLAUDE_MAX_TURNS={max_turns!r}; ignoring", file=sys.stderr)

    cwd = os.environ.get("CLAUDE_CWD")
    if cwd:
        kwargs["cwd"] = cwd

    mcp_path = os.environ.get("CLAUDE_MCP_CONFIG_PATH") or DEFAULT_MCP_CONFIG
    if mcp_path:
        if os.path.exists(mcp_path):
            kwargs["mcp_servers"] = mcp_path
            print(f"[INFO] Using MCP config: {mcp_path}", file=sys.stderr)
        else:
            print(f"[ERROR] MCP config file not found at {mcp_path}", file=sys.stderr)
            raise FileNotFoundError(f"MCP config file not found at {mcp_path}")
    else:
        print(f"[ERROR] CLAUDE_MCP_CONFIG_PATH environment variable is not set", file=sys.stderr)
        raise EnvironmentError("CLAUDE_MCP_CONFIG_PATH environment variable must be set")

    extra_args_env = os.environ.get("CLAUDE_EXTRA_ARGS")
    if extra_args_env:
        extra_args = {}
        for pair in extra_args_env.split(","):
            if not pair.strip():
                continue
            if "=" in pair:
                k, v = pair.split("=", 1)
                extra_args[k.strip()] = v.strip()
            else:
                extra_args[pair.strip()] = None
        kwargs["extra_args"] = extra_args

    return ClaudeCodeOptions(**kwargs)


async def query_claude(prompt: str, options: Optional[ClaudeCodeOptions] = None) -> Dict[str, Any]:
    options = options or build_options()
    if not options.mcp_servers:
        mcp_env = os.environ.get("CLAUDE_MCP_CONFIG_PATH")
        if mcp_env:
            raise RuntimeError(f"MCP configuration is required but could not be loaded from {mcp_env}")
        else:
            raise RuntimeError("MCP configuration is required but CLAUDE_MCP_CONFIG_PATH is not set")
    if not options.system_prompt:
        options.system_prompt = (
            "You are a command-line helper. When the user requests a resource, "
            "download it with curl, save it to an explicit local filepath, and report "
            "that path in your final message. If URLs are produced, include them in "
            "the final response alongside the saved file paths. You must satisfy "
            "requests exclusively through the provided MCP tools (such as Imagen4 "
            "related endpoints) and must not fall back to non-MCP services; if an MCP "
            "tool cannot be used, return an explicit error instead of switching to a "
            "different provider."
        )

    print("[CLAUDE] start", json.dumps({
        "prompt": prompt,
        "system_prompt": options.system_prompt,
        "allowed_tools": options.allowed_tools,
        "mcp_config": options.mcp_servers if isinstance(options.mcp_servers, (str, os.PathLike)) else list(options.mcp_servers.keys()) if isinstance(options.mcp_servers, dict) else None,
    }, ensure_ascii=False), file=sys.stderr)

    # SDKの代わりに直接query関数を使用
    text_segments: List[str] = []
    result_payload: Dict[str, Any] | None = None
    
    try:
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        text_segments.append(block.text)
            if isinstance(message, ResultMessage):
                result_payload = {
                    "num_turns": message.num_turns,
                    "duration_ms": message.duration_ms,
                    "duration_api_ms": message.duration_api_ms,
                    "is_error": message.is_error,
                    "total_cost_usd": message.total_cost_usd,
                    "usage": message.usage,
                    "session_id": message.session_id,
                    "result": message.result,
                }
                break
    except Exception as e:
        print(f"[ERROR] Query failed: {e}", file=sys.stderr)
        raise

    print("[CLAUDE] done", json.dumps({
        "prompt": prompt,
        "response_preview": "".join(text_segments).strip()[:200],
        "result": result_payload,
    }, ensure_ascii=False), file=sys.stderr)

    return {
        "text": "".join(text_segments).strip(),
        "result": result_payload,
    }


class ClaudeHandler(BaseHTTPRequestHandler):
    server_version = "ClaudeSDKHTTP/1.0"

    def _send_json(self, payload: Dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        try:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status.value)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)
        except BrokenPipeError:
            # クライアントが接続を切断した場合は静かに処理
            print("[WARNING] Client disconnected before response could be sent", file=sys.stderr)
        except ConnectionResetError:
            # 接続がリセットされた場合も静かに処理
            print("[WARNING] Connection reset by client", file=sys.stderr)

    def send_cors_preflight(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT.value)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler API)
        if self.path == "/health":
            self._send_json({
                "status": "ok",
                "host": HOST,
                "port": PORT,
            })
        elif self.path == "/mcp" or self.path == "/mcp/servers":
            # 参照中のMCP設定ファイルからサーバー一覧を返す
            mcp_path = os.environ.get("CLAUDE_MCP_CONFIG_PATH") or DEFAULT_MCP_CONFIG
            try:
                servers: List[Dict[str, Any]] = []
                if os.path.exists(mcp_path):
                    with open(mcp_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    raw = data.get("mcpServers") or data.get("servers") or {}
                    if isinstance(raw, dict):
                        for name, cfg in raw.items():
                            if not isinstance(cfg, dict):
                                continue
                            servers.append({
                                "name": name,
                                "type": cfg.get("type") or cfg.get("kind") or "",
                                "url": cfg.get("url") or cfg.get("endpoint") or cfg.get("command") or "",
                                "description": cfg.get("description") or cfg.get("comment") or "",
                            })
                self._send_json({
                    "config_path": mcp_path,
                    "servers": servers,
                })
            except Exception as err:  # noqa: BLE001
                print(f"[ERROR] MCP list failed: {err}", file=sys.stderr)
                self._send_json({"error": "mcp_read_error", "detail": str(err), "config_path": mcp_path}, HTTPStatus.INTERNAL_SERVER_ERROR)
        else:
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/chat":
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return

        content_length = self.headers.get("Content-Length")
        if not content_length:
            self.send_error(HTTPStatus.LENGTH_REQUIRED, "Content-Length required")
            return

        try:
            length = int(content_length)
        except ValueError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid Content-Length")
            return

        raw_body = self.rfile.read(length)
        try:
            data = json.loads(raw_body)
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Body must be JSON")
            return

        prompt = data.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            self.send_error(HTTPStatus.BAD_REQUEST, "'prompt' field must be a non-empty string")
            return

        try:
            response = asyncio.run(query_claude(prompt.strip()))
        except ClaudeSDKError as err:
            print(f"[ERROR] Claude SDK failed: {err}", file=sys.stderr)
            self._send_json({"error": "claude_sdk_error", "detail": str(err)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        except Exception as err:  # noqa: BLE001 - broad to surface unexpected errors
            print(f"[ERROR] Unexpected failure: {err}", file=sys.stderr)
            self._send_json({"error": "server_error", "detail": str(err)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        print("[CLAUDE] response", json.dumps({
            "prompt": prompt,
            "response_preview": response["text"][:200],
            "result": response.get("result"),
        }, ensure_ascii=False), file=sys.stderr)

        self._send_json({
            "prompt": prompt,
            "response": response["text"],
            "result": response["result"],
        })

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_cors_preflight()

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: D401
        """Route default logging through stderr for visibility."""
        # BrokenPipeErrorのスタックトレースを抑制
        if "Broken pipe" not in fmt and "Connection reset" not in fmt:
            sys.stderr.write("[HTTP] " + fmt % args + "\n")
    
    def log_error(self, fmt: str, *args: Any) -> None:
        """Override to suppress noisy broken pipe errors."""
        # BrokenPipeErrorのスタックトレースを完全に抑制
        if len(args) > 0 and isinstance(args[0], BrokenPipeError):
            self.log_message("Client disconnected (broken pipe)")
        elif len(args) > 0 and isinstance(args[0], ConnectionResetError):
            self.log_message("Client disconnected (connection reset)")
        else:
            super().log_error(fmt, *args)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), ClaudeHandler)
    print(f"Claude SDK Python server listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
