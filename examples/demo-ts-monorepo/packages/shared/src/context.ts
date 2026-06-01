export function formatContextBudget(inputTokens: number): string {
  if (inputTokens > 20000) return "review-required";
  if (inputTokens > 8000) return "watch";
  return "ok";
}
