# Benchmark

Benchmarking is used to compare behavior before and after scaffold.

```bash
npx claude-token-stack benchmark baseline
npx claude-token-stack benchmark post
npx claude-token-stack collect-metrics .token-stack/reports
npx claude-token-stack compare-metrics .token-stack/reports
```

## Metrics

- `input_tokens`
- `output_tokens`
- `cache_creation_input_tokens`
- `cache_read_input_tokens`
- `total_cost_usd`
- cache hit rate
- high-noise command count
- raw large-output events
- task success

## Interpretation

Do not judge only by total cost. Some post runs may cost more if the model produces a better diagnostic. The target is fewer wasteful context events without reducing task success.
