import { NextRequest, NextResponse } from "next/server";
import { normalizePracticeRecommendation, sanitizePracticeRecommendationRequestBody } from "../../../lib/ai-practice-recommendation";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 18_000;
const TIMEOUT_MS = 18_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
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
  if (contentLength > MAX_BODY_BYTES) return errorResponse("请求内容过长，请减少候选任务后再试。", 413);
  if (!checkRateLimit(clientId(request))) return errorResponse("推荐次数过多，请稍后再试。", 429);

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return errorResponse("AI 服务还没有配置 API Key。", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("请求格式无效。");
  }

  const { data, allowedTaskIds, error } = sanitizePracticeRecommendationRequestBody(body);
  if (!data || !allowedTaskIds?.length) return errorResponse(error ?? "请求内容无效。");

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
            content: [
              "你是 GroovinLog 的街舞练习推荐助手。",
              "你只能从用户提供的 existing active practice tasks 中挑选现在值得练的任务。",
              "不要创建新任务，不要修改任务，不要推荐不存在的 taskId。",
              "不要评价用户舞蹈能力强弱，不要说某个 Focus 是能力短板。",
              "训练记录只能说明练习频率和记录状态，不代表能力水平。",
              "推荐理由要短，基于高优先级、最近是否练过、Focus 分布、nextFocus 或未消化课堂内容进行解释。",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              allowedTaskIds,
              recommendationRules: [
                "最多推荐 3 个已有 task。",
                "priority 使用 1、2、3，1 表示最建议先练。",
                "reason 用简短中文，不超过 120 字。",
                "sessionNote 最多 1-2 句话，帮助用户降低开始练习的心理成本。",
                "不要把 Oldest Task 简单等同于最高优先级。",
                "不要把 Most Practiced Focus 简单等同于最重要。",
              ],
              recommendationData: data,
            }),
          },
        ],
        temperature: 0.2,
        max_output_tokens: 800,
        text: {
          format: {
            type: "json_schema",
            name: "groovinlog_practice_recommendation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["recommendations", "sessionNote"],
              properties: {
                recommendations: {
                  type: "array",
                  minItems: 1,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["taskId", "reason", "priority"],
                    properties: {
                      taskId: { type: "string", enum: allowedTaskIds },
                      reason: { type: "string", minLength: 1, maxLength: 140 },
                      priority: { type: "integer", minimum: 1, maximum: 3 },
                    },
                  },
                },
                sessionNote: { type: "string", maxLength: 180 },
              },
            },
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) return errorResponse(payload?.error?.message ?? "AI 推荐失败，请稍后重试。", response.status);

    const text = extractResponseText(payload);
    if (!text) return errorResponse("AI 没有返回可用推荐，请重试。", 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return errorResponse("AI 返回格式不可用，请重试。", 502);
    }

    const recommendation = normalizePracticeRecommendation(parsed, allowedTaskIds);
    if (!recommendation) return errorResponse("AI 没有返回可用任务推荐，请稍后重试。", 502);
    return NextResponse.json({ recommendation });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return errorResponse("AI 推荐超时，请稍后重试。", 504);
    return errorResponse("AI 推荐失败，请检查网络或稍后重试。", 502);
  } finally {
    clearTimeout(timeout);
  }
}
