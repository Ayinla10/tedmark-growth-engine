import OpenAI from 'openai';
import dotenv from 'dotenv';
import { recordApiUsage } from './db.js';

dotenv.config();

// Supports two providers, selected by which env var is present:
//  - OPENROUTER_API_KEY → openrouter.ai (supports many free models)
//  - DEEPSEEK_API_KEY   → api.deepseek.com (fallback)
//
// Set LLM_MODEL in .env to override the default model for the active provider.
// Good free OpenRouter models: meta-llama/llama-3.3-70b-instruct:free
//                               google/gemma-3-27b-it:free
//                               deepseek/deepseek-chat-v3-0324:free
const USE_OPENROUTER = !!process.env.OPENROUTER_API_KEY;

export const LLM_MODEL = process.env.LLM_MODEL || (
  USE_OPENROUTER
    ? 'meta-llama/llama-3.3-70b-instruct:free'
    : 'deepseek-chat'
);

let client = null;

function getClient() {
  if (USE_OPENROUTER) {
    if (!client) {
      client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://tedmark.digital',
          'X-Title': 'Tedmark Growth Engine',
        },
      });
    }
    return client;
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('No LLM API key — set OPENROUTER_API_KEY or DEEPSEEK_API_KEY in .env');
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
 * Retries up to 3 times on rate-limit (429) and transient server errors.
 * @param {object} opts
 * @param {string} opts.system - system prompt / instructions
 * @param {string} opts.user - the user message
 * @param {number} [opts.maxTokens=1024]
 * @param {boolean} [opts.json=false] - request a JSON object response
 * @returns {Promise<string>}
 */
export async function complete({ system, user, maxTokens = 1024, json = false }) {
  const RETRYABLE = new Set([429, 500, 502, 503, 529]);
  let lastErr;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: LLM_MODEL,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      // Always log finish_reason and raw content so we can diagnose empty responses
      const choice = response.choices?.[0];
      console.log(`[llm] attempt=${attempt + 1} finish_reason=${choice?.finish_reason} json=${json} content_len=${(choice?.message?.content ?? '').length} raw="${(choice?.message?.content ?? '').slice(0, 200)}"`);

      if (process.env.LLM_DEBUG) {
        const reasoning = choice?.message?.reasoning_content;
        console.error(
          `[llm-debug] finish_reason=${choice?.finish_reason} maxTokens=${maxTokens} reasoning_len=${reasoning ? reasoning.length : 0} content_len=${(choice?.message?.content ?? '').length} usage=${JSON.stringify(response.usage)} raw="${(choice?.message?.content ?? '').slice(0, 300)}"`
        );
      }

      // Real token counts from the API response, not an estimate — logged so
      // the cost dashboard reflects what was actually spent, not a guess.
      if (response.usage) {
        try {
          const provider = USE_OPENROUTER ? 'openrouter' : 'deepseek';
          await recordApiUsage(provider, LLM_MODEL, 'tokens_in', response.usage.prompt_tokens);
          await recordApiUsage(provider, LLM_MODEL, 'tokens_out', response.usage.completion_tokens);
        } catch (err) {
          console.warn(`[llm] Failed to record API usage: ${err.message}`);
        }
      }

      return response.choices?.[0]?.message?.content ?? '';

    } catch (err) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status;
      if (RETRYABLE.has(status) && attempt < 2) {
        const delay = status === 429 ? 3000 : 1500;
        console.warn(`[llm] attempt=${attempt + 1} status=${status} — retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}
