import { formatContextBudget } from "../../../packages/shared/src/context";

export function renderBudgetLabel(inputTokens: number): string {
  return `web:${formatContextBudget(inputTokens)}`;
}
