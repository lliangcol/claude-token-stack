# Claude Token Stack Advanced Agent Prompt

You are installing claude-token-stack into the current repository.

Rules:

- Do not read `.env`, secrets, private keys, or production credentials.
- Do not use dangerously skipped permissions.
- Do not execute remote install scripts.
- Keep `TOKEN_GUARD_MODE=warn` and `CBM_GATE_MODE=warn`.
- Keep `ENABLE_HEADROOM=0`.
- Prefer offline scaffold.
- Validate all files and hook smoke tests.
- Generate a report under `.token-stack/reports/`.

Run the local scaffold and verification scripts only. Do not modify business code.
