import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// DeepSeek exposes an OpenAI-compatible API, so we use the openai SDK
// pointed at DeepSeek's endpoint. Swapping providers later means editing
// only this file.
//
// DeepSeek retired the "deepseek-chat" model name in favor of versioned
// names — "deepseek-v4-flash" is the direct successor (general-purpose,
// cost-effective), as opposed to "deepseek-v4-pro" (their heavier
// reasoning tier, not needed for the short structured completions used
// throughout this codebase).
export const LLM_MODEL = 'deepseek-v4-flash';

let client = null;

function getClient() {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is missing from .env — cannot call the AI model.');
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return client;
}

/**
 * Send a system + user prompt to the model and return the text reply.
 * @param {object} opts
 * @param {string} opts.system - system prompt / instructions
 * @param {string} opts.user - the user message
 * @param {number} [opts.maxTokens=1024]
 * @param {boolean} [opts.json=false] - request a JSON object response
 * @returns {Promise<string>}
 */
export async function complete({ system, user, maxTokens = 1024, json = false }) {
  const response = await getClient().chat.completions.create({
    model: LLM_MODEL,
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  return response.choices?.[0]?.message?.content ?? '';
}
