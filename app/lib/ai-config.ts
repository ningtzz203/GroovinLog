const DEFAULT_AI_BASE_URL = "https://coloful-rose.com/v1";

export const AI_REQUEST_TIMEOUT_MS = 55_000;

export function getAiEndpoint() {
  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/responses`;
}

export function getAiModel() {
  const model = process.env.AI_MODEL?.trim();
  return model || null;
}

export function getAiProviderHostname() {
  try {
    return new URL(getAiEndpoint()).hostname;
  } catch {
    return "invalid-ai-provider-url";
  }
}

export function logAiTiming(event: {
  route: string;
  model: string;
  startTimestamp: string;
  roseElapsedMs?: number;
  httpStatus?: number | null;
  totalElapsedMs: number;
  outcome: "success" | "upstream-error" | "timeout" | "error";
}) {
  const payload = {
    route:event.route,
    model:event.model,
    providerHostname:getAiProviderHostname(),
    startTimestamp:event.startTimestamp,
    roseElapsedMs:event.roseElapsedMs,
    httpStatus:event.httpStatus,
    totalElapsedMs:event.totalElapsedMs,
    outcome:event.outcome,
  };
  if (event.outcome === "success") {
    console.info("[groovinlog-ai] timing", payload);
    return;
  }
  console.warn("[groovinlog-ai] timing", payload);
}
