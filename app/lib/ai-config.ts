const DEFAULT_AI_BASE_URL = "https://coloful-rose.com/v1";

export function getAiEndpoint() {
  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/responses`;
}

export function getAiModel() {
  const model = process.env.AI_MODEL?.trim();
  return model || null;
}
