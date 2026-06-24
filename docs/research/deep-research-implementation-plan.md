# claude-token-stack 深度研究完整实施方案

本文档根据 `D:\Documents\GitHub\claude-token-stack\deep-research-report.md` 生成，并结合当前仓库结构整理为可执行实施方案。范围覆盖短期修复、中期重构、长期发布成熟化与 v1.0 稳定化任务。

## 1. 实施目标

### 1.1 总目标

把 `claude-token-stack` 从 `v0.1.0-rc` 阶段的脚本和模板工具包，推进为一个低依赖、跨平台、可审计、可回归、可发布的 Claude Code token/context 治理 CLI。

### 1.2 目标边界

- 保持零 npm 运行时依赖优先，只有收益明确时才引入开发依赖。
- 保持 CLI public surface 兼容：`claude-token-stack`、`cts` 和既有命令名不做破坏性改名。
- 保持默认本地优先、warn-first、远程安装显式 opt-in。
- 不宣传固定 token 节省比例；所有节省声明必须区分 `synthetic`、`real`、`mixed` 证据类型。
- 所有会影响 rollout 决策的指标必须有 golden tests 或 schema 约束。

### 1.3 优先级规则

优先级按以下顺序判断：

1. 正确性：会影响 `recommend_enter_block`、成本、token 汇总、风险判断的任务最高优先。
2. 安全：供应链、secrets 泄漏、远程安装、CI 权限和 release provenance 紧随其后。
3. 可回归性：测试、fixtures、golden files、schema、coverage。
4. 可维护性：`bin/` 单文件逻辑拆分到 `src/`。
5. 性能：大仓库扫描、日志聚合、报告生成。
6. 文档和采用体验：安装、迁移、排障、案例、issue/PR 模板。

## 2. 总体路线图

### 2.1 版本目标

| 版本 | 目标 | 主要交付 |
|---|---|---|
| `v0.1.x` | 正确性和安全收口 | 修复 `compare-metrics.py`，补 golden tests，收紧 CI 权限，补基础安全 workflow |
| `v0.2` | 可维护性重构 | 建立 `src/` 模块层，`bin/cts.js` 变为薄 CLI，扩展 context pack 和 metrics |
| `v0.3` | 发布成熟化 | release workflow、trusted publishing、attestation、Dependabot、CodeQL、迁移文档 |
| `v0.4-v0.9` | 采用体验和真实证据 | case studies、性能基线、真实 rollout playbook、稳定 schema |
| `v1.0` | 稳定承诺 | CLI/API/schema 兼容承诺、跨平台验证矩阵、正式安全和发布流程 |

### 2.2 阶段安排

| 阶段 | 时间建议 | 主题 | 必须完成后才能进入下一阶段的门槛 |
|---|---:|---|---|
| Phase 0 | 0.5-1 天 | 现状确认和基线采集 | 当前测试、pack size、CI 状态、关键命令输出有记录 |
| Phase 1 | 1 周内 | P0 正确性修复 | `compare-metrics` golden tests 通过，synthetic-only 不推荐 block |
| Phase 2 | 1-2 周 | 测试和 schema 安全网 | unit/integration/golden/malformed input 测试成型，覆盖核心报告链路 |
| Phase 3 | 2-4 周 | `bin -> src` 模块化 | 旧 CLI 行为兼容，核心纯函数可单测 |
| Phase 4 | 3-5 周 | `pack-context`、日志、usage、events 强化 | 大仓库扫描有预算、manifest、redaction hits 和 skip reasons |
| Phase 5 | 4-6 周 | 性能 profiling 和指标化 | 命令性能基线、pack size、CI time、性能预算有记录 |
| Phase 6 | 5-7 周 | CI/CD 和供应链 | least privilege、Dependency Review、CodeQL、Dependabot、release workflow |
| Phase 7 | 6-8 周 | 模板、MCP 和安全模型 | template migration、dogfood drift、remote pin、unattended/no-write 约束完整 |
| Phase 8 | 7-9 周 | 文档、示例和采用 | command reference、troubleshooting、migration、evidence taxonomy 完整 |
| Phase 9 | 8 周以后 | 长期能力 | symbol-aware context pack、dashboard、真实 case studies、稳定 v1.0 |

阶段编号必须与后文章节和任务索引保持一致。新增或移动任务时，同时更新本表、对应章节和第 17 节任务索引。

## 3. Phase 0：现状确认和基线采集

### T0.1 建立实施基线

- 优先级：P0
- 类型：准备任务
- 涉及文件：`package.json`、`.github/workflows/*`、`bin/*`、`tests/*`
- 任务内容：
  - 记录当前 `npm run lint`、`npm test`、`npm run check:native` 的结果。
  - 记录当前 `npm pack --dry-run --json` 的包体积和包含文件。
  - 记录 `node bin/cts.js doctor --target . --json --no-write` 输出。
  - 记录 `node bin/cts.js audit-hooks --target . --json --no-write` 输出。
- 验收标准：
  - 有一份实施前基线记录，后续每个阶段可对比。
  - 机器输出默认写入 `.token-stack/reports/implementation-baseline-YYYYMMDD/`，如果需要入库，只提交脱敏后的摘要文档。
  - 如果基线本身失败，先归档为已知 blocker，不把后续任务误判为新回归。

### T0.2 建立任务追踪方式

- 优先级：P1
- 类型：治理任务
- 涉及文件：`ROADMAP.md`、`CHANGELOG.md`、GitHub Issues/Projects
- 任务内容：
  - 为本文档中的任务建立 issue 或项目板条目。
  - 使用任务 ID 追踪，例如 `T1.1`、`T3.4`。
  - 每个 PR 必须关联至少一个任务 ID。
- 验收标准：
  - 每个实施任务有 owner、状态、验证命令、风险说明。

## 4. Phase 1：P0 正确性修复

### T1.1 修复 `compare-metrics.py` 重复汇总风险

- 优先级：P0
- 类型：代码修复
- 涉及文件：
  - `bin/compare-metrics.py`
  - `bin/cts-compare-metrics.py`
  - `tests/fixtures/*`
  - `tests/golden/*`
- 问题：
  - 报告指出该脚本存在外层遍历 phase、内层同时加载 baseline/post 并累计 totals 的结构风险，可能导致 baseline/post 指标被重复计数。
  - 该结果直接影响 `cost_change_usd`、`recommend_enter_block` 和 rollout 决策。
- 实施步骤：
  - 将汇总逻辑改成“每个 task 只计算一次 baseline/post”。
  - `tasks[task]` 只保存一次 baseline/post/comparison。
  - totals 的累计只在单个 task 的单次 baseline/post 读取后执行。
  - 对 bool、int、float、missing、null 明确处理规则。
  - 如果 `bin/cts-compare-metrics.py` 是 wrapper 或复制文件，同步保持行为一致。
- 验收标准：
  - 1 个 task、2 个 phase 的最小 fixture 不重复累计。
  - 多 task fixture 的 totals 等于各 task 单次求和。
  - synthetic-only 证据不推荐进入 block。
  - 输出 schema 不破坏既有字段。

### T1.2 为 `compare-metrics` 建 golden tests

- 优先级：P0
- 类型：测试
- 涉及文件：
  - `tests/golden/metrics/baseline/*.json`
  - `tests/golden/metrics/post/*.json`
  - `tests/golden/metrics/expected-metrics-summary.json`
  - `tests/smoke/helper-scripts.test.js` 或新增测试文件
- 任务内容：
  - 建立至少 3 组 golden case：
    - 单 task 正常 baseline/post。
    - 多 task 汇总。
    - synthetic-only evidence，不允许推荐 block。
  - 断言关键字段：
    - `totals.baseline.input_tokens`
    - `totals.post.input_tokens`
    - `totals.baseline.output_tokens`
    - `totals.post.output_tokens`
    - `cost_change_usd`
    - `recommend_enter_block`
    - `recommendation_reason`
- 验收标准：
  - 修改指标算法时必须显式更新 golden 文件。
  - golden diff 能暴露重复计数、缺失 task、错误百分比计算。

### T1.3 明确 metrics schema 版本

- 优先级：P0
- 类型：schema/兼容
- 涉及文件：
  - `schemas/metrics.schema.json`
  - `bin/collect-metrics.py`
  - `bin/compare-metrics.py`
  - `docs/benchmark.md`
- 任务内容：
  - 为 metrics 输出增加或确认 `schema_version`。
  - 明确哪些字段为稳定字段，哪些字段为 experimental。
  - 在 compare 输出中保留向后兼容字段，只允许 additive change。
- 验收标准：
  - 旧消费者不会因为新增字段失败。
  - 文档说明 schema 版本升级策略。

### T1.4 建立 rollout 决策保护规则

- 优先级：P0
- 类型：产品安全
- 涉及文件：
  - `bin/compare-metrics.py`
  - `docs/validation-playbook.md`
  - `docs/case-studies/README.md`
- 任务内容：
  - `recommend_enter_block` 必须同时满足 metrics 改善、证据类型足够、无关键 false positive。
  - synthetic-only 只允许证明 wiring，不允许推动 block-mode。
  - mixed evidence 必须在报告中拆分 synthetic 与 real 的贡献。
- 验收标准：
  - synthetic-only fixture 下 recommendation 明确为不进入 block。
  - real/mixed evidence 的推荐理由可追踪到输入数据。

## 5. Phase 2：测试体系和可回归性

### T2.1 扩展 hook smoke tests

- 优先级：P0
- 类型：测试
- 涉及文件：
  - `tests/smoke/hook-smoke.test.js`
  - `templates/.claude/hooks/bash-token-guard.py`
  - `templates/.claude/hooks/cbm-gate.py`
- 任务内容：
  - 覆盖 `tree`、`ls -R`、`grep -R`。
  - 覆盖 secret-like shell reads。
  - 覆盖 advisory test/build commands。
  - 覆盖 warn/block 模式差异。
  - 覆盖 Windows PowerShell、路径带空格、Git Bash 路径。
- 验收标准：
  - 常见全仓库读取命令不能绕过 guard。
  - block mode 退出码稳定。
  - 日志输出包含可机器解析字段。

### T2.2 增加核心函数 unit tests

- 优先级：P0
- 类型：测试
- 涉及文件：
  - `bin/cts.js`
  - 后续拆分出的 `src/core/*`
  - `src/platform/*`
  - `src/report/*`
- 任务内容：
  - 为以下逻辑建立单测：
    - settings merge。
    - token settings risk analysis。
    - path conversion。
    - no-write/dry-run 判定。
    - redaction。
    - metrics delta/pct/cache hit rate。
    - benchmark task discovery。
    - preset application plan。
- 验收标准：
  - 核心逻辑可以不启动完整 CLI 即可测试。
  - 未来 `bin -> src` 重构有安全网。

### T2.3 建立 integration fixture 仓库

- 优先级：P0
- 类型：测试
- 涉及目录：
  - `tests/fixtures/`
  - `.tmp/`
- 任务内容：
  - 创建最小 fixture 仓库，覆盖：
    - Node 项目。
    - Python 项目。
    - Windows 路径带空格项目。
    - 含 `.claude/settings.json` 的已有项目。
    - 含 malformed logs/reports 的项目。
  - 集成链路：
    - `scaffold -> doctor -> audit-hooks -> verify -> benchmark -> collect-metrics -> compare-metrics`
- 验收标准：
  - fixture 能在 Windows PowerShell 下运行 native 验证。
  - Bash-backed 步骤仅在 Bash-capable 环境执行。

### T2.4 建立 golden output tests

- 优先级：P0
- 类型：测试
- 涉及输出：
  - `metrics-summary.json`
  - `usage-summary.json`
  - `context-pack.md`
  - `context-pack.manifest.json`
  - `verify-report.json`
  - `doctor --json`
  - `audit-hooks --json`
- 任务内容：
  - 对稳定字段做 golden 比对。
  - 对时间戳、绝对路径、平台差异做 normalize。
  - 明确哪些字段不参与 golden，如 duration、tmp path。
- 验收标准：
  - 报告结构变动必须经过显式更新。
  - 关键字段不会静默漂移。

### T2.5 加入 malformed input 测试

- 优先级：P1
- 类型：测试
- 涉及文件：
  - `bin/analyze-logs.js`
  - `bin/ingest-usage.js`
  - `bin/collect-metrics.py`
  - `bin/compare-metrics.py`
- 任务内容：
  - 测试损坏 JSON、空文件、超大 JSONL、缺失字段、错误类型、非 UTF-8 内容。
  - 所有坏输入必须输出 warning 或 structured error，不能静默吞掉。
- 验收标准：
  - 坏输入不会导致误导性成功报告。
  - 报告包含 provenance 或 skipped reason。

### T2.6 建立覆盖率门槛

- 优先级：P1
- 类型：测试/CI
- 涉及文件：
  - `package.json`
  - `.github/workflows/ci.yml`
- 任务内容：
  - Node 使用 `c8` 或 `NODE_V8_COVERAGE`。
  - Python 使用 `coverage.py`。
  - 初始目标可设为 70% 分支覆盖，后续逐步提升。
- 验收标准：
  - coverage artifact 上传。
  - 低于门槛的 PR 失败，或在早期先 warning 后 enforce。

### T2.7 建立 JSON schema 回归测试

- 优先级：P1
- 类型：测试/schema
- 涉及文件：
  - `schemas/metrics.schema.json`
  - `schemas/benchmark.config.schema.json`
  - `schemas/case-study.schema.json`
  - `docs/examples/benchmark.config.example.json`
  - `docs/case-studies/template.md`
- 任务内容：
  - 为 metrics、benchmark config、case-study schema 建立正例和反例 fixtures。
  - 校验示例文件与 schema 一致。
  - 明确 schema 变更是 additive、deprecating 还是 breaking。
- 验收标准：
  - 示例和模板不会与 schema 漂移。
  - schema 破坏性变化必须同步更新迁移文档和 release notes。

## 6. Phase 3：`bin -> src` 可维护性重构

### T3.1 建立 `src/` 模块目录

- 优先级：P0
- 类型：重构
- 建议结构：

```text
src/
  cli/
    index.js
    commands/
      scaffold.js
      verify.js
      doctor.js
      audit-hooks.js
      pack-context.js
      analyze-logs.js
      ingest-usage.js
      events.js
      preset.js
  core/
    settings.js
    scaffold-plan.js
    metrics.js
    benchmark-config.js
    presets.js
  platform/
    bash-path.js
    python-runner.js
    process-runner.js
  report/
    json.js
    markdown.js
    schema.js
  security/
    redaction.js
    remote-spec.js
```

- 验收标准：
  - `bin/cts.js` 只负责 shebang、参数传入、错误输出和 exit code。
  - public CLI 行为保持兼容。
  - 旧命令路径继续工作。
  - `package.json` 的 `files` 白名单包含运行时需要的 `src/**/*.js` 或等价入口；`npm pack --dry-run --json` 确认 tarball 内有所有被 `bin/*` require 的文件。

### T3.2 拆分 `bin/cts.js`

- 优先级：P0
- 类型：重构
- 涉及职责：
  - CLI 解析。
  - scaffold。
  - settings merge。
  - Windows/Bash/WSL2 路径转换。
  - script dispatch。
  - no-write/dry-run 逻辑。
  - optional remote install 校验。
- 实施步骤：
  - 先提纯纯函数，不改变行为。
  - 每次拆分只迁移一个职责。
  - 每一步都跑 `npm test` 和关键命令 smoke。
- 验收标准：
  - `node bin/cts.js --help`、所有现有命令输出兼容。
  - package `bin` 字段不变。
  - 从 `npm pack --dry-run` 生成的 tarball 安装后，`cts --help` 和核心命令能在无源码工作区的临时目录运行。

### T3.3 强化 `doctor`

- 优先级：P1
- 类型：功能增强/重构
- 涉及文件：
  - `bin/doctor.js`
  - `src/cli/commands/doctor.js`
  - `docs/windows.md`
  - `docs/validation.md`
- 任务内容：
  - 将诊断项拆为结构化 checks。
  - 每项输出 `id`、`severity`、`status`、`message`、`remediation`。
  - 保留 human-readable 输出，同时完善 `--json` schema。
  - 检查 Node、Python、Git、Bash、Claude CLI、template presence、dogfood drift、hook sample behavior。
- 验收标准：
  - `doctor --json --no-write` 可作为 CI 输入。
  - Windows 无 Bash 时是 warning，不阻断 native 验证。

### T3.4 强化 `audit-hooks`

- 优先级：P1
- 类型：功能增强
- 涉及文件：
  - `bin/audit-hooks.js`
  - `schemas/*`
  - `docs/security-model.md`
- 任务内容：
  - 检查 hook command surface。
  - 检查 duplicate hooks。
  - 检查 missing hook target。
  - 检查 invalid mode。
  - 检查 inline shell 或危险命令。
  - 输出建议修复 patch 或 remediation。
- 验收标准：
  - 能区分 error/warning/advisory。
  - 不写文件时 `--no-write` 严格无副作用。

### T3.5 强化 `apply-preset`

- 优先级：P1
- 类型：功能增强
- 涉及文件：
  - `bin/apply-preset.js`
  - `docs/operations.md`
  - `docs/rollback.md`
- 任务内容：
  - 支持 dry-run diff。
  - 将 `soft/balanced/strict` 的差异文档化。
  - 在进入 strict/block 前检查 metrics、verify、logs 是否满足证据门槛。
  - 记录 preset application event。
- 验收标准：
  - 用户能在不写文件时看到完整计划。
  - strict 不能只靠 synthetic evidence 自动推荐。

### T3.6 建立内部错误模型

- 优先级：P2
- 类型：架构
- 任务内容：
  - 为 CLI 内部错误建立统一 shape：`code`、`message`、`details`、`exitCode`。
  - 区分 usage error、validation error、environment warning、unexpected error。
- 验收标准：
  - 机器输出和人类输出一致映射。
  - 文档列出常见错误码。

## 7. Phase 4：Context、日志、Usage 和事件能力强化

### T4.1 重构 `pack-context` 文件选择策略

- 优先级：P0
- 类型：性能/安全/功能
- 涉及文件：
  - `bin/pack-context.js`
  - `src/security/redaction.js`
  - `docs/context-pack-template.md`
- 当前问题：
  - 同步枚举和读取对大仓库不够经济。
  - 先全量读取再预算裁剪会浪费 I/O。
- 任务内容：
  - 优先使用 `git ls-files`。
  - 增加 include/exclude。
  - 按目录、扩展名、文件大小、README/SECURITY/ARCHITECTURE 等信号排序。
  - 先排序再读取高价值文件。
  - manifest 记录 skip reason。
- 验收标准：
  - 大仓库场景输出稳定。
  - manifest 包含候选数、读取数、跳过数、预算使用率。

### T4.2 强化 redaction

- 优先级：P0
- 类型：安全
- 涉及文件：
  - `bin/pack-context.js`
  - `src/security/redaction.js`
  - `tests/golden/context-pack/*`
- 任务内容：
  - 支持 assignment 型 secrets。
  - 支持 Bearer token。
  - 支持 JWT。
  - 支持 URL query token。
  - 支持 private key block。
  - 支持 YAML/env 多行常见形态。
  - redaction hits 写入 manifest，只记录类型和数量，不记录原文。
- 验收标准：
  - golden context pack 不泄漏 fixture secrets。
  - redaction 规则可单测。

### T4.3 增加 context pack provenance

- 优先级：P1
- 类型：报告增强
- 任务内容：
  - 输出生成命令、版本、时间、目标路径、budget、include/exclude。
  - 标记文件是否被截断。
  - 标记 redaction 是否发生。
- 验收标准：
  - context pack 可用于 handoff/复盘。
  - 不需要读取源仓库也能知道 pack 的生成条件。

### T4.4 强化 `analyze-logs`

- 优先级：P1
- 类型：功能增强
- 涉及文件：
  - `bin/analyze-logs.js`
  - `.claude/logs/*`
  - `docs/operations.md`
- 任务内容：
  - 增加时间窗口。
  - 统计 top offenders。
  - 统计 mode 分布。
  - 统计 tool pattern。
  - 支持 false-positive 标签。
  - 支持趋势输出。
- 验收标准：
  - rollout review 能看到是规则变严、误报增加，还是行为改善。

### T4.5 强化 `ingest-usage`

- 优先级：P1
- 类型：功能增强
- 涉及文件：
  - `bin/ingest-usage.js`
  - `schemas/*`
- 任务内容：
  - 对 JSON/JSONL 输入结构做容错和 schema 校验。
  - 对 badly-formed 数据输出 warning。
  - 每条汇总记录保留 source/provenance。
  - 统计 token、cost、tool_calls、cache hit 等字段。
- 验收标准：
  - 损坏输入不会污染汇总。
  - 报告能解释哪些文件被跳过。

### T4.6 强化 `collect-metrics`

- 优先级：P1
- 类型：功能增强
- 涉及文件：
  - `bin/collect-metrics.py`
  - `schemas/metrics.schema.json`
- 任务内容：
  - 增加严格字段验证。
  - 输出 schema version。
  - 明确 synthetic/real/mixed evidence。
  - 输出 missing task 和 skipped task。
- 验收标准：
  - metrics 数据不完整时输出 warning，不产生误导性推荐。

### T4.7 强化 `event-store`

- 优先级：P2
- 类型：功能增强
- 涉及文件：
  - `bin/event-store.js`
  - `docs/operations.md`
- 任务内容：
  - 定义 event schema。
  - 增加 actor/source。
  - 增加 event type：preset applied、verify run、benchmark run、rollback、false positive、block promotion。
  - 保持 append-only。
- 验收标准：
  - 后续可以从事件流重建 rollout summary。

## 8. Phase 5：性能 profiling 和指标化

### T5.1 建立命令性能基线

- 优先级：P1
- 类型：性能
- 涉及命令：
  - `scaffold`
  - `doctor`
  - `pack-context`
  - `compare-metrics`
- 任务内容：
  - 在小仓库、中仓库、大仓库三种规模下采集：
    - wall time。
    - 文件数。
    - 读取文件数。
    - 跳过文件数。
    - 输出字节数。
    - 最大 RSS。
    - CPU profile 路径。
- 验收标准：
  - 每个命令有 baseline。
  - 后续优化能对比，不靠主观判断。

### T5.2 使用官方 profiling 能力

- 优先级：P2
- 类型：性能工具
- 任务内容：
  - Node 使用 `--cpu-prof`、`--heap-prof` 或 `process.memoryUsage()`。
  - Python 使用 `cProfile`、`tracemalloc`。
  - profile 输出写入 `.token-stack/reports/` 或 CI artifact。
- 验收标准：
  - profiling 不成为默认用户负担。
  - 开启 profiling 时输出位置明确。

### T5.3 建立 pack size 和 CI time 指标

- 优先级：P1
- 类型：CI/性能
- 涉及文件：
  - `.github/workflows/ci.yml`
  - `package.json`
- 任务内容：
  - CI 中执行 `npm pack --json`。
  - 上传 `pack-report.json`。
  - 在 job summary 中记录 CI 耗时。
- 验收标准：
  - 包体积增长可追踪。
  - CI 时间异常增长可发现。

### T5.4 建立性能预算

- 优先级：P2
- 类型：长期治理
- 任务内容：
  - 先 warning，后 enforce。
  - 为 context pack 的文件数、读取字节数、输出大小设预算。
  - 为 doctor/audit-hooks 设基本延迟预算。
- 验收标准：
  - 大仓库性能退化能被发现。

## 9. Phase 6：CI/CD、安全和供应链

### T6.1 收紧 GitHub Actions 权限

- 优先级：P0
- 类型：CI 安全
- 涉及文件：
  - `.github/workflows/ci.yml`
  - `.github/workflows/verify.yml`
- 任务内容：
  - 默认设置 `permissions: contents: read`。
  - 仅对需要写 security events 或 PR comments 的 job 提升权限。
- 验收标准：
  - 每个 workflow 都显式声明权限。
  - 无默认宽权限。

### T6.2 增加 workflow concurrency

- 优先级：P1
- 类型：CI
- 任务内容：
  - 对 PR/push CI 增加 concurrency。
  - 同一分支新提交取消旧运行。
- 验收标准：
  - 减少 CI 分钟浪费。

### T6.3 合并或重构重复的 `verify.yml`

- 优先级：P1
- 类型：CI 维护
- 当前问题：
  - 报告指出 `verify.yml` 与 `ci.yml` 存在重复。
- 任务内容：
  - 如果保留 `verify.yml`，改为 `workflow_dispatch` 或 `workflow_call`。
  - 主验证集中在 `ci.yml`。
  - 保留的验证 workflow 使用 `npm ci`，避免 `npm install` 漂移 lockfile。
- 验收标准：
  - 同一检查不会无意义重复维护。

### T6.4 增加 Dependency Review

- 优先级：P0
- 类型：供应链
- 涉及文件：
  - `.github/workflows/security.yml`
- 任务内容：
  - PR 上运行 `actions/dependency-review-action`。
  - 配置 license 和 vulnerability 阈值。
- 验收标准：
  - 新依赖引入会被审查。
  - 即使当前零运行时依赖，也能防未来漂移。

### T6.5 增加 Dependabot

- 优先级：P1
- 类型：供应链
- 涉及文件：
  - `.github/dependabot.yml`
- 任务内容：
  - 监控 npm。
  - 监控 GitHub Actions。
  - 设置合理 PR 分组和频率。
- 验收标准：
  - Actions 版本漂移可见。
  - 依赖安全更新自动提出。

### T6.6 增加 CodeQL/code scanning

- 优先级：P1
- 类型：安全扫描
- 涉及文件：
  - `.github/workflows/security.yml`
- 任务内容：
  - 扫描 JavaScript/TypeScript。
  - 扫描 Python。
  - 如支持，扫描 GitHub Actions workflow。
- 验收标准：
  - 主分支有 code scanning 结果。
  - 新高危发现阻断或至少告警。

### T6.7 增加发布 workflow

- 优先级：P1
- 类型：发布
- 涉及文件：
  - `.github/workflows/release.yml`
  - `scripts/check-release.*`
  - `RELEASE_NOTES.md`
- 任务内容：
  - Git tag 触发。
  - 执行 `npm ci`。
  - 执行 lint/test/pack dry-run。
  - 上传 pack report。
  - 生成 artifact。
  - 支持 staged approval。
- 验收标准：
  - 发布前所有验证自动化。
  - 人工发布步骤减少到审核和批准。

### T6.8 增加 npm trusted publishing 和 provenance

- 优先级：P1
- 类型：供应链发布
- 任务内容：
  - 使用 OIDC trusted publishing。
  - 避免长期 npm token。
  - 生成 npm provenance。
  - 可选增加 GitHub artifact attestation。
- 验收标准：
  - 发布产物来源可验证。
  - release checklist 记录 provenance。

### T6.9 增加 SBOM 或依赖清单

- 优先级：P2
- 类型：供应链
- 任务内容：
  - 生成最小依赖清单。
  - 当前零运行时依赖要明确记录。
  - workflow actions 也纳入审计。
- 验收标准：
  - release artifact 包含依赖审计材料。

### T6.10 建立依赖和许可证审计文档

- 优先级：P2
- 类型：供应链/文档
- 涉及文件：
  - `package-lock.json`
  - `.github/workflows/*`
  - `.mcp.local.example.json`
  - `templates/.mcp.local.example.json`
  - `docs/security-model.md`
  - 可选新增 `docs/dependencies.md`
- 任务内容：
  - 记录当前 npm 运行时依赖为零，并区分 runtime、dev、workflow action、外部运行时和可选 MCP 依赖。
  - 对 GitHub Actions 引用、Node/Python/Bash/Git Bash/WSL2 等外部运行时写明来源和审计边界。
  - 对可选 MCP 依赖记录 reviewed/pinned/integrity 要求。
  - release 前确认新增依赖的许可证和供应链风险。
- 验收标准：
  - 维护者能从文档判断一个依赖变化是否扩大运行时供应链面。
  - release checklist 明确引用依赖和许可证审计结果。

## 10. Phase 7：模板、MCP 和安全模型

### T7.1 为模板建立 schema 和迁移策略

- 优先级：P0
- 类型：模板治理
- 涉及文件：
  - `templates/.claude/settings.json`
  - `templates/.claude/token-policy.md`
  - `templates/.claude/settings.local.unattended.example.json`
  - `docs/migrations/*`
- 任务内容：
  - 为 `.claude/settings.json` 关键字段建立兼容说明。
  - 记录模板版本。
  - 提供从旧模板升级的迁移说明。
- 验收标准：
  - 用户知道模板变化是否需要手动合并。
  - dogfood 模板和 published templates 可对比。

### T7.2 保持 dogfood hooks 与 published templates 对齐

- 优先级：P0
- 类型：发布安全
- 涉及目录：
  - `.claude/`
  - `.codex/`
  - `templates/.claude/`
- 任务内容：
  - doctor 检测 drift。
  - CI 验证关键模板一致性或解释性差异。
- 验收标准：
  - 发布前不会遗漏模板同步。

### T7.3 远程 npm/npx 安装 exact pin 校验

- 优先级：P0
- 类型：供应链安全
- 涉及文件：
  - `bin/cts.js`
  - `bin/doctor.js`
  - `templates/.mcp.local.example.json`
- 任务内容：
  - 默认拒绝 `@latest`、range、tag、unpinned spec。
  - 允许 exact semver，如 `package@1.2.3` 或 `@scope/package@1.2.3`。
  - 如必须允许 unpinned，要求显式环境变量 opt-in。
- 验收标准：
  - optional remote install 不会默认使用漂移版本。

### T7.4 MCP integrity 和 duplicate 检查

- 优先级：P1
- 类型：MCP 安全
- 涉及文件：
  - `.mcp.local.example.json`
  - `templates/.mcp.local.example.json`
  - `docs/mcp-deduplication.md`
  - `docs/tools/*`
- 任务内容：
  - 检查重复 MCP server。
  - 检查 remote package pin。
  - 可选记录 checksum/integrity。
  - 文档化 reviewed version 策略。
- 验收标准：
  - 用户能知道本地 MCP 配置是否重复或不安全。

### T7.5 强化 unattended flow 默认失败策略

- 优先级：P0
- 类型：安全/执行
- 涉及文件：
  - `bin/cts-run-agent-unattended.sh`
  - `templates/.claude/settings.local.unattended.example.json`
- 任务内容：
  - advanced unattended 默认 fail closed。
  - 显式 `BEST_EFFORT=1` 才允许 best-effort。
  - 文档强调 unattended 风险。
- 验收标准：
  - 自动化失败不会被误报为成功。

### T7.6 保证 `--dry-run` 和 `--no-write` 严格无写入

- 优先级：P0
- 类型：正确性/安全
- 涉及命令：
  - `verify`
  - `benchmark`
  - `doctor`
  - `audit-hooks`
  - `apply-preset`
- 任务内容：
  - 明确 dry-run/no-write 语义。
  - 增加测试检查目标目录没有新增或修改文件。
- 验收标准：
  - 用户可安全在生产仓库执行无写入诊断。

## 11. Phase 8：文档、示例和采用体验

### T8.1 重构文档信息架构

- 优先级：P1
- 类型：文档
- 涉及目录：
  - `docs/`
  - `README.md`
  - `README_zh-CN.md`
- 任务内容：
  - 建立清晰导航：
    - Installation。
    - Getting started。
    - Command reference。
    - Validation。
    - Benchmark。
    - Security model。
    - Operations。
    - Rollback。
    - Migration。
    - Case studies。
  - 避免同一概念在多处发散。
- 验收标准：
  - 新用户可从 README 到完成 scaffold/doctor/verify。
  - 维护者可从 docs 找到 release/security/rollback 流程。

### T8.2 增加 command reference

- 优先级：P1
- 类型：文档
- 涉及命令：
  - `scaffold`
  - `verify`
  - `benchmark`
  - `collect-metrics`
  - `compare-metrics`
  - `doctor`
  - `audit-hooks`
  - `pack-context`
  - `analyze-logs`
  - `ingest-usage`
  - `events`
  - `preset`
- 任务内容：
  - 每个命令记录用途、参数、环境变量、输出文件、exit code、示例。
- 验收标准：
  - 用户不读源码也能使用全部 CLI surface。

### T8.3 增加 troubleshooting

- 优先级：P1
- 类型：文档
- 任务内容：
  - Windows 无 Bash。
  - Python/`py` 不存在。
  - Claude CLI 不存在。
  - Git Bash 路径转换失败。
  - PowerShell 执行策略。
  - JSON malformed。
  - no-write 期望和实际输出。
- 验收标准：
  - 常见失败都有诊断和修复路径。

### T8.4 增加 migration 文档

- 优先级：P1
- 类型：文档/兼容
- 涉及目录：
  - `docs/migrations/`
- 任务内容：
  - 每个 breaking-adjacent 变化有迁移说明。
  - env 变量 deprecation 至少保留两个 minor 版本。
  - preset 语义变化必须记录。
  - 如果新增 `docs/migrations/*.md` 需要进入 npm 包，同步更新 `package.json` 的 `files` 白名单。
- 验收标准：
  - 用户从旧版本升级不会只靠 changelog 猜测。

### T8.5 明确 evidence taxonomy

- 优先级：P0
- 类型：文档/产品安全
- 涉及文件：
  - `docs/case-studies/README.md`
  - `docs/case-studies/template.md`
  - `docs/validation-playbook.md`
- 任务内容：
  - 定义 `synthetic`、`real`、`mixed`。
  - 定义哪些结论可以由 synthetic evidence 支持。
  - 定义哪些结论必须由 representative real evidence 支持。
- 验收标准：
  - 文档和报告不会误导 token savings。

### T8.6 更新 PR 模板

- 优先级：P1
- 类型：协作治理
- 涉及文件：
  - `.github/pull_request_template.md`
- 任务内容：
  - 增加摘要、验证、兼容性、安全检查、证据、回滚方案。
  - 明确不引入 `curl | sh`、不扩大 secrets 读取面、不默认 remote install。
- 验收标准：
  - PR 审查能看到风险和验证证据。

### T8.7 更新 Issue 模板

- 优先级：P1
- 类型：协作治理
- 涉及目录：
  - `.github/ISSUE_TEMPLATE/`
- 任务内容：
  - 增加 false positive / rollout evidence 模板。
  - 扩展 bug 模板，要求环境、命令、日志、settings、证据类型。
  - 扩展 feature 模板，要求 rollout 影响和安全边界。
- 验收标准：
  - 用户反馈能直接进入治理闭环。

### T8.8 增加真实案例采集流程

- 优先级：P2
- 类型：文档/证据
- 涉及目录：
  - `docs/case-studies/`
- 任务内容：
  - 定义如何脱敏提交真实 case study。
  - 定义最小 artifacts：
    - baseline report。
    - post report。
    - compare summary。
    - false positive notes。
    - repo size profile。
- 验收标准：
  - 真实节省声明有可审计证据。

### T8.9 建立运行时兼容矩阵

- 优先级：P1
- 类型：文档/兼容
- 涉及文件：
  - `README.md`
  - `README_zh-CN.md`
  - `docs/installation.md`
  - `docs/windows-compatibility.md`
- 任务内容：
  - 明确最低 Node 版本和推荐 Node 版本。
  - 明确 Python、`py` launcher、Bash、Git Bash、WSL2、macOS/Linux shell 的支持边界。
  - 区分 native PowerShell 可运行命令和 Bash-backed 命令。
  - 把 Claude CLI 缺失定义为 adoption warning，而不是 native diagnostics blocker。
- 验收标准：
  - 用户能在安装前判断本机是否满足运行条件。
  - Windows 用户能明确知道哪些检查不需要 Bash，哪些验证需要 Git Bash/WSL2。

## 12. Phase 9：长期产品能力

### T9.1 Symbol-aware context pack

- 优先级：P2/P3
- 类型：长期功能
- 背景：
  - 当前建议先做 deterministic file-budget pack。
  - 长期可引入 repo map / symbol map 思路。
- 任务内容：
  - 先不引入重依赖。
  - 为 JS/TS/Python 做轻量 symbol extraction 实验。
  - 输出 symbol index 和 file priority。
  - 与 `pack-context` 集成，优先纳入入口点和引用链。
- 验收标准：
  - 大仓库 context pack 更聚焦。
  - 仍能解释为什么选择某个文件。

### T9.2 Local usage dashboard

- 优先级：P3
- 类型：长期功能
- 任务内容：
  - 基于 `ingest-usage` 和 `events` 生成本地 HTML/Markdown dashboard。
  - 展示 token/cost/trend/top offenders/false positives。
  - 不上传远程数据。
- 验收标准：
  - 团队可以本地复盘 rollout。

### T9.3 Rollout summary generator

- 优先级：P2
- 类型：长期功能
- 任务内容：
  - 从 event store、logs、metrics、usage 生成 rollout summary。
  - 支持 release notes 或 case-study 草稿。
- 验收标准：
  - adoption 复盘材料自动化，且证据可追溯。

### T9.4 Stable JSON API

- 优先级：P2
- 类型：长期兼容
- 任务内容：
  - 为 `doctor`、`audit-hooks`、`metrics-summary`、`usage-summary`、`context manifest` 定义稳定 schema。
  - v1.0 前完成兼容承诺。
- 验收标准：
  - 外部工具可以安全消费输出。

### T9.5 Plugin/integration strategy

- 优先级：P3
- 类型：长期生态
- 任务内容：
  - 定义第三方 MCP/tool integration 的安全要求。
  - 定义 reviewed/pinned/integrity 机制。
  - 不默认启用远程安装。
- 验收标准：
  - 扩展能力不破坏低依赖和安全姿态。

## 13. 兼容性和迁移承诺

### 13.1 CLI 兼容

- `claude-token-stack` 和 `cts` 保持不变。
- 既有命令名保持不变。
- `bin/cts.js` 即使内部变成薄 wrapper，也继续作为 package bin 入口。

### 13.2 文件路径兼容

- `.claude/` 默认路径不变。
- `.token-stack/reports/` 默认路径不变。
- `.mcp.local.example.json` 示例路径不变。

### 13.3 环境变量兼容

继续支持并文档化：

- `TOKEN_GUARD_MODE`
- `CBM_GATE_MODE`
- `CBM_GATE_BLOCK_TOOLS`
- `ENABLE_HEADROOM`
- `TOKEN_STACK_ALLOW_REMOTE_INSTALL`

如果未来废弃变量：

- 至少两个 minor 版本内输出 deprecation warning。
- 迁移文档写明替代变量。

### 13.4 报告兼容

- JSON 输出只做 additive change，除非进入明确 major 版本。
- 新字段必须有 schema_version。
- 旧字段不应被重命名或改变语义。

## 14. Release acceptance checklist

每个 release 至少满足：

- `npm run check:native` 在 Windows PowerShell 下通过。
- `npm test` 在 Bash-capable 环境通过。
- `npm pack --dry-run --json` 只包含允许发布的 public surface。
- synthetic benchmark 可生成 baseline/post artifacts。
- synthetic-only comparison 不推荐 block mode。
- `doctor --json --no-write` 无非预期写入。
- `audit-hooks --json --no-write` 无非预期写入。
- templates、dogfood `.claude`、`.codex` 无未解释 drift。
- Dependency Review 和 CodeQL 无未处理高危发现。
- 如果 `bin/*` 依赖 `src/*`，`npm pack --dry-run --json` 必须证明 tarball 内包含对应运行时文件。
- release notes 写明 correctness/security/schema/migration 影响。

## 15. 风险和缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 修复 compare 后历史 metrics 改变 | 旧报告和新报告不一致 | release notes 标记 correctness fix，重新生成 sample outputs |
| `bin -> src` 重构改变 CLI 行为 | 用户脚本失效 | 每次只迁移一个职责，保持 bin wrapper 和 golden CLI tests |
| redaction 规则误伤内容 | context pack 信息不足 | manifest 记录 redaction hits，fixtures 覆盖 false positive |
| strict/block 过早推广 | 开发体验下降 | warn-first 默认，block 需要 real/mixed evidence 和 false-positive review |
| CI 安全扫描增加时间 | PR 反馈变慢 | 独立 workflow、concurrency、只在必要事件运行重扫描 |
| release workflow 复杂化 | 维护成本增加 | 先实现最小可信发布，再逐步加 SBOM/dashboard 等长期项 |

## 16. 建议的首批 PR 切分

### PR 1：`compare-metrics` 正确性

- 包含任务：T1.1、T1.2、T1.3、T1.4
- 不包含：大规模 `src/` 重构
- 验证：`npm run check:native`、`npm test`、golden tests

### PR 2：测试 fixtures 和 no-write 验证

- 包含任务：T2.1、T2.3、T2.4、T7.6
- 验证：Windows native、Bash smoke、目标目录无写入断言

### PR 3：CI 安全收口

- 包含任务：T6.1、T6.2、T6.3、T6.4
- 验证：PR workflow、push workflow、dependency review

### PR 4：`src/` 初步模块化

- 包含任务：T3.1、T3.2 的第一批纯函数迁移
- 限制：不改变 CLI 输出和默认行为
- 验证：所有现有测试 + 新 unit tests + tarball 安装后 CLI smoke

### PR 5：`pack-context` 安全和性能

- 包含任务：T4.1、T4.2、T4.3
- 验证：context golden tests、redaction fixtures、大仓库 smoke

### PR 6：文档和协作模板

- 包含任务：T8.1、T8.2、T8.3、T8.5、T8.6、T8.7
- 验证：链接检查、README 流程人工走读

## 17. 完整任务索引

| ID | 任务 | 优先级 | 阶段 |
|---|---|---:|---|
| T0.1 | 建立实施基线 | P0 | Phase 0 |
| T0.2 | 建立任务追踪方式 | P1 | Phase 0 |
| T1.1 | 修复 `compare-metrics.py` 重复汇总风险 | P0 | Phase 1 |
| T1.2 | 为 `compare-metrics` 建 golden tests | P0 | Phase 1 |
| T1.3 | 明确 metrics schema 版本 | P0 | Phase 1 |
| T1.4 | 建立 rollout 决策保护规则 | P0 | Phase 1 |
| T2.1 | 扩展 hook smoke tests | P0 | Phase 2 |
| T2.2 | 增加核心函数 unit tests | P0 | Phase 2 |
| T2.3 | 建立 integration fixture 仓库 | P0 | Phase 2 |
| T2.4 | 建立 golden output tests | P0 | Phase 2 |
| T2.5 | 加入 malformed input 测试 | P1 | Phase 2 |
| T2.6 | 建立覆盖率门槛 | P1 | Phase 2 |
| T2.7 | 建立 JSON schema 回归测试 | P1 | Phase 2 |
| T3.1 | 建立 `src/` 模块目录 | P0 | Phase 3 |
| T3.2 | 拆分 `bin/cts.js` | P0 | Phase 3 |
| T3.3 | 强化 `doctor` | P1 | Phase 3 |
| T3.4 | 强化 `audit-hooks` | P1 | Phase 3 |
| T3.5 | 强化 `apply-preset` | P1 | Phase 3 |
| T3.6 | 建立内部错误模型 | P2 | Phase 3 |
| T4.1 | 重构 `pack-context` 文件选择策略 | P0 | Phase 4 |
| T4.2 | 强化 redaction | P0 | Phase 4 |
| T4.3 | 增加 context pack provenance | P1 | Phase 4 |
| T4.4 | 强化 `analyze-logs` | P1 | Phase 4 |
| T4.5 | 强化 `ingest-usage` | P1 | Phase 4 |
| T4.6 | 强化 `collect-metrics` | P1 | Phase 4 |
| T4.7 | 强化 `event-store` | P2 | Phase 4 |
| T5.1 | 建立命令性能基线 | P1 | Phase 5 |
| T5.2 | 使用官方 profiling 能力 | P2 | Phase 5 |
| T5.3 | 建立 pack size 和 CI time 指标 | P1 | Phase 5 |
| T5.4 | 建立性能预算 | P2 | Phase 5 |
| T6.1 | 收紧 GitHub Actions 权限 | P0 | Phase 6 |
| T6.2 | 增加 workflow concurrency | P1 | Phase 6 |
| T6.3 | 合并或重构重复的 `verify.yml` | P1 | Phase 6 |
| T6.4 | 增加 Dependency Review | P0 | Phase 6 |
| T6.5 | 增加 Dependabot | P1 | Phase 6 |
| T6.6 | 增加 CodeQL/code scanning | P1 | Phase 6 |
| T6.7 | 增加发布 workflow | P1 | Phase 6 |
| T6.8 | 增加 npm trusted publishing 和 provenance | P1 | Phase 6 |
| T6.9 | 增加 SBOM 或依赖清单 | P2 | Phase 6 |
| T6.10 | 建立依赖和许可证审计文档 | P2 | Phase 6 |
| T7.1 | 为模板建立 schema 和迁移策略 | P0 | Phase 7 |
| T7.2 | 保持 dogfood hooks 与 published templates 对齐 | P0 | Phase 7 |
| T7.3 | 远程 npm/npx 安装 exact pin 校验 | P0 | Phase 7 |
| T7.4 | MCP integrity 和 duplicate 检查 | P1 | Phase 7 |
| T7.5 | 强化 unattended flow 默认失败策略 | P0 | Phase 7 |
| T7.6 | 保证 `--dry-run` 和 `--no-write` 严格无写入 | P0 | Phase 7 |
| T8.1 | 重构文档信息架构 | P1 | Phase 8 |
| T8.2 | 增加 command reference | P1 | Phase 8 |
| T8.3 | 增加 troubleshooting | P1 | Phase 8 |
| T8.4 | 增加 migration 文档 | P1 | Phase 8 |
| T8.5 | 明确 evidence taxonomy | P0 | Phase 8 |
| T8.6 | 更新 PR 模板 | P1 | Phase 8 |
| T8.7 | 更新 Issue 模板 | P1 | Phase 8 |
| T8.8 | 增加真实案例采集流程 | P2 | Phase 8 |
| T8.9 | 建立运行时兼容矩阵 | P1 | Phase 8 |
| T9.1 | Symbol-aware context pack | P2/P3 | Phase 9 |
| T9.2 | Local usage dashboard | P3 | Phase 9 |
| T9.3 | Rollout summary generator | P2 | Phase 9 |
| T9.4 | Stable JSON API | P2 | Phase 9 |
| T9.5 | Plugin/integration strategy | P3 | Phase 9 |

## 18. 当前最建议立即执行的顺序

1. 执行 Phase 0 基线记录。
2. 修复 T1.1 `compare-metrics.py`。
3. 补 T1.2 golden tests。
4. 做 T7.6 no-write/dry-run 严格测试。
5. 做 T6.1/T6.4 CI 安全收口。
6. 再开始 T3.1/T3.2 模块化，避免在正确性未稳定前大重构。
