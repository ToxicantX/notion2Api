#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def read_input() -> str:
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).read_text(encoding="utf-8")
    return sys.stdin.read()


def unescape_windows_curl(text: str) -> str:
    text = re.sub(r"\^\r?\n", " ", text)
    text = re.sub(r"\^(.)", r"\1", text)
    return text


def extract_first(pattern: str, text: str) -> str:
    m = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    return m.group(1) if m else ""


def parse_curl(text: str) -> dict:
    normalized = unescape_windows_curl(text)
    url = extract_first(r'curl\s+"([^"]+)"', normalized)
    cookie = extract_first(r'-b\s+"([^"]*)"', normalized)
    body_raw = extract_first(r'--data-raw\s+"(.*)"(?:\s+-H|\s*$)', normalized)
    headers = {}
    for item in re.findall(r'-H\s+"([^"]+)"', normalized, flags=re.IGNORECASE):
        if ":" not in item:
            continue
        key, value = item.split(":", 1)
        headers[key.strip().lower()] = value.strip()

    body = {}
    if body_raw:
        body_text = body_raw.replace('\\"', '"')
        try:
            body = json.loads(body_text)
        except json.JSONDecodeError:
            body = {}

    return {
        "url": url,
        "cookie": cookie,
        "headers": headers,
        "body": body,
    }


def yaml_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def build_config(parsed: dict) -> str:
    headers = parsed["headers"]
    body = parsed["body"] if isinstance(parsed["body"], dict) else {}
    context = {}
    transcript = body.get("transcript")
    if isinstance(transcript, list):
        for item in transcript:
            if isinstance(item, dict) and item.get("type") == "context" and isinstance(item.get("value"), dict):
                context = item["value"]
                break

    referer = headers.get("referer", "")
    if not referer and parsed["url"]:
        referer = "https://www.notion.so/chat"

    return "\n".join([
        f'cursor_model: {yaml_quote("oatmeal-cookie")}',
        f'upstream_chat_api: {yaml_quote(parsed["url"] or "https://www.notion.so/api/v3/runInferenceTranscript")}',
        f'upstream_origin: {yaml_quote(headers.get("origin", "https://www.notion.so"))}',
        f'upstream_referer: {yaml_quote(referer or "https://www.notion.so/chat")}',
        f'challenge_url: {yaml_quote("https://www.notion.so/")}',
        "",
        f'cookie: {yaml_quote(parsed["cookie"])}',
        "",
        f'notion_active_user_id: {yaml_quote(headers.get("x-notion-active-user-header", context.get("userId", "")))}',
        f'notion_space_id: {yaml_quote(headers.get("x-notion-space-id", body.get("spaceId", context.get("spaceId", ""))))}',
        f'notion_thread_id: {yaml_quote(body.get("threadId", ""))}',
        f'notion_space_view_id: {yaml_quote(context.get("spaceViewId", ""))}',
        f'notion_client_version: {yaml_quote(headers.get("notion-client-version", ""))}',
        f'notion_accept_language: {yaml_quote(headers.get("accept-language", ""))}',
        f'notion_sec_ch_ua: {yaml_quote(headers.get("sec-ch-ua", ""))}',
        f'notion_sentry_trace: {yaml_quote(headers.get("sentry-trace", ""))}',
        f'notion_baggage: {yaml_quote(headers.get("baggage", ""))}',
        f'notion_user_name: {yaml_quote(context.get("userName", ""))}',
        f'notion_user_email: {yaml_quote(context.get("userEmail", ""))}',
        f'notion_space_name: {yaml_quote(context.get("spaceName", ""))}',
        "",
        "fingerprint:",
        f'  user_agent: {yaml_quote(headers.get("user-agent", ""))}',
    ])


def main() -> int:
    raw = read_input().strip()
    if not raw:
        print("Usage: python tools/curl_to_config.py <curl.txt>  or pipe curl text to stdin", file=sys.stderr)
        return 1

    parsed = parse_curl(raw)
    print(build_config(parsed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
