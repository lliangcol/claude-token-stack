# Claude Token Stack Research Report

This is the public, self-contained summary of the internal research report used to build v0.1.0. The seed files are excluded from the npm package.

## Core Findings

The core finding is that token waste is usually caused by unmanaged context before it reaches the model. Useful interventions include code graph discovery, large-output summarization, CLI output compression, concise output style, optional proxy compression, and deterministic hooks.

The `90%+` claim should not be presented as a total bill guarantee. It is a possible upper bound for specific noisy steps such as large logs or replacing broad file reads with targeted discovery.
