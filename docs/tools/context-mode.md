# context-mode

context-mode is recommended for large outputs such as logs, Playwright snapshots, issue lists, and bulky command output.

The goal is to return only the useful summary: error code, file, line, top stack frames, reproduction command, and next action. If summary attempts fail repeatedly, read a narrow raw slice.
