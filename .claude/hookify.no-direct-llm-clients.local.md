---
name: no-direct-llm-clients
enabled: true
event: file
pattern: (claudeClient|groqClient|geminiClient)\.(chat|complete|generate|create)
action: warn
---

Never call LLM provider clients directly from business services.

Route all LLM calls through `aiService` — it handles routing, fallbacks, and metrics.
