import { randomUUID } from 'crypto';
import type { AppConfig, CursorChatRequest, CursorSSEEvent } from './types.js';
import { getConfig } from './config.js';
import { getProxyFetchOptions } from './proxy-agent.js';

const DEFAULT_CHAT_API = 'https://www.notion.so/api/v3/runInferenceTranscript';
const DEFAULT_ORIGIN = 'https://www.notion.so';
const DEFAULT_REFERER = 'https://www.notion.so/';
const DEFAULT_NOTION_CLIENT_VERSION = '23.13.20260412.2235';

function getUpstreamUrl(config: AppConfig): URL {
    return new URL(config.upstreamChatApi || DEFAULT_CHAT_API);
}

function isNotionUpstream(config: AppConfig): boolean {
    const url = getUpstreamUrl(config);
    return url.hostname.endsWith('notion.so') && url.pathname.includes('/api/v3/runInferenceTranscript');
}

function flattenMessageText(message: CursorChatRequest['messages'][number]): string {
    return (message.parts || [])
        .map((part) => part.text || '')
        .filter(Boolean)
        .join('\n')
        .trim();
}

function buildNotionTranscript(req: CursorChatRequest, config: AppConfig) {
    const now = new Date().toISOString();
    const userId = config.notionActiveUserId || 'local-user';
    const spaceId = config.notionSpaceId || 'local-space';
    const transcript: Array<Record<string, unknown>> = [
        {
            id: randomUUID(),
            type: 'config',
            value: {
                type: 'workflow',
                model: req.model,
                isHipaa: false,
                isMobile: false,
                yoloMode: false,
                writerMode: false,
                searchScopes: [{ type: 'everything' }],
                useWebSearch: true,
                isCustomAgent: false,
                modelFromUser: false,
                enableAgentAutomations: true,
                enableDatabaseAgents: true,
                enableCreateAndRunThread: true,
            },
        },
        {
            id: randomUUID(),
            type: 'context',
            value: {
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                userName: config.notionUserName || 'Local User',
                userId,
                userEmail: config.notionUserEmail || '',
                spaceName: config.notionSpaceName || 'Local Workspace',
                spaceId,
                spaceViewId: config.notionSpaceViewId || undefined,
                currentDatetime: now,
                surface: 'full_page_chat',
            },
        },
        {
            id: randomUUID(),
            type: 'updated-config',
        },
        {
            id: randomUUID(),
            type: 'updated-config',
        },
        {
            id: randomUUID(),
            type: 'updated-config',
        },
    ];

    for (const message of req.messages) {
        const text = flattenMessageText(message);
        if (!text) continue;
        const role = message.role === 'assistant' ? 'assistant' : 'user';
        const entry: Record<string, unknown> = {
            id: randomUUID(),
            type: role,
            value: [[text]],
            createdAt: now,
        };
        if (role === 'user') {
            entry.userId = userId;
        }
        transcript.push(entry);
    }

    return transcript;
}

function buildNotionPayload(req: CursorChatRequest, config: AppConfig): Record<string, unknown> {
    const spaceId = config.notionSpaceId || '';
    const threadId = config.notionThreadId || randomUUID();
    return {
        traceId: randomUUID(),
        spaceId,
        transcript: buildNotionTranscript(req, config),
        threadId,
        createThread: !config.notionThreadId,
        debugOverrides: {
            emitAgentSearchExtractedResults: true,
            cachedInferences: {},
            annotationInferences: {},
            emitInferences: false,
        },
        generateTitle: false,
        saveAllThreadOperations: true,
        setUnreadState: false,
        createdSource: 'full_page_chat',
        threadType: 'workflow',
        isPartialTranscript: true,
        asPatchResponse: true,
        isUserInAnySalesAssistedSpace: false,
        isSpaceSalesAssisted: false,
    };
}

function getChromeHeaders(): Record<string, string> {
    const config = getConfig();
    const upstreamUrl = getUpstreamUrl(config);
    const origin = config.upstreamOrigin || upstreamUrl.origin || DEFAULT_ORIGIN;
    const referer = config.upstreamReferer || `${origin}/`;

    if (isNotionUpstream(config)) {
        const headers: Record<string, string> = {
            'content-type': 'application/json',
            'accept': 'application/x-ndjson',
            'accept-language': config.notionAcceptLanguage || 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,en-GB;q=0.6',
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'notion-audit-log-platform': 'web',
            'notion-client-version': config.notionClientVersion || DEFAULT_NOTION_CLIENT_VERSION,
            'origin': origin,
            'referer': referer,
            'priority': 'u=1, i',
            'sec-ch-ua': config.notionSecChUa || '"Chromium";v="146", "Not-A.Brand";v="24", "Microsoft Edge";v="146"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': config.fingerprint.userAgent,
        };

        if (config.notionBaggage) {
            headers.baggage = config.notionBaggage;
        }
        if (config.notionSentryTrace) {
            headers['sentry-trace'] = config.notionSentryTrace;
        }
        if (config.notionActiveUserId) {
            headers['x-notion-active-user-header'] = config.notionActiveUserId;
        }
        if (config.notionSpaceId) {
            headers['x-notion-space-id'] = config.notionSpaceId;
        }
        if (config.cookie) {
            headers.cookie = config.cookie;
        }
        return headers;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'accept': '*/*',
        'sec-ch-ua-platform': '"macOS"',
        'x-path': upstreamUrl.pathname || '/chat',
        'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'x-method': 'POST',
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-arch': '"arm"',
        'sec-ch-ua-platform-version': '"14.6.1"',
        'dnt': '1',
        'origin': origin,
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': referer,
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'priority': 'u=1, i',
        'user-agent': config.fingerprint.userAgent,
        'x-is-human': '',
    };

    if (config.cookie) {
        headers.cookie = config.cookie;
    }

    return headers;
}

function extractUsage(candidate: any): { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined {
    const usage = candidate?.messageMetadata?.usage || candidate?.usage || candidate?.tokenUsage;
    if (!usage || typeof usage !== 'object') return undefined;
    return {
        inputTokens: usage.inputTokens ?? usage.input_tokens,
        outputTokens: usage.outputTokens ?? usage.output_tokens,
        totalTokens: usage.totalTokens ?? usage.total_tokens,
    };
}

function sanitizeNotionText(text: string): string {
    return text
        .replace(/<lang\b[^>]*\/>/gi, '')
        .replace(/\bprimary="[^"]*"\s*\/>/gi, '')
        .replace(/\s*<\/lang>\s*/gi, '');
}

function extractPatchDelta(
    candidate: any,
    streamIndexRef: { current: number },
    textPathsRef: { current: Set<string> },
): string {
    if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.v)) return '';

    let text = '';
    for (const op of candidate.v) {
        if (!op || typeof op !== 'object') continue;

        if (
            op.o === 'a' &&
            typeof op.p === 'string' &&
            op.p === '/s/-'
        ) {
            const basePath = `/s/${streamIndexRef.current}`;
            streamIndexRef.current += 1;
            const step = op.v;
            if (
                step &&
                typeof step === 'object' &&
                step.type === 'agent-inference' &&
                Array.isArray(step.value)
            ) {
                step.value.forEach((item: any, index: number) => {
                    if (item?.type === 'text' && typeof item.content === 'string') {
                        textPathsRef.current.add(`${basePath}/value/${index}/content`);
                        text += item.content;
                    }
                });
            }
            continue;
        }

        if (
            op.o === 'x' &&
            typeof op.p === 'string' &&
            textPathsRef.current.has(op.p) &&
            typeof op.v === 'string'
        ) {
            text += op.v;
            continue;
        }
    }

    return sanitizeNotionText(text);
}

function extractRecordMapDelta(candidate: any): string {
    if (!candidate || typeof candidate !== 'object' || candidate.type !== 'record-map') return '';
    const threadMessage = candidate.recordMap?.thread_message;
    if (!threadMessage || typeof threadMessage !== 'object') return '';

    let text = '';
    for (const entry of Object.values(threadMessage as Record<string, any>)) {
        const stepValue = entry?.value?.value?.step?.value;
        if (!Array.isArray(stepValue)) continue;
        for (const item of stepValue) {
            if (item && typeof item === 'object' && item.type === 'text' && typeof item.content === 'string') {
                text += item.content;
            }
        }
    }
    return sanitizeNotionText(text);
}

function extractNotionDelta(
    candidate: any,
    streamIndexRef: { current: number },
    textPathsRef: { current: Set<string> },
    seenTextRef: { current: string },
): string {
    if (!candidate || typeof candidate !== 'object') return '';
    if (candidate.type === 'patch') {
        return extractPatchDelta(candidate, streamIndexRef, textPathsRef);
    }
    if (candidate.type === 'record-map') {
        if (seenTextRef.current) return '';
        return extractRecordMapDelta(candidate);
    }
    return '';
}

function parseSseChunk(
    chunk: string,
    onChunk: (event: CursorSSEEvent) => void,
): void {
    for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
            const event: CursorSSEEvent = JSON.parse(data);
            onChunk(event);
        } catch {
            // ignore malformed lines
        }
    }
}

function parseNdjsonChunk(
    chunk: string,
    onChunk: (event: CursorSSEEvent) => void,
    usageRef: { current?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } },
    seenTextRef: { current: string },
    debugRef: { lines: number },
    debugEventsRef: { current: string[] },
    streamIndexRef: { current: number },
    textPathsRef: { current: Set<string> },
): void {
    for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const event = JSON.parse(trimmed);
            if (event?.type === 'patch-start' && Array.isArray(event?.data?.s)) {
                streamIndexRef.current = event.data.s.length;
            }
            if (debugRef.lines < 8) {
                const preview = trimmed.length > 600 ? `${trimmed.slice(0, 600)}...` : trimmed;
                console.log(`[NotionRaw ${debugRef.lines + 1}] ${preview}`);
                debugEventsRef.current.push(preview);
            }
            debugRef.lines++;
            const usage = extractUsage(event);
            if (usage) {
                usageRef.current = usage;
            }
            if (event?.type === 'patch' && Array.isArray(event.v)) {
                for (const op of event.v) {
                    if (!op || typeof op !== 'object') continue;
                    if (typeof op.p === 'string' && /\/(inputTokens|maxContextTokens|outputTokens|maxInputTokens|cachedTokensRead)$/.test(op.p)) {
                        usageRef.current = {
                            ...usageRef.current,
                            inputTokens: op.p.endsWith('/inputTokens') ? op.v : usageRef.current?.inputTokens,
                            outputTokens: op.p.endsWith('/outputTokens') ? op.v : usageRef.current?.outputTokens,
                            totalTokens: usageRef.current?.totalTokens,
                        };
                    }
                }
            }
            const delta = extractNotionDelta(event, streamIndexRef, textPathsRef, seenTextRef);
            if (delta) {
                let emit = delta;
                if (event?.type === 'record-map') {
                    if (seenTextRef.current && delta.startsWith(seenTextRef.current)) {
                        emit = delta.slice(seenTextRef.current.length);
                    } else if (seenTextRef.current.includes(delta)) {
                        emit = '';
                    }
                }
                if (emit) {
                    seenTextRef.current += emit;
                    const deltaPreview = emit.length > 200 ? `${emit.slice(0, 200)}...` : emit;
                    console.log(`[NotionDelta] ${JSON.stringify(deltaPreview)}`);
                    onChunk({ type: 'text-delta', delta: emit });
                }
            }
        } catch {
            // ignore malformed lines
        }
    }
}

export async function sendCursorRequest(
    req: CursorChatRequest,
    onChunk: (event: CursorSSEEvent) => void,
    externalSignal?: AbortSignal,
): Promise<void> {
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await sendCursorRequestInner(req, onChunk, externalSignal);
            return;
        } catch (err) {
            if (externalSignal?.aborted) throw err;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[Cursor] 请求失败 (${attempt}/${maxRetries}): ${msg.substring(0, 200)}`);
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, 2000));
            } else {
                throw err;
            }
        }
    }
}

async function sendCursorRequestInner(
    req: CursorChatRequest,
    onChunk: (event: CursorSSEEvent) => void,
    externalSignal?: AbortSignal,
): Promise<void> {
    const config = getConfig();
    const upstreamUrl = getUpstreamUrl(config);
    const useStealthProxy = !!config.stealthProxy;
    const notionUpstream = isNotionUpstream(config);
    const targetUrl = useStealthProxy
        ? `${config.stealthProxy!.replace(/\/$/, '')}/proxy/chat`
        : upstreamUrl.toString();
    const headers = useStealthProxy ? { 'Content-Type': 'application/json' } : getChromeHeaders();
    const requestBody = notionUpstream ? buildNotionPayload(req, config) : req;

    const controller = new AbortController();
    if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const idleTimeoutMs = config.timeout * 1000;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
    };
    resetIdleTimer();

    try {
        const fetchOptions = useStealthProxy ? {} : getProxyFetchOptions();
        const resp = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
            ...fetchOptions,
        } as any);

        if (!resp.ok) {
            const body = await resp.text();
            throw new Error(`Cursor API 错误: HTTP ${resp.status} - ${body}`);
        }

        if (!resp.body) {
            throw new Error('Cursor API 响应无 body');
        }

        const contentType = resp.headers.get('content-type') || '';
        const parseAsNdjson = notionUpstream || contentType.includes('application/x-ndjson');
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const usageRef: { current?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } } = {};
        const seenTextRef: { current: string } = { current: '' };
        const debugRef: { lines: number } = { lines: 0 };
        const debugEventsRef: { current: string[] } = { current: [] };
        const streamIndexRef: { current: number } = { current: 0 };
        const textPathsRef: { current: Set<string> } = { current: new Set() };
        let rawChunkCount = 0;

        debugEventsRef.current.push(`[meta] status=${resp.status} content-type=${contentType || '(empty)'} parseAsNdjson=${parseAsNdjson}`);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            resetIdleTimer();
            const decodedChunk = decoder.decode(value, { stream: true });
            if (rawChunkCount < 4) {
                const preview = decodedChunk.length > 600 ? `${decodedChunk.slice(0, 600)}...` : decodedChunk;
                debugEventsRef.current.push(`[chunk ${rawChunkCount + 1}] ${preview || '(empty chunk)'}`);
            }
            rawChunkCount++;
            buffer += decodedChunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            const chunk = lines.join('\n');
            if (!chunk) continue;
            if (parseAsNdjson) {
                parseNdjsonChunk(chunk, onChunk, usageRef, seenTextRef, debugRef, debugEventsRef, streamIndexRef, textPathsRef);
            } else {
                parseSseChunk(chunk, onChunk);
            }
        }

        if (buffer.trim()) {
            if (rawChunkCount < 4) {
                const preview = buffer.length > 600 ? `${buffer.slice(0, 600)}...` : buffer;
                debugEventsRef.current.push(`[tail] ${preview}`);
            }
            if (parseAsNdjson) {
                parseNdjsonChunk(buffer, onChunk, usageRef, seenTextRef, debugRef, debugEventsRef, streamIndexRef, textPathsRef);
            } else {
                parseSseChunk(buffer, onChunk);
            }
        }

        onChunk({
            type: 'finish',
            debug: debugEventsRef.current,
            messageMetadata: usageRef.current ? { usage: usageRef.current } : undefined,
        });
    } finally {
        if (idleTimer) clearTimeout(idleTimer);
    }
}

export async function sendCursorRequestFull(req: CursorChatRequest): Promise<{ text: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }> {
    let fullText = '';
    let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
    await sendCursorRequest(req, (event) => {
        if (event.type === 'text-delta' && event.delta) {
            fullText += event.delta;
        }
        if (event.messageMetadata?.usage) {
            usage = event.messageMetadata.usage;
        }
    });
    return { text: fullText, usage };
}
