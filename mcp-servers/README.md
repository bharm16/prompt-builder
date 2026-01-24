# MCP servers for this repo

Gemini CLI reads MCP server configuration from a settings.json file. You can
place it in .gemini/settings.json (project) or ~/.gemini/settings.json (global).
This folder includes settings.example.json with a safe starting point. Copy the
mcpServers block into your settings file and update paths/env vars as needed.

Recommended servers
- filesystem: scoped to this repo for safe file access.
- github (optional): issue/PR context for this repo. Use a fine-grained token.

Security notes
- Keep tokens in environment variables rather than hard-coding.
- Prefer fine-grained GitHub tokens to avoid over-scoping access.
