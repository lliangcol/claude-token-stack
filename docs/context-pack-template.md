# Context Pack Template

Optional template for bounded handoffs when open-ended file reads or long
reports would waste context. It supports token governance only; it is not a
general project planning artifact.

## Topic

- Task:
- Repository:
- Scope boundary:

## Evidence

List top-k evidence only. Prefer already-known symbols, short snippets, and
targeted reads. If a code-discovery MCP is available, use only one reviewed
route to avoid duplicate context.

| Rank | Source | Evidence | Why it matters |
| --- | --- | --- | --- |
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |

## Bounded Snippets

Keep snippets short and cite file paths or symbol names. Do not paste whole files.

```text
source:
snippet:
```

## Risks

- False positives:
- Missing context:
- Token-heavy follow-up to avoid:

## Verification Checklist

- One reviewed code-discovery route was used when available, or the project was not indexed.
- Broad `Read`, `Grep`, `Glob`, and recursive shell search were avoided.
- Generated, vendor, build, lock, log, and secret-like paths were excluded.
- Test/build/log output was summarized before being placed in context.
