# Headroom

Headroom is an optional proxy-layer compression tool. It is not enabled or installed by default because it sits in the request path and has a larger blast radius than local hooks. Treat it as an explicit proxy experiment, not a default part of the local-first stack.

Only experiment with Headroom when:

- `ENABLE_HEADROOM=1` is explicit.
- The repository is non-sensitive or approved for proxy experimentation.
- The owner has reviewed what request metadata and content could pass through the proxy.
- Secrets, private logs, and proprietary source are out of scope unless the repository owner has approved that data path.
- Streaming, tool calls, hooks, and MCP behavior have been verified.
- A one-command disable path exists.

Keep Headroom disabled for normal scaffold, verification, benchmark, and demo flows.
