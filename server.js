import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/optimize', async (req, res) => {
  const { prompt, mode } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  let systemPrompt = '';

  if (mode === 'reasoning') {
    systemPrompt = `You are optimizing prompts for reasoning models. These models think deeply before responding, so the prompt should be clear and direct without over-structuring their reasoning process.

Transform this query into an optimized reasoning prompt:

**Task**
[Clear, concise problem statement - what needs to be solved or understood]

**Key Constraints**
[Important limitations, requirements, or parameters]

**Success Criteria**
[How to evaluate if the solution/answer is good]

**Reasoning Guidance** (optional)
[Only if needed: "Consider edge cases", "Think about tradeoffs", "Verify assumptions"]

Query: "${prompt}"

IMPORTANT: Keep it minimal. Trust the reasoning model to think deeply. Only add structure where it clarifies the problem. Ensure the optimized prompt is self-contained and can be used directly without further editing.

Provide ONLY the optimized prompt in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  } else if (mode === 'research') {
    systemPrompt = `You are a research methodology expert. Transform this into a comprehensive research plan:

**Research Objective**
[Clear statement of what needs to be investigated]

**Core Research Questions**
[5-7 specific, answerable questions in priority order]

**Methodology**
[Research approach and methods to be used]

**Information Sources**
[Specific types of sources with quality criteria]

**Success Metrics**
[How to determine if research is sufficient]

**Synthesis Framework**
[How to analyze and integrate findings across sources]

**Deliverable Format**
[Structure and style of the final output]

**Anticipated Challenges**
[Potential obstacles and mitigation strategies]

Query: "${prompt}"

Make this actionable and specific. Ensure the research plan is self-contained and can be used directly without further editing.

Provide ONLY the research plan in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  } else if (mode === 'socratic') {
    systemPrompt = `You are a Socratic learning guide. Create a learning journey through strategic questioning:

**Learning Objective**
[What the learner should understand by the end]

**Prior Knowledge Check**
[2-3 questions to assess current understanding]

**Foundation Questions**
[3-4 questions building core concepts]

**Deepening Questions**
[4-5 questions that progressively challenge understanding]

**Application & Synthesis**
[3-4 questions connecting concepts to real scenarios]

**Metacognitive Reflection**
[2-3 questions about the learning process itself: "What surprised you?", "What's still unclear?"]

**Common Misconceptions**
[2-3 misconceptions to address through questioning]

**Extension Paths**
[Suggested directions for continued exploration]

Topic: "${prompt}"

Focus on questions that spark insight, not just recall. Ensure the learning plan is self-contained and can be used directly without further editing.

Provide ONLY the learning plan in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  } else {
    // Default optimize mode
    systemPrompt = `You are a prompt engineering expert. Transform this rough prompt into a clear, effective prompt:

**Goal**
[Single sentence stating what the prompt aims to achieve]

**Context**
[Essential background information and assumptions about the task/user]

**Requirements**
[Specific constraints, format requirements, or must-have elements]

**Instructions**
[Step-by-step guidance on how to approach the task, if applicable]

**Success Criteria**
[How to evaluate if the response is good]

**Output Format**
[Exact structure the response should follow]

**Examples** (if helpful)
[Brief example showing desired output style]

**Avoid**
[Common pitfalls or things to explicitly not do]

Original prompt: "${prompt}"

Create a prompt that's self-contained and immediately usable. Ensure the optimized prompt can be used directly without further editing.

Provide ONLY the optimized prompt in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: systemPrompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', errorData);
      return res.status(response.status).json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    const optimizedText = data.content[0].text;

    // Basic validation - check for meta-commentary
    if (optimizedText.toLowerCase().includes('here is') ||
        optimizedText.toLowerCase().includes('i\'ve created') ||
        optimizedText.toLowerCase().startsWith('sure')) {
      console.warn('⚠️  Response contains meta-commentary, may need refinement');
    }

    res.json({ optimizedPrompt: optimizedText });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
});
