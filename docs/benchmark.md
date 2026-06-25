# Benchmark

Benchmarking is used to compare behavior before and after scaffold.

```bash
npx claude-token-stack benchmark baseline
npx claude-token-stack benchmark post
npx claude-token-stack collect-metrics .token-stack/reports
npx claude-token-stack compare-metrics .token-stack/reports
```

The runner reads `.token-stack/benchmark.config.json` or `BENCHMARK_CONFIG=/path/to/config.json`. Without a config file it uses the built-in `code-discovery`, `test-failure`, and `long-log` tasks.

Example config:

```bash
cp docs/examples/benchmark.config.example.json .token-stack/benchmark.config.json
npx claude-token-stack benchmark synthetic-only
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

Synthetic-only evidence is not representative enough to recommend block mode. Metric records with missing `evidence_type` or `evidence_type: synthetic` also keep `recommend_enter_block` false. Use `evidence_type: real` or `mixed` baseline/post artifacts before changing team defaults.

`recommend_enter_block` also requires promotion evidence in the target repo: `verify-report.json`, hook logs, and valid `.token-stack/reports/false-positive-review.json`.
