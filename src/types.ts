// ==================== Anthropic API Types ====================

export interface AnthropicRequest {
    model: string;
    messages: AnthropicMessage[];
    max_tokens: number;
    stream?: boolean;
    system?: string | AnthropicContentBlock[];
    tools?: AnthropicTool[];
    tool_choice?: AnthropicToolChoice;
    temperature?: number;
    top_p?: number;
    stop_sequences?: string[];
    thinking?: { type: 'enabled' | 'disabled' | 'adaptive'; budget_tokens?: number };
}

export type AnthropicToolChoice =
    | { type: 'auto' }
    | { type: 'any' }
    | { type: 'tool'; name: string };

export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
    type: 'text' | 'tool_use' | 'tool_result' | 'image';
    text?: string;
    source?: { type: string; media_type?: string; data: string; url?: string };
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string | AnthropicContentBlock[];
    is_error?: boolean;
}

export interface AnthropicTool {
    name: string;
    description?: string;
    input_schema: Record<string, unknown>;
}

export interface AnthropicResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    content: AnthropicContentBlock[];
    model: string;
    stop_reason: string;
    stop_sequence: string | null;
    usage: { input_tokens: number; output_tokens: number };
}

// ==================== Upstream Request Types ====================

export interface CursorChatRequest {
    context?: CursorContext[];
    model: string;
    id: string;
    messages: CursorMessage[];
    trigger: string;
}

export interface CursorContext {
    type: string;
    content: string;
    filePath: string;
}

export interface CursorMessage {
    parts: CursorPart[];
    id: string;
    role: string;
}

export interface CursorPart {
    type: string;
    text: string;
}

export interface CursorSSEEvent {
    type: string;
    delta?: string;
    finishReason?: string;
    debug?: unknown;
    messageMetadata?: {
        usage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
        };
    };
}

// ==================== Internal Types ====================

export interface ParsedToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface AppConfig {
    port: number;
    timeout: number;
    proxy?: string;
    cursorModel: string;
    upstreamChatApi?: string;
    upstreamOrigin?: string;
    upstreamReferer?: string;
    challengeUrl?: string;
    notionActiveUserId?: string;
    notionSpaceId?: string;
    notionThreadId?: string;
    notionClientVersion?: string;
    notionSpaceViewId?: string;
    notionAcceptLanguage?: string;
    notionBaggage?: string;
    notionSentryTrace?: string;
    notionSecChUa?: string;
    notionUserName?: string;
    notionUserEmail?: string;
    notionSpaceName?: string;
    modelMap?: Record<string, string>;
    authTokens?: string[];
    maxAutoContinue: number;
    maxHistoryMessages: number;
    maxHistoryTokens: number;
    vision?: {
        enabled: boolean;
        mode: 'ocr' | 'api';
        baseUrl: string;
        apiKey: string;
        model: string;
        proxy?: string;
    };
    compression?: {
        enabled: boolean;
        level: 1 | 2 | 3;
        keepRecent: number;
        earlyMsgMaxChars: number;
    };
    thinking?: {
        enabled: boolean;
    };
    logging?: {
        file_enabled: boolean;
        dir: string;
        max_days: number;
        persist_mode: 'compact' | 'full' | 'summary';
        db_enabled: boolean;
        db_path: string;
    };
    tools?: {
        schemaMode: 'compact' | 'full' | 'names_only';
        descriptionMaxLength: number;
        includeOnly?: string[];
        exclude?: string[];
        passthrough?: boolean;
        disabled?: boolean;
        adaptiveBudget?: boolean;
        smartTruncation?: boolean;
    };
    sanitizeEnabled: boolean;
    contextPressure?: number;
    refusalPatterns?: string[];
    systemPrompt?: string;
    cookie?: string;
    stealthProxy?: string;
    fingerprint: {
        userAgent: string;
    };
}
