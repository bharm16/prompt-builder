# Groq API Documentation

A comprehensive guide to Groq's API features including Tool Use, Structured Outputs, Reasoning, and Qwen3 model capabilities.

---

## Table of Contents

1. [Tool Use](#tool-use)
2. [Structured Outputs](#structured-outputs)
3. [Reasoning](#reasoning)
4. [Qwen3 Model](#qwen3-model)

---

# Tool Use

Applications using LLMs become much more powerful when the model can interact with external resources, such as APIs, databases, and the web, to gather dynamic data or to perform actions. **Tool use** (or function calling) is what transforms a language model from a conversational interface into an autonomous agent capable of taking action, accessing real-time information, and solving complex multi-step problems.

## How Tool Use Works

There are a few important pieces in the tool calling process:

1. A request is made to the model with tool definitions
2. The model returns tool call requests
3. The tool is executed and results are returned to the model
4. The model evaluates the results and continues or completes

### 1. Initial Request with Tool Definitions

To use tools, the model must be provided with tool definitions. These tool definitions are in JSON schema format and are passed to the model via the `tools` parameter in the API request.

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City and state, e.g. San Francisco, CA"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"]
            }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "messages": [
    {
      "role": "system",
      "content": "You are a weather assistant. Respond to the user question and use tools if needed to answer the query."
    },
    {
      "role": "user",
      "content": "What's the weather in San Francisco?" 
    }
  ]
}
```

**Key fields:**

- `name`: Function identifier
- `description`: Helps the model decide when to use this tool
- `parameters`: Function parameters defined as a JSON Schema object

### 2. Model Returns Tool Call Requests

When the model decides to use a tool, it returns structured tool calls in the response:

```json
{
  "role": "assistant",
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "get_weather",
      "arguments": "{\"location\": \"San Francisco, CA\", \"unit\": \"fahrenheit\"}"
    }
  }]
}
```

**Key fields:**

- `id`: Unique identifier you'll reference when returning results
- `function.name`: Which tool to execute
- `function.arguments`: JSON string of arguments (needs parsing)

### 3. Tool Execution and Results

Application code executes the tool and creates a new message with the results:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "name": "get_weather",
  "content": "{\"temperature\": 72, \"condition\": \"sunny\", \"unit\": \"fahrenheit\"}"
}
```

**Key connections:**

- The `tool` message's `tool_call_id` must match the `id` from the assistant's `tool_calls`
- `content` can be any string value
- The updated messages array is then sent back to the model

### 4. Model Evaluates Results and Decides Next Steps

The model analyzes the tool results and either:
- Returns a final answer (no more `tool_calls`)
- Returns more tool call requests (loop continues)

## Supported Models for Tool Use

| Model ID | Local & Remote Tool Use | Parallel Tool Use | JSON Mode | Built-In Tools |
|----------|------------------------|-------------------|-----------|----------------|
| moonshotai/kimi-k2-instruct-0905 | Yes ✅ | Yes ✅ | Yes ✅ | No ❌ |
| openai/gpt-oss-20b | Yes ✅ | No ❌ | Yes ✅ | Yes ✅ |
| openai/gpt-oss-120b | Yes ✅ | No ❌ | Yes ✅ | Yes ✅ |
| openai/gpt-oss-safeguard-20b | Yes ✅ | No ❌ | Yes ✅ | No ❌ |
| qwen/qwen3-32b | Yes ✅ | Yes ✅ | Yes ✅ | No ❌ |
| meta-llama/llama-4-scout-17b-16e-instruct | Yes ✅ | Yes ✅ | Yes ✅ | No ❌ |
| meta-llama/llama-4-maverick-17b-128e-instruct | Yes ✅ | Yes ✅ | Yes ✅ | No ❌ |
| llama-3.3-70b-versatile | Yes ✅ | Yes ✅ | Yes ✅ | No ❌ |
| llama-3.1-8b-instant | Yes ✅ | Yes ✅ | Yes ✅ | No ❌ |
| groq/compound | No ❌ | N/A | Yes ✅ | Yes ✅ |
| groq/compound-mini | No ❌ | N/A | Yes ✅ | Yes ✅ |

## Tool Use Patterns on Groq API

### 1. Groq Built-In Tools

Groq maintains pre-built tools like web search, code execution, and browser automation that execute entirely on Groq's infrastructure. All tool calls happen in a single API call.

**Ideal for:**
- Drop-in developer experience with zero setup
- Applications requiring the lowest possible latency
- Web search and browsing capabilities
- Safe code execution environments
- Single-call agentic responses

**Supported models:** `groq/compound`, `groq/compound-mini`, `openai/gpt-oss-20b`, `openai/gpt-oss-120b`

### 2. Remote Tool Calling with MCP

The Model Context Protocol (MCP) is an open standard that allows models to connect to and execute external tools. Groq supports MCP tool discovery and execution server-side.

**Ideal for:**
- Standardized integrations (GitHub, databases, external APIs)
- Tools maintained by third parties
- Sharing tools across multiple applications
- Accessing tools without hosting infrastructure

### 3. Local Tool Calling (Function Calling)

Manually write functions and corresponding tool definitions. The tool definitions are provided to the model at inference time, and the model returns structured tool call requests.

**Ideal for:**
- Custom business logic
- Internal APIs and databases
- Proprietary workflows
- Fine-grained control over security and execution

### Comparison

| Pattern | You Provide | Execution Location | Orchestration | API Calls |
|---------|-------------|-------------------|---------------|-----------|
| **Built-In** | List of enabled built-in tools | Groq servers | Groq manages | Single call |
| **Remote MCP** | MCP server URL + auth | MCP server | Groq manages | Single call |
| **Local** | Tool definitions + implementation | Your code | You manage loop | Multiple (2+ per iteration) |

## Parallel Tool Use

Many models support parallel tool use, where multiple tools can be called simultaneously:

**Without parallel tool use:**
```
Query: "What's the weather in NYC and LA?"
Call 1: get_weather(location="NYC")      → Wait for result
Call 2: get_weather(location="LA")       → Wait for result
Final response
```

**With parallel tool use:**
```
Query: "What's the weather in NYC and LA?"
Call 1: [get_weather(location="NYC"), get_weather(location="LA")]
Both execute simultaneously → Final response
```

## Why Groq's Speed Matters

Because agentic workflows involve multiple inference calls:

- **Single tool call workflow**: 2 inference calls
- **Multi-tool workflow**: 3-5+ inference calls
- **Complex agent loops**: 10+ inference calls

With traditional inference speeds of 10-30 tokens/second, multi-tool workflows feel slow. Groq's inference speed of **300-1,000+ tokens/second** makes these agentic experiences feel **instantaneous**.

---

# Structured Outputs

Guarantee model responses strictly conform to your JSON schema for reliable, type-safe data structures.

## Introduction

Structured Outputs ensures model responses conform to your provided JSON Schema. The feature offers two modes:

### Strict Mode (strict: true)

With `strict: true`, the model uses **constrained decoding** to guarantee output always matches your schema exactly:

- **Never errors or produces invalid JSON** - Constrained at token level
- **100% schema adherence** - Every response perfectly matches your JSON Schema
- **Stricter requirements** - All fields must be `required`, objects must set `additionalProperties: false`
- **Limited model support** - Currently only available on select models

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "schema_name",
      "strict": true,
      "schema": { ... }
    }
  }
}
```

### Best-effort Mode (strict: false)

With `strict: false` (default), the model attempts to match your schema without hard constraints:

- **Valid JSON, but schema adherence not guaranteed**
- **Possible errors and malformed output**
- **Fewer requirements** - More flexible schema constraints
- **Broader model support**

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "schema_name",
      "strict": false,
      "schema": { ... }
    }
  }
}
```

**Key benefits:**

1. **Type-safe responses:** Reduce validation and retry logic
2. **Programmatic refusal detection:** Detect safety-based model refusals
3. **Simplified prompting:** Less complex prompts needed

## Supported Models for Structured Outputs

### Models with Strict Mode (strict: true)

| Model ID | Model |
|----------|-------|
| openai/gpt-oss-20b | GPT-OSS 20B |
| openai/gpt-oss-120b | GPT-OSS 120B |

### Models with Best-effort Mode (strict: false)

| Model ID | Model |
|----------|-------|
| openai/gpt-oss-20b | GPT-OSS 20B |
| openai/gpt-oss-120b | GPT-OSS 120B |
| openai/gpt-oss-safeguard-20b | Safety GPT OSS 20B |
| moonshotai/kimi-k2-instruct-0905 | Kimi K2 Instruct |
| meta-llama/llama-4-maverick-17b-128e-instruct | Llama 4 Maverick |
| meta-llama/llama-4-scout-17b-16e-instruct | Llama 4 Scout |

> **Note:** Streaming and tool use are not currently supported with Structured Outputs.

## Example: Getting Structured Response from Unstructured Text

### Python

```python
from groq import Groq
import json

groq = Groq()

response = groq.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[
        {"role": "system", "content": "Extract product review information from the text."},
        {
            "role": "user",
            "content": "I bought the UltraSound Headphones last week and I'm really impressed! The noise cancellation is amazing and the battery lasts all day. Sound quality is crisp and clear. I'd give it 4.5 out of 5 stars.",
        },
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "product_review",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string"},
                    "rating": {"type": "number"},
                    "sentiment": {
                        "type": "string",
                        "enum": ["positive", "negative", "neutral"]
                    },
                    "key_features": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "required": ["product_name", "rating", "sentiment", "key_features"],
                "additionalProperties": False
            }
        }
    }
)

result = json.loads(response.choices[0].message.content or "{}")
print(json.dumps(result, indent=2))
```

### TypeScript

```typescript
import Groq from "groq-sdk";

const groq = new Groq();

const response = await groq.chat.completions.create({
  model: "openai/gpt-oss-20b",
  messages: [
    { role: "system", content: "Extract product review information from the text." },
    {
      role: "user",
      content: "I bought the UltraSound Headphones last week and I'm really impressed! The noise cancellation is amazing and the battery lasts all day. Sound quality is crisp and clear. I'd give it 4.5 out of 5 stars.",
    },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "product_review",
      strict: true,
      schema: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          rating: { type: "number" },
          sentiment: { 
            type: "string",
            enum: ["positive", "negative", "neutral"]
          },
          key_features: { 
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["product_name", "rating", "sentiment", "key_features"],
        additionalProperties: false
      }
    }
  }
});

const result = JSON.parse(response.choices[0].message.content || "{}");
console.log(result);
```

**Example Output:**

```json
{
  "product_name": "UltraSound Headphones",
  "rating": 4.5,
  "sentiment": "positive",
  "key_features": [
    "amazing noise cancellation",
    "all-day battery life",
    "crisp and clear sound quality"
  ]
}
```

## Choosing Between Strict and Best-effort Mode

| Aspect | Strict Mode (strict: true) | Best-effort Mode (strict: false) |
|--------|---------------------------|----------------------------------|
| **Schema adherence** | Guaranteed - uses constrained decoding | Best-effort - generally compliant |
| **Error handling** | Never produces invalid JSON | May occasionally 400 errors |
| **Requirements** | All fields required, additionalProperties: false | More flexible constraints |
| **Model support** | Limited (GPT-OSS 20B, 120B) | All Structured Outputs models |
| **When to use** | Production apps requiring 100% reliability | Development, prototyping |

**Recommendation:** Use Strict Mode when available for production. Fall back to Best-effort Mode for broader model support or during development.

## Examples

### SQL Query Generation

```python
from groq import Groq
from pydantic import BaseModel
import json

client = Groq()

class ValidationStatus(BaseModel):
    is_valid: bool
    syntax_errors: list[str]

class SQLQueryGeneration(BaseModel):
    query: str
    query_type: str
    tables_used: list[str]
    estimated_complexity: str
    execution_notes: list[str]
    validation_status: ValidationStatus

response = client.chat.completions.create(
    model="moonshotai/kimi-k2-instruct-0905",
    messages=[
        {
            "role": "system",
            "content": "You are a SQL expert. Generate structured SQL queries from natural language descriptions.",
        },
        {"role": "user", "content": "Find all customers who made orders over $500 in the last 30 days"},
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "sql_query_generation",
            "schema": SQLQueryGeneration.model_json_schema()
        }
    }
)

sql_query_generation = SQLQueryGeneration.model_validate(json.loads(response.choices[0].message.content))
print(json.dumps(sql_query_generation.model_dump(), indent=2))
```

### Email Classification

```python
from groq import Groq
from pydantic import BaseModel
import json

client = Groq()

class KeyEntity(BaseModel):
    entity: str
    type: str

class EmailClassification(BaseModel):
    category: str
    priority: str
    confidence_score: float
    sentiment: str
    key_entities: list[KeyEntity]
    suggested_actions: list[str]
    requires_immediate_attention: bool
    estimated_response_time: str

response = client.chat.completions.create(
    model="moonshotai/kimi-k2-instruct-0905",
    messages=[
        {
            "role": "system",
            "content": "You are an email classification expert.",
        },
        {"role": "user", "content": "Subject: URGENT: Server downtime affecting production..."},
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "email_classification",
            "schema": EmailClassification.model_json_schema()
        }
    }
)

email_classification = EmailClassification.model_validate(json.loads(response.choices[0].message.content))
print(json.dumps(email_classification.model_dump(), indent=2))
```

## Schema Requirements

### Supported Data Types

- **Primitives:** String, Number, Boolean, Integer
- **Complex:** Object, Array, Enum
- **Composition:** anyOf (union types)

### Schema Constraints for Strict Mode

**Required fields:** All schema properties must be marked as `required`.

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" }
  },
  "required": ["name", "age"]
}
```

**Closed objects:** All objects must set `additionalProperties: false`.

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "email": { "type": "string" }
  },
  "required": ["name", "email"],
  "additionalProperties": false
}
```

**Handling optional fields:** Use union types with `null`:

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "nickname": { 
      "type": ["string", "null"]
    }
  },
  "required": ["name", "nickname"],
  "additionalProperties": false
}
```

### Union Types

Each schema within `anyOf` must comply with all subset restrictions:

```json
{
  "type": "object",
  "properties": {
    "payment_method": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "card_number": { "type": "string" },
            "expiry_date": { "type": "string" },
            "cvv": { "type": "string" }
          },
          "additionalProperties": false,
          "required": ["card_number", "expiry_date", "cvv"]
        },
        {
          "type": "object",
          "properties": {
            "account_number": { "type": "string" },
            "routing_number": { "type": "string" }
          },
          "additionalProperties": false,
          "required": ["account_number", "routing_number"]
        }
      ]
    }
  },
  "additionalProperties": false,
  "required": ["payment_method"]
}
```

### Reusable Subschemas

Define reusable components with `$defs` and reference them using `$ref`:

```json
{
  "type": "object",
  "properties": {
    "milestones": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/milestone"
      }
    }
  },
  "$defs": {
    "milestone": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "deadline": { "type": "string" },
        "completed": { "type": "boolean" }
      },
      "required": ["title", "deadline", "completed"],
      "additionalProperties": false
    }
  },
  "required": ["milestones"],
  "additionalProperties": false
}
```

## JSON Object Mode

JSON Object Mode provides basic JSON output validation without schema enforcement.

| Aspect | Strict Mode | Best-effort Mode | JSON Object Mode |
|--------|-------------|------------------|------------------|
| **Valid JSON** | Always ✓ | Usually ✓ | Usually ✓ |
| **Schema adherence** | Guaranteed ✓ | Best-effort | No |
| **Can error** | No | Occasionally | Occasionally |
| **Requires schema** | Yes | Yes | No |
| **Model support** | Limited | Multiple models | All models |

Enable by setting `response_format` to `{ "type": "json_object" }`.

```python
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[
        {
            "role": "system",
            "content": "You are a data analysis API. Respond only with JSON."
        },
        {"role": "user", "content": "Analyze this review..."}
    ],
    response_format={"type": "json_object"}
)
```

## Error Handling

### Strict Mode

Constrained decoding guarantees schema-compliant output. No error handling needed for validation:

```python
response = client.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[...],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "schema_name",
            "strict": True,
            "schema": {...}
        }
    }
)

# Output is guaranteed to match schema
data = json.loads(response.choices[0].message.content)
```

### Best-effort Mode

Schema validation failures may occur (HTTP 400 errors):

```python
max_retries = 3
for attempt in range(max_retries):
    try:
        response = client.chat.completions.create(
            model="moonshotai/kimi-k2-instruct-0905",
            messages=[...],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "schema_name",
                    "strict": False,
                    "schema": {...}
                }
            }
        )
        data = json.loads(response.choices[0].message.content)
        validate_schema(data)
        break
    except ValidationError as e:
        if attempt == max_retries - 1:
            raise
```

## Best Practices

- **User input handling:** Include explicit instructions for invalid inputs
- **Output quality:** Structured outputs ensure schema compliance but not semantic accuracy
- **Refine prompts** for persistent errors or decompose complex tasks

---

# Reasoning

Reasoning models excel at complex problem-solving tasks requiring step-by-step analysis, logical deduction, and structured thinking. With Groq inference speed, these models deliver instant reasoning capabilities critical for real-time applications.

## Why Speed Matters for Reasoning

Reasoning models produce explicit reasoning chains as part of the token output. Complex problems often require multiple chains where each step builds on previous results. Low latency compounds benefits across reasoning chains, shaving minutes of reasoning to seconds.

## Supported Models

| Model ID | Model |
|----------|-------|
| openai/gpt-oss-20b | OpenAI GPT-OSS 20B |
| openai/gpt-oss-120b | OpenAI GPT-OSS 120B |
| openai/gpt-oss-safeguard-20b | OpenAI GPT-OSS-Safeguard 20B |
| qwen/qwen3-32b | Qwen 3 32B |

## Reasoning Format

Groq API supports explicit reasoning formats through the `reasoning_format` parameter:

| Option | Description |
|--------|-------------|
| `parsed` | Separates reasoning into dedicated `message.reasoning` field |
| `raw` | Includes reasoning within `<think>` tags in main text content |
| `hidden` | Returns only the final answer |

> **Note:** Format defaults to `raw` or `parsed` when JSON mode or tool use are enabled. Setting `raw` with JSON mode or tool use returns a 400 error.

### Including Reasoning in Response

Control with `include_reasoning` parameter:

| Option | Description |
|--------|-------------|
| `true` | Includes reasoning in dedicated `message.reasoning` field (default) |
| `false` | Excludes reasoning from response |

> **Note:** `include_reasoning` cannot be used together with `reasoning_format`.

## Reasoning Effort

### For Qwen 3 32B

| Option | Description |
|--------|-------------|
| `none` | Disable reasoning |
| `default` | Enable reasoning |

### For GPT-OSS Models

| Option | Description |
|--------|-------------|
| `low` | Small number of reasoning tokens |
| `medium` | Moderate number of reasoning tokens |
| `high` | Large number of reasoning tokens |

## Quick Start

### Python

```python
from groq import Groq

client = Groq()
completion = client.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[
        {
            "role": "user",
            "content": "How many r's are in the word strawberry?"
        }
    ],
    temperature=0.6,
    max_completion_tokens=1024,
    top_p=0.95,
    stream=True
)

for chunk in completion:
    print(chunk.choices[0].delta.content or "", end="")
```

### TypeScript

```typescript
import Groq from 'groq-sdk';

const client = new Groq();
const completion = await client.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [
        {
            role: "user",
            content: "How many r's are in the word strawberry?"
        }
    ],
    temperature: 0.6,
    max_completion_tokens: 1024,
    top_p: 0.95,
    stream: true
});

for await (const chunk of completion) {
    process.stdout.write(chunk.choices[0].delta.content || "");
}
```

### cURL

```bash
curl "https://api.groq.com/openai/v1/chat/completions" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${GROQ_API_KEY}" \
  -d '{
         "messages": [
           {
             "role": "user",
             "content": "How many r'\''s are in the word strawberry?"
           }
         ],
         "model": "openai/gpt-oss-20b",
         "temperature": 0.6,
         "max_completion_tokens": 4096,
         "top_p": 0.95,
         "stream": true
       }'
```

## Quick Start with Tool Use

```bash
curl https://api.groq.com/openai/v1/chat/completions -s \
  -H "authorization: bearer $GROQ_API_KEY" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
        {
            "role": "user",
            "content": "What is the weather like in Paris today?"
        }
    ],
    "tools": [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get current temperature for a given location.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "City and country e.g. Bogotá, Colombia"
                        }
                    },
                    "required": ["location"],
                    "additionalProperties": false
                },
                "strict": true
            }
        }
    ]}'
```

## Configuration Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `messages` | - | - | Array of message objects. Avoid system prompts - include all instructions in user message |
| `temperature` | 0.6 | 0.0 - 2.0 | Controls randomness. Recommended: 0.5-0.7 |
| `max_completion_tokens` | 1024 | - | Maximum response length. Increase for complex reasoning |
| `top_p` | 0.95 | 0.0 - 1.0 | Controls diversity of token selection |
| `stream` | false | boolean | Enables response streaming |
| `stop` | null | string/array | Custom stop sequences |
| `seed` | null | integer | Set for reproducible results |
| `response_format` | {type: "text"} | text/json_object | Output format |
| `reasoning_format` | raw | parsed/raw/hidden | How reasoning is presented |
| `reasoning_effort` | default | none/default/low/medium/high | Level of reasoning effort |

## Accessing Reasoning Content

### Non-GPT-OSS Models

#### Raw Format

```python
from groq import Groq

client = Groq()

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": "How do airplanes fly? Be concise."
        }
    ],
    model="qwen/qwen3-32b",
    stream=False,
    reasoning_format="raw"
)

print(chat_completion.choices[0].message)
```

Output includes `<think>...</think>` tags with reasoning.

#### Parsed Format

```python
chat_completion = client.chat.completions.create(
    messages=[...],
    model="qwen/qwen3-32b",
    stream=False,
    reasoning_format="parsed"
)
```

Output has separate `content` and `reasoning` fields.

#### Hidden Format

```python
chat_completion = client.chat.completions.create(
    messages=[...],
    model="qwen/qwen3-32b",
    stream=False,
    reasoning_format="hidden"
)
```

Only final answer returned, no visible reasoning.

### GPT-OSS Models

GPT-OSS models don't support `reasoning_format`. Use `include_reasoning` instead:

```python
# With reasoning (default)
chat_completion = client.chat.completions.create(
    messages=[...],
    model="openai/gpt-oss-20b",
    stream=False
)

# Without reasoning
chat_completion = client.chat.completions.create(
    messages=[...],
    model="openai/gpt-oss-20b",
    stream=False,
    include_reasoning=False
)

# High reasoning effort
chat_completion = client.chat.completions.create(
    messages=[...],
    model="openai/gpt-oss-20b",
    reasoning_effort="high",
    include_reasoning=True,
    stream=False
)
```

## Optimizing Performance

### Temperature and Token Management

- Best performance with temperature 0.5-0.7
- Lower values (0.5) for consistent mathematical proofs
- Higher values for creative problem-solving
- Increase `max_completion_tokens` for complex proofs

### Prompt Engineering

- Include all instructions in user messages (not system prompts)
- Request explicit validation steps and intermediate calculations
- Use zero-shot prompting (avoid few-shot)

---

# Qwen3 Model

Qwen3 is the latest generation of large language models in the Qwen series, offering dense and mixture-of-experts (MoE) models.

## Highlights

- **Seamless mode switching** between thinking mode (complex reasoning, math, coding) and non-thinking mode (efficient general dialogue)
- **Enhanced reasoning** surpassing previous QwQ and Qwen2.5 instruct models
- **Superior human preference alignment** for creative writing, role-playing, multi-turn dialogues
- **Expert agent capabilities** with precise tool integration
- **100+ languages and dialects** support

## Qwen3-32B Overview

| Attribute | Value |
|-----------|-------|
| Type | Causal Language Models |
| Training Stage | Pretraining & Post-training |
| Total Parameters | 32.8B |
| Non-Embedding Parameters | 31.2B |
| Number of Layers | 64 |
| Attention Heads (GQA) | 64 Q, 8 KV |
| Native Context Length | 32,768 tokens |
| Extended Context (YaRN) | 131,072 tokens |

## Quickstart

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "Qwen/Qwen3-32B"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto"
)

prompt = "Give me a short introduction to large language model."
messages = [
    {"role": "user", "content": prompt}
]
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    enable_thinking=True  # Default is True
)
model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

generated_ids = model.generate(
    **model_inputs,
    max_new_tokens=32768
)
output_ids = generated_ids[0][len(model_inputs.input_ids[0]):].tolist()

# Parse thinking content
try:
    index = len(output_ids) - output_ids[::-1].index(151668)  # </think>
except ValueError:
    index = 0

thinking_content = tokenizer.decode(output_ids[:index], skip_special_tokens=True).strip("\n")
content = tokenizer.decode(output_ids[index:], skip_special_tokens=True).strip("\n")

print("thinking content:", thinking_content)
print("content:", content)
```

## Deployment

### SGLang

```bash
python -m sglang.launch_server --model-path Qwen/Qwen3-32B --reasoning-parser qwen3
```

### vLLM

```bash
vllm serve Qwen/Qwen3-32B --enable-reasoning --reasoning-parser deepseek_r1
```

## Thinking Mode Switching

### enable_thinking=True (Default)

Model uses reasoning abilities to enhance response quality:

```python
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    enable_thinking=True
)
```

Generates think content in `<think>...</think>` block.

**Recommended parameters:** Temperature=0.6, TopP=0.95, TopK=20, MinP=0

### enable_thinking=False

Disables thinking behavior, aligning with Qwen2.5-Instruct:

```python
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    enable_thinking=False
)
```

**Recommended parameters:** Temperature=0.7, TopP=0.8, TopK=20, MinP=0

### Soft Switching via User Input

Use `/think` and `/no_think` in prompts to dynamically control behavior:

```python
class QwenChatbot:
    def __init__(self, model_name="Qwen/Qwen3-32B"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(model_name)
        self.history = []

    def generate_response(self, user_input):
        messages = self.history + [{"role": "user", "content": user_input}]
        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )
        inputs = self.tokenizer(text, return_tensors="pt")
        response_ids = self.model.generate(**inputs, max_new_tokens=32768)[0][len(inputs.input_ids[0]):].tolist()
        response = self.tokenizer.decode(response_ids, skip_special_tokens=True)
        
        self.history.append({"role": "user", "content": user_input})
        self.history.append({"role": "assistant", "content": response})
        return response

# Usage
chatbot = QwenChatbot()

# Default thinking mode
response_1 = chatbot.generate_response("How many r's in strawberries?")

# Disable thinking
response_2 = chatbot.generate_response("How many r's in blueberries? /no_think")

# Re-enable thinking
response_3 = chatbot.generate_response("Really? /think")
```

## Agentic Use

Qwen3 excels in tool calling. Use Qwen-Agent for best results:

```python
from qwen_agent.agents import Assistant

llm_cfg = {
    'model': 'Qwen3-32B',
    'model_server': 'http://localhost:8000/v1',
    'api_key': 'EMPTY',
}

tools = [
    {'mcpServers': {
        'time': {
            'command': 'uvx',
            'args': ['mcp-server-time', '--local-timezone=Asia/Shanghai']
        },
        "fetch": {
            "command": "uvx",
            "args": ["mcp-server-fetch"]
        }
    }},
    'code_interpreter',
]

bot = Assistant(llm=llm_cfg, function_list=tools)

messages = [{'role': 'user', 'content': 'Introduce the latest developments of Qwen'}]
for responses in bot.run(messages=messages):
    pass
print(responses)
```

## Processing Long Texts

For context beyond 32,768 tokens, use YaRN rope scaling:

### Method 1: Modify config.json

```json
{
    "rope_scaling": {
        "rope_type": "yarn",
        "factor": 4.0,
        "original_max_position_embeddings": 32768
    }
}
```

### Method 2: Command Line Arguments

**vLLM:**
```bash
vllm serve ... --rope-scaling '{"rope_type":"yarn","factor":4.0,"original_max_position_embeddings":32768}' --max-model-len 131072
```

**SGLang:**
```bash
python -m sglang.launch_server ... --json-model-override-args '{"rope_scaling":{"rope_type":"yarn","factor":4.0,"original_max_position_embeddings":32768}}'
```

**llama.cpp:**
```bash
llama-server ... --rope-scaling yarn --rope-scale 4 --yarn-orig-ctx 32768
```

> **Tip:** Only enable YaRN when processing long contexts. Adjust factor based on your typical context length.

## Best Practices

### Sampling Parameters

**Thinking mode (enable_thinking=True):**
- Temperature=0.6, TopP=0.95, TopK=20, MinP=0
- DO NOT use greedy decoding

**Non-thinking mode (enable_thinking=False):**
- Temperature=0.7, TopP=0.8, TopK=20, MinP=0

**To reduce repetitions:**
- Adjust `presence_penalty` between 0 and 2

### Output Length

- Most queries: 32,768 tokens
- Complex problems (math/programming competitions): 38,912 tokens

### Standardize Output Format

**Math Problems:**
> "Please reason step by step, and put your final answer within \boxed{}."

**Multiple-Choice Questions:**
> "Please show your choice in the answer field with only the choice letter, e.g., \"answer\": \"C\"."

### Multi-turn Conversations

Historical model output should only include the final output, not thinking content.

---

## Citation

```bibtex
@misc{qwen3technicalreport,
      title={Qwen3 Technical Report}, 
      author={Qwen Team},
      year={2025},
      eprint={2505.09388},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2505.09388}, 
}
```
