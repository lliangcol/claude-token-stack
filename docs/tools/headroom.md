# Headroom

Headroom is an optional proxy-layer compression tool. It is not enabled or installed by default because it sits in the request path and has a larger blast radius than local hooks.

Only experiment with Headroom when:

- `ENABLE_HEADROOM=1` is explicit.
- The repository is non-sensitive or approved for proxy experimentation.
- Streaming, tool calls, hooks, and MCP behavior have been verified.
- A one-command disable path exists.
