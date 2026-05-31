#!/usr/bin/env bash
set -euo pipefail

npm test
npm pack --dry-run
