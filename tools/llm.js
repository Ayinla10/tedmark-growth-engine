import OpenAI from 'openai';
import dotenv from 'dotenv';
import { recordApiUsage } from './db.js';

dotenv.config();

// Provider chain (primary → fallback):
//   1. OPENROUTER_API_KEY → openrouter.ai  (primary, free models)
//   2. DEEPSEEK_API_KEY   → api.deepseek.com (fallback if OpenRouter fails)
//
// Set LLM_MODEL in .env to override the default OpenRouter model.
// Good free OpenRouter models: google/gemma-3-27b-it:free
//                               deepseek/deepseek-chat-v3-0324:free
//                               meta-llama/llama-3.3-70b-instruct:free

const OPENROUTER_MODEL = process.env.LLM_MODEL || 'google/gemma-4-31b-it:free';
const DEEPSEEK_MODEL   = 'deepseek-chat';

export const LLM_MODEL = process.env.OPENROUTER_API_KEY ? OPENROUTER_MODEL : DEEPSEEK_MODEL;

function makeOpenRouterClient() {
  if (!process.env.OPENROUTER_API_KEY) return null;
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://tedmark.digital',
      'X-Title': 'Tedmark Growth Engine',
    },
  });
}

function makeDeepSeekClient() {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
  });
}

// Lazy-init, cached
let orClient = null;
let dsClient = null;
function getOpenRouterClient() { return orClient ??= makeOpenRouterClient(); }
function getDeepSeekClient()   { return dsClient ??= makeDeepSeekClient(); }

const RETRYABLE = new Set([429, 500, 502, 503, 529]);

async function callProvider(client, model, provider, { system, user, maxTokens, json }) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user },
        ],
      });

      const choice = response.choices?.[0];
      console.log(`[llm] provider=${provider} attempt=${attempt + 1} finish_reason=${choice?.finish_reason} json=${json} content_len=${(choice?.message?.content ?? '').length}`);

      if (response.usage) {
        try {
          await recordApiUsage(provider, model, 'tokens_in',  response.usage.prompt_tokens);
          await recordApiUsage(provider, model, 'tokens_out', response.usage.completion_tokens);
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
        console.warn(`[llm] ${provider} attempt=${attempt + 1} status=${status} — retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Send a system + user prompt to the model and return the text reply.
 * Tries OpenRouter first; falls back to DeepSeek if OpenRouter fails.
 */
export async function complete({ system, user, maxTokens = 1024, json = false }) {
  const opts = { system, user, maxTokens, json };

  // ── 1. Try OpenRouter ─────────────────────────────────────────────────────
  const orClient = getOpenRouterClient();
  if (orClient) {
    try {
      return await callProvider(orClient, OPENROUTER_MODEL, 'openrouter', opts);
    } catch (err) {
      console.warn(`[llm] OpenRouter failed (${err?.status ?? err?.message}) — falling back to DeepSeek`);
    }
  }

  // ── 2. Fall back to DeepSeek ──────────────────────────────────────────────
  const dsClient = getDeepSeekClient();
  if (dsClient) {
    try {
      return await callProvider(dsClient, DEEPSEEK_MODEL, 'deepseek', opts);
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      if (status === 402) {
        throw new Error('Both OpenRouter and DeepSeek are unavailable (DeepSeek: insufficient balance).');
      }
      throw err;
    }
  }

  throw new Error('No LLM provider configured — set OPENROUTER_API_KEY or DEEPSEEK_API_KEY in env.');
}
