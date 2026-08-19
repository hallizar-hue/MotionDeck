---
name: Replit config auto-modules
description: Running language-specific setup commands can cause Replit to auto-add a module to .replit.
---

Replit may automatically add a language module to `.replit` when a matching runtime command is executed. If that change is unrelated to the user’s requested files, restore the original config through the validated replacement flow rather than editing it directly.

**Why:** A Python-based syntax-check command unexpectedly added the Python module to the project configuration.

**How to apply:** Prefer existing runtimes for checks and inspect `git diff` for generated config changes before finishing.