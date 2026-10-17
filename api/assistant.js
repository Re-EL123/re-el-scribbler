import { withApi } from '../lib/handler.js';
import { ok, fail, ApiError } from '../lib/respond.js';
import { requireUser } from '../lib/auth.js';

const SYSTEM_PROMPT =
  'You are the Re-EL Scribbler writing assistant. Help authors improve clarity, structure, and tone. Reply concisely and stay on the task.';

async function callOpenAI(prompt, context) {
  const key = process.env.OPENAI_API_KEY;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: context ? `${prompt}\n\n---\nContext:\n${context}` : prompt }
      ],
      max_tokens: 800,
      temperature: 0.7
    })
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new ApiError(502, 'AI_PROVIDER_ERROR', `AI provider error: ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callAnthropic(prompt, context) {
  const key = process.env.ANTHROPIC_API_KEY;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: context ? `${prompt}\n\n---\nContext:\n${context}` : prompt }
      ]
    })
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new ApiError(502, 'AI_PROVIDER_ERROR', `AI provider error: ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

export default withApi(async (req, res) => {
  await requireUser(req);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const body = req.body || {};
  const prompt = String(body.prompt || '').trim();
  if (!prompt) throw new ApiError(400, 'VALIDATION_ERROR', 'Prompt is required');

  const context = body.context ? String(body.context).slice(0, 12000) : '';
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    const message = await callAnthropic(prompt.slice(0, 4000), context);
    return ok(res, { message, provider: 'anthropic' });
  }
  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    const message = await callOpenAI(prompt.slice(0, 4000), context);
    return ok(res, { message, provider: 'openai' });
  }

  throw new ApiError(
    503,
    'AI_NOT_CONFIGURED',
    'The writing assistant is not configured yet. Add an AI API key to enable it.'
  );
});
