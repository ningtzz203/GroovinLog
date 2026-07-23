import { NextRequest, NextResponse } from "next/server";
import { normalizeWeeklyInsight, sanitizeWeeklyInsightRequestBody } from "../../../lib/ai-weekly-insight";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 20_000;
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
  if (contentLength > MAX_BODY_BYTES) return errorResponse("请求内容过长，请减少本周记录后再试。", 413);
  if (!checkRateLimit(clientId(request))) return errorResponse("生成次数过多，请稍后再试。", 429);

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return errorResponse("AI 服务还没有配置 API Key。", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("请求格式无效。");
  }

  const { data, error } = sanitizeWeeklyInsightRequestBody(body);
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
            content: [
              "你是 GroovinLog 的街舞周复盘观察助手。",
              "你只能基于用户提供的本周记录做简短观察，必须区分事实和建议。",
              "不要评价用户舞蹈水平，不要说用户擅长或不擅长，不要生成能力画像或评分。",
              "训练频率不等于能力水平；没有 Practice Log 只能说明记录中暂未看到对应练习。",
              "如果数据较少，请明确保持保守，用“目前记录中”“从已记录内容看”等表达。",
              "不要创建任务，不要修改计划，只给用户可参考的观察。",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              outputRules: {
                summary: "1 个简短中文段落，优先总结本周记录中明确出现的学习和练习。",
                patterns: "最多 3 条，写记录中可见的重复 Focus、练习内容或节奏。",
                gaps: "最多 3 条，写课堂内容和练习记录之间的缺口；不要责备用户。",
                nextWeekSuggestions: "最多 3 条，写轻量建议，不要替用户决定完整训练计划。",
              },
              weeklyData: data,
            }),
          },
        ],
        temperature: 0.2,
        max_output_tokens: 900,
        text: {
          format: {
            type: "json_schema",
            name: "groovinlog_weekly_insight",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["summary", "patterns", "gaps", "nextWeekSuggestions"],
              properties: {
                summary: { type: "string", minLength: 1, maxLength: 220 },
                patterns: {
                  type: "array",
                  maxItems: 3,
                  items: { type: "string", minLength: 1, maxLength: 140 },
                },
                gaps: {
                  type: "array",
                  maxItems: 3,
                  items: { type: "string", minLength: 1, maxLength: 140 },
                },
                nextWeekSuggestions: {
                  type: "array",
                  maxItems: 3,
                  items: { type: "string", minLength: 1, maxLength: 140 },
                },
              },
            },
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) return errorResponse(payload?.error?.message ?? "AI Insight 生成失败，请稍后重试。", response.status);

    const text = extractResponseText(payload);
    if (!text) return errorResponse("AI 没有返回可用内容，请重试。", 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return errorResponse("AI 返回格式不可用，请重试。", 502);
    }

    const insight = normalizeWeeklyInsight(parsed);
    if (!insight) return errorResponse("AI 没有生成可用 Insight，请稍后重试。", 502);
    return NextResponse.json({ insight, sparseData: data.stats.sparseData });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return errorResponse("AI Insight 生成超时，请稍后重试。", 504);
    return errorResponse("AI Insight 生成失败，请检查网络或稍后重试。", 502);
  } finally {
    clearTimeout(timeout);
  }
}
