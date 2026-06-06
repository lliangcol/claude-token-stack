# claude-token-stack 中文说明

`claude-token-stack` 是一个面向 Claude Code 和 AI coding agent 的仓库级上下文治理工具包。它不是单点 token 压缩工具，而是把策略、hook、MCP 使用建议、验证报告、benchmark 和回滚文档放到同一个可审查的闭环里。

适合的场景：一个仓库会被 agent 反复处理，团队希望减少明显浪费的上下文读取，同时保留可解释的试用、验证和回滚路径。

## 它解决什么问题

很多 token 浪费不是来自模型本身，而是来自仓库操作习惯：

- 直接运行 `tree`、`ls -R`、`grep -R`、宽泛 `find` 或整段日志输出；
- 在定位符号、调用链或片段之前读取整文件；
- 多个 MCP 或代码检索工具输出重复上下文；
- generated、vendor、build、lock、log 文件进入提示词；
- 没有 baseline/post benchmark 就切换到强约束；
- 项目本地没有 agent 行为规则，每次会话都重新摸索。

`claude-token-stack` 的定位是上下文治理：先提醒、再验证、再用证据决定是否更严格。

## 30 秒试用

在本仓库 checkout 中运行：

```bash
npm install
node bin/cts.js scaffold --target .tmp/demo-review
node bin/cts.js doctor --target .tmp/demo-review --no-write
node bin/cts.js verify --target .tmp/demo-review
```

你应该看到生成到目标仓库的 `.claude/` 策略、hook、输出风格和 `.token-stack/reports/` 报告路径。

这只是 synthetic/demo evidence，证明 wiring 打通；它不等于真实仓库节省证明。

## 适合谁

适合：

- 维护一个经常被 Claude Code 或其他 coding agent 处理的仓库；
- 想把 agent 的读文件、搜索、日志输出行为变成项目规则；
- 想先 warn-first 收集误报和报告，再决定是否 block；
- 需要 Windows PowerShell、Git Bash、WSL2、macOS、Linux 的明确边界说明；
- 想用报告而不是口号判断是否进入更严格模式。

不适合：

- 只想要一个压缩 prompt 的命令；
- 想要固定百分比 token savings 承诺；
- 想让工具自动读取 secrets 或上传私有仓库数据；
- 不愿意做 baseline/post 验证，却希望直接开启强制 block。

## 默认安全边界

- offline-first、local-first；
- warn-first，不默认 block；
- remote optional install 默认关闭；
- 不使用 `curl | sh`；
- 不使用 `dangerously-skip-permissions`；
- 不读取 secrets；
- savings 数字必须来自 demo、synthetic benchmark 或真实 case report，并说明证据类型。

## 验证

仓库自身验证：

```bash
npm run check:native
npm test
npm pack --dry-run
```

目标仓库验证：

```bash
node bin/cts.js doctor --target /path/to/your-repo --json --no-write
node bin/cts.js audit-hooks --target /path/to/your-repo --json --no-write
node bin/cts.js verify --target /path/to/your-repo
```

常见证据文件：

- `.token-stack/reports/verify-report.md`
- `.token-stack/reports/verify-report.json`
- `.token-stack/reports/baseline/*.json`
- `.token-stack/reports/post/*.json`
- `.token-stack/reports/metrics-summary.json`
- `.token-stack/reports/metrics-summary.md`

## Benchmark

synthetic benchmark 用于确认流程是否打通：

```bash
node bin/cts.js benchmark synthetic-only --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
```

benchmark 可以读取 `.token-stack/benchmark.config.json`。真实节省需要在代表性任务上做 baseline/post 对比。不要把 demo 输出写成真实 savings claim。

本地上下文包、日志和 usage 证据：

```bash
node bin/cts.js pack-context --target . --budget 60000
node bin/cts.js analyze-logs --target .
node bin/cts.js ingest-usage --target .
node bin/cts.js events record --target . --type rollout --message "warn-mode smoke complete"
```

## 回滚

快速关闭 hook：

```bash
export TOKEN_GUARD_MODE=off
export CBM_GATE_MODE=off
```

PowerShell：

```powershell
$env:TOKEN_GUARD_MODE = "off"
$env:CBM_GATE_MODE = "off"
```

如果 scaffold 改动了已有文件，会先生成 `.bak.*` 备份。完整删除路径见 [docs/rollback.md](docs/rollback.md)。

## Windows / Git Bash / WSL2 边界

PowerShell 推荐执行：

```powershell
node .\bin\cts.js scaffold --target .
node .\bin\cts.js doctor --target . --no-write
node .\bin\cts.js audit-hooks --target . --no-write
node .\bin\cts.js pack-context --target . --json --no-write
node .\bin\cts.js collect-metrics .token-stack\reports
node .\bin\cts.js compare-metrics .token-stack\reports
```

`verify`、`benchmark`、`install-tools` 和 `all` 会调用 Bash 脚本。Windows 上请在 Git Bash 或 WSL2 中执行这些命令，并给带空格的路径加引号。

## 下一步

- 英文主页：[README.md](README.md)
- 实现原理 / How it works：[docs/architecture.md](docs/architecture.md)
- 可复制 demo：[examples/README.md](examples/README.md)
- demo 说明：[docs/demo.md](docs/demo.md)
- synthetic case study：[docs/case-studies/synthetic-demo.md](docs/case-studies/synthetic-demo.md)
- v0.1.0-rc 人工 checklist：[docs/release/v0.1.0-rc-checklist.md](https://github.com/lliangcol/claude-token-stack/blob/main/docs/release/v0.1.0-rc-checklist.md)
