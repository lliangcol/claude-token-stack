# Agent Benchmark Runbook

## Baseline

Run before scaffold:

```bash
npx claude-token-stack benchmark baseline
```

## Post

Run after scaffold:

```bash
npx claude-token-stack benchmark post
```

## Compare

```bash
npx claude-token-stack collect-metrics .token-stack/reports
npx claude-token-stack compare-metrics .token-stack/reports
```
