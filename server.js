import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/optimize', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
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
          content: `You are a prompt optimization expert. Analyze this rough prompt and transform it into a well-structured, comprehensive prompt following this format:

**Goal**
[Clear statement of what the prompt aims to achieve]

**Return Format**
[Structured outline of how the response should be organized]

**Warnings**
[Things to avoid or be careful about]

**Context**
[Background information and assumptions about the user's needs]

**Additional Guidelines**
[Any extra tips or requirements]

Here's the rough prompt to optimize:
"${prompt}"

Please provide ONLY the optimized prompt in the format above, without any preamble or explanation.`
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', errorData);
      return res.status(response.status).json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    res.json({ optimizedPrompt: data.content[0].text });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
});
