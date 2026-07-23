import { NextRequest, NextResponse } from "next/server";
import { FOCUS_TAGS } from "../../../lib/models";
import { normalizeAiTaskDrafts, sanitizeAiRequestBody } from "../../../lib/ai-practice";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 12_000;
const TIMEOUT_MS = 18_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 12;
const DEFAULT_AI_BASE_URL = "https://coloful-rose.com/v1";
const DEFAULT_AI_MODEL = "gpt-5.4";

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

function clientId(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

function checkRateLimit(id: string) {
  const now = Date.now();
  const bucket = rateBuckets.get(id);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function aiEndpoint() {
  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/responses`;
}

function extractResponseText(value: unknown) {
  const response = value as { output_text?: unknown; output?: { content?: { text?: unknown }[] }[] };
  if (typeof response.output_text === "string") return response.output_text;
  return response.output?.flatMap(item => item.content ?? []).map(item => item.text).find(text => typeof text === "string") as string | undefined;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return errorResponse("请求内容过长，请精简课堂复盘后再试。", 413);
  if (!checkRateLimit(clientId(request))) return errorResponse("生成次数过多，请稍后再试。", 429);

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return errorResponse("AI 服务还没有配置 API Key。", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("请求格式无效。");
  }

  const { data, error } = sanitizeAiRequestBody(body);
  if (!data) return errorResponse(error ?? "请求内容无效。");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(aiEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? DEFAULT_AI_MODEL,
        input: [
          {
            role: "system",
            content: "你是 GroovinLog 的街舞练习任务助手。只根据用户给出的课程复盘生成可执行的练习任务草稿。不要编造课堂中没有出现的具体动作。优先使用允许的 Focus Tags。不要自动保存任务。",
          },
          {
            role: "user",
            content: JSON.stringify({
              allowedFocusTags: FOCUS_TAGS,
              maxTasks: 3,
              taskRules: [
                "title 用简短中文，必要时保留街舞术语英文。",
                "keyPoints 写 1-2 个练习要点，不要超过 80 个中文字符。",
                "focusTags 只能从 allowedFocusTags 中选择 1 个最核心的 Focus。",
                "suggestedDurationMinutes 优先接近 defaultPracticeDuration，可在 5 到 60 分钟内调整。",
                "避免和 existingTasks 重复。",
              ],
              classReview: data,
            }),
          },
        ],
        temperature: 0.25,
        max_output_tokens: 1000,
        text: {
          format: {
            type: "json_schema",
            name: "groovinlog_practice_task_drafts",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["tasks"],
              properties: {
                tasks: {
                  type: "array",
                  minItems: 1,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "keyPoints", "focusTags", "suggestedDurationMinutes", "isHighPriority"],
                    properties: {
                      title: { type: "string", minLength: 1, maxLength: 80 },
                      keyPoints: { type: "string", maxLength: 220 },
                      focusTags: {
                        type: "array",
                        minItems: 1,
                        maxItems: 1,
                        items: { type: "string", enum: FOCUS_TAGS },
                      },
                      suggestedDurationMinutes: { type: "integer", minimum: 5, maximum: 60 },
                      isHighPriority: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) return errorResponse(payload?.error?.message ?? "AI 生成失败，请稍后重试。", response.status);

    const text = extractResponseText(payload);
    if (!text) return errorResponse("AI 没有返回可用内容，请重试。", 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return errorResponse("AI 返回格式不可用，请重试。", 502);
    }

    const tasks = normalizeAiTaskDrafts(parsed, data.defaultPracticeDuration);
    if (!tasks.length) return errorResponse("AI 没有生成可用任务，请重试或手动创建。", 502);
    return NextResponse.json({ tasks });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return errorResponse("AI 生成超时，请稍后重试。", 504);
    return errorResponse("AI 生成失败，请检查网络或稍后重试。", 502);
  } finally {
    clearTimeout(timeout);
  }
}
