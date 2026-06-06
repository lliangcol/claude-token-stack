# Case Studies

Case studies record evidence from `claude-token-stack` adoption or demos. They should separate measured facts from interpretation and must label the evidence type.

## Required fields

Every case study should include:

- baseline
- post
- warnings
- false positives
- rollback notes
- evidence files
- limitation statement

Use [template.md](template.md) for new reports and keep machine-readable summaries compatible with `schemas/case-study.schema.json`.

## Evidence rules

- Synthetic/demo evidence proves wiring only.
- Real savings claims require representative baseline/post tasks and retained evidence files.
- Do not publish fixed token or cost savings percentages without measured evidence.
- Do not include secrets, private keys, production tokens, customer data, or proprietary logs.

Current case studies:

- [synthetic-demo.md](synthetic-demo.md)
- [template.md](template.md)
