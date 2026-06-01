import { formatContextBudget } from "../../../packages/shared/src/context";

export function handleBudgetProbe(inputTokens: number): { label: string; inputTokens: number } {
  return {
    label: `api:${formatContextBudget(inputTokens)}`,
    inputTokens
  };
}
