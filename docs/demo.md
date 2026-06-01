# Claude Token Stack Demo

This demo shows the minimum visible behavior a maintainer should see before trying the stack on a real repository.

## 1. Scaffold

```bash
npm install
node bin/cts.js scaffold --target .tmp/demo-review
```

Expected result: the target repository receives `.claude/` policy, hook, output-style, rollback, and `.token-stack/` report paths.

## 2. Warn on noisy shell output

Run a hook smoke event that resembles an agent asking for a raw directory tree:

```bash
export CLAUDE_PROJECT_DIR="$PWD/.tmp/demo-review"
echo '{"tool_name":"Bash","tool_input":{"command":"tree"}}' \
  | node .tmp/demo-review/.claude/hooks/run-python-hook.js \
      .tmp/demo-review/.claude/hooks/bash-token-guard.py
```

Representative log output:

```json
{"command":"tree","violations":["Avoid raw tree. Use targeted rg --files with a narrow path."],"advisories":[],"mode":"warn"}
```

## 3. Block broad code discovery after tuning

Run the code-discovery gate in block mode for a deliberately broad search:

```bash
export CLAUDE_PROJECT_DIR="$PWD/.tmp/demo-review"
echo '{"tool_name":"Grep","tool_input":{"pattern":"TODO","path":".","glob":"**/*"}}' \
  | CBM_GATE_MODE=block node .tmp/demo-review/.claude/hooks/run-python-hook.js \
      .tmp/demo-review/.claude/hooks/cbm-gate.py
```

Representative log output:

```json
{"tool_name":"Grep","mode":"block","block_reasons":["broad Grep path","broad Grep glob"]}
```

## 4. Collect local evidence

```bash
node bin/cts.js collect-metrics .tmp/demo-review/.token-stack/reports
node bin/cts.js compare-metrics .tmp/demo-review/.token-stack/reports
```

Representative summary:

```text
recommend_enter_block: false
cost_change_usd: 0
```

Treat this as wiring evidence only. Use representative baseline/post tasks before enabling stricter block behavior in a production repository.

## 5. Roll back

```bash
export TOKEN_GUARD_MODE=off
export CBM_GATE_MODE=off
```

For file removal, follow [rollback.md](rollback.md).
