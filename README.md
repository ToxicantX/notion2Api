# notion2api

将本地兼容接口代理到上游聊天服务，当前仓库已补充对 Notion `runInferenceTranscript` 的适配，可对外提供：

- `POST /v1/messages`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/models`
- `GET /health`
- `GET /logs`
- `GET /vuelogs`

## 致谢

本项目基于原仓库继续演进，感谢原作者提供的基础能力与思路：

- [7836246/cursor2api](https://github.com/7836246/cursor2api)

## 当前状态

当前默认上游已经切到：

`https://www.notion.so/api/v3/runInferenceTranscript`

并且已验证以下能力：

- 使用浏览器真实 `cookie` 和 Notion 头信息访问上游
- 兼容 Notion `application/x-ndjson` patch 流
- 支持从 patch 流中提取最终文本
- 支持通过固定 `notion_thread_id` 复用真实线程
- `/logs` 和 `/vuelogs` 可查看 `upstreamDebug`

## 重要注意

这个仓库现在不是“开箱即用的通用 Notion API SDK”，而是“基于浏览器真实请求上下文的代理适配”。要稳定工作，通常必须满足下面几条：

1. 必须提供浏览器里的完整 `cookie`。
2. 必须提供 `notion_active_user_id`、`notion_space_id`。
3. 最好提供 `notion_space_view_id`、`notion_client_version`、`notion_baggage`、`notion_sentry_trace`。
4. 当前最稳定的方式是复用一个真实存在的 `notion_thread_id`。
5. 如果 `notion_thread_id` 不对，Notion 可能只返回一个 `[`，最终表现为 `0 chars`。

## 安全注意

下面这些内容都属于敏感信息，不应该提交到仓库或截图外发：

- `config.yaml` 里的 `cookie`
- `notion_active_user_id`
- `notion_space_id`
- `notion_thread_id`
- `notion_user_email`
- 浏览器开发者工具里复制出来的完整 `curl`

建议做法：

- 只提交 [config.yaml.example](E:/workspace/APIProject/cursor2api/config.yaml.example)
- 本地真实配置只放在被 `.gitignore` 忽略的 `config.yaml`
- 测试抓包、临时 JSON、截图里一律先打码再分享

## 模型切换

当前代理已经支持“客户端模型名”到“Notion 上游模型名”的映射。

配置方式：

```yaml
cursor_model: "oatmeal-cookie"
model_map:
  "anthropic/claude-sonnet-4.6": "oatmeal-cookie"
  "anthropic/claude-opus-4.6": "YOUR_NOTION_MODEL_ID"
  "google/gemini-3.1-pro": "YOUR_NOTION_MODEL_ID"
  "openai/gpt-5.2": "YOUR_NOTION_MODEL_ID"
  "openai/gpt-5.4": "YOUR_NOTION_MODEL_ID"
```

规则是：

- 前端传进来的模型名先查 `model_map`
- 找到就映射到对应 Notion 模型
- 找不到就回退到 `cursor_model`
- `/v1/models` 会返回 `model_map` 里的键名

这意味着你现在可以先把 Cherry Studio 里想显示的模型名列出来，再逐个绑定真实的 Notion 内部模型名。

## 快速开始

### 1. 安装

```bash
npm install
```

### 2. 复制配置

```bash
cp config.yaml.example config.yaml
```

Windows PowerShell:

```powershell
Copy-Item config.yaml.example config.yaml
```

### 3. 填写 Notion 配置

至少需要这些字段：

```yaml
cursor_model: "oatmeal-cookie"
upstream_chat_api: "https://www.notion.so/api/v3/runInferenceTranscript"
upstream_origin: "https://www.notion.so"
upstream_referer: "https://www.notion.so/chat?t=YOUR_THREAD&wfv=chat"

cookie: "完整浏览器 Cookie"

notion_active_user_id: "..."
notion_space_id: "..."
notion_thread_id: "..."
notion_space_view_id: "..."
notion_client_version: "23.13.20260412.2235"
notion_accept_language: "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,en-GB;q=0.6"
notion_sec_ch_ua: "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\""
notion_sentry_trace: "..."
notion_baggage: "..."
notion_user_name: "..."
notion_user_email: "..."
notion_space_name: "..."
```

## 从浏览器 cURL 生成配置

仓库里新增了一个脚本，可以把浏览器开发者工具里复制出来的 `curl` 直接转成 `config.yaml` 片段：

文件：

[tools/curl_to_config.py](E:/workspace/APIProject/cursor2api/tools/curl_to_config.py)

用法一，读取文件：

```powershell
python tools/curl_to_config.py curl.txt
```

用法二，管道输入：

```powershell
Get-Content curl.txt | python tools/curl_to_config.py
```

它会提取：

- `cookie`
- `notion_active_user_id`
- `notion_space_id`
- `notion_thread_id`
- `notion_space_view_id`
- `notion_client_version`
- `notion_accept_language`
- `notion_sec_ch_ua`
- `notion_sentry_trace`
- `notion_baggage`
- `notion_user_name`
- `notion_user_email`
- `notion_space_name`
- `fingerprint.user_agent`

## 启动

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

## 测试方式

### 用 Cherry Studio

可以直接把 base URL 指向：

`http://localhost:3010/v1`

日志里看到客户端模型名例如：

`anthropic/claude-sonnet-4.6`

这只是客户端传入模型名，不代表上游真实模型。真正发往 Notion 的模型由 `cursor_model` 控制，当前默认是：

`oatmeal-cookie`

### 用 curl

```bash
curl http://localhost:3010/v1/models
```

```bash
curl http://localhost:3010/health
```

## 日志排查

日志页面：

- [http://localhost:3010/logs](http://localhost:3010/logs)
- [http://localhost:3010/vuelogs](http://localhost:3010/vuelogs)

重点看这些字段：

- `cursorRequest`
- `rawResponse`
- `finalResponse`
- `upstreamDebug`

### 常见现象

`upstreamDebug = []`

- 说明这次几乎没读到可用上游内容，优先检查是否真的重启到了新代码。

`upstreamDebug` 里只有：

```text
[meta] status=200 content-type=application/x-ndjson parseAsNdjson=true
[chunk 1] [
[tail] [
```

- 说明 Notion 接受了请求，但没有真正产出有效 patch 流。
- 最常见原因是 `notion_thread_id` 不正确，或请求上下文不够像真实浏览器会话。

返回里有正文，但混入 `thinking` / 重复段落

- 这是上游 patch 流解析问题，当前版本已做过一轮清洗，只保留正文 `text`。

## 当前 Notion 适配实现

适配核心文件：

- [src/cursor-client.ts](E:/workspace/APIProject/cursor2api/src/cursor-client.ts)
- [src/config.ts](E:/workspace/APIProject/cursor2api/src/config.ts)
- [src/types.ts](E:/workspace/APIProject/cursor2api/src/types.ts)
- [src/handler.ts](E:/workspace/APIProject/cursor2api/src/handler.ts)
- [src/openai-handler.ts](E:/workspace/APIProject/cursor2api/src/openai-handler.ts)

当前实现包括：

- 构造 Notion 风格 transcript
- 支持 `config`、`context`、`updated-config`
- 支持 `notion_thread_id` 固定复用
- 解析 `patch-start`
- 解析 `patch` 中的 `agent-inference`
- 解析 patch 追加文本
- 记录上游原始调试片段到日志

## 配置说明

示例配置文件：

[config.yaml.example](E:/workspace/APIProject/cursor2api/config.yaml.example)

其中和 Notion 适配最相关的是：

- `upstream_chat_api`
- `upstream_origin`
- `upstream_referer`
- `cookie`
- `notion_active_user_id`
- `notion_space_id`
- `notion_thread_id`
- `notion_space_view_id`
- `notion_client_version`
- `notion_baggage`
- `notion_sentry_trace`

- Notion 只靠 `https://www.notion.so/chat` 即可访问

当前仓库的主工作流应理解为：

“通过真实浏览器会话信息，把本地兼容接口代理到 Notion `runInferenceTranscript`。”
