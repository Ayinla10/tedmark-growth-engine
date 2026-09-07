import OpenAI from 'openai';
import dotenv from 'dotenv';
import { recordApiUsage } from './db.js';

dotenv.config();

// Provider chain: try each free OpenRouter model in order, then fall back to DeepSeek (paid).
// Models are from different providers so each has its own rate-limit quota.
const FREE_MODELS = process.env.LLM_MODEL
  ? [process.env.LLM_MODEL]
  : [
      'google/gemma-4-31b-it:free',           // Google — 262K ctx
      'nvidia/nemotron-3-ultra-550b-a55b:free',// NVIDIA 550B — 1M ctx
      'nvidia/nemotron-3-super-120b-a12b:free',// NVIDIA 120B — 262K ctx
      'minimax/minimax-m3:free',               // MiniMax — 1M ctx
      'nvidia/nemotron-3.5-lightning:free',    // NVIDIA Lightning — 1M ctx
    ];

const DEEPSEEK_MODEL = 'deepseek-chat';

export const LLM_MODEL = FREE_MODELS[0];

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
        ...(provider === 'openrouter' ? { reasoning: { enabled: false } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user },
        ],
      });

      const choice = response.choices?.[0];
      const content = choice?.message?.content ?? '';
      console.log(`[llm] provider=${provider} attempt=${attempt + 1} finish_reason=${choice?.finish_reason} json=${json} content_len=${content.length}`);

      // Treat empty response as a retriable failure
      if (!content && attempt < 2) {
        console.warn(`[llm] ${provider} attempt=${attempt + 1} returned empty content — retrying`);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      if (!content) throw new Error('empty response');

      if (response.usage) {
        try {
          await recordApiUsage(provider, model, 'tokens_in',  response.usage.prompt_tokens);
          await recordApiUsage(provider, model, 'tokens_out', response.usage.completion_tokens);
        } catch (err) {
          console.warn(`[llm] Failed to record API usage: ${err.message}`);
        }
      }

      return content;

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

  // ── 1. Try each free OpenRouter model in sequence ─────────────────────────
  const orClient = getOpenRouterClient();
  if (orClient) {
    for (const model of FREE_MODELS) {
      try {
        return await callProvider(orClient, model, 'openrouter', opts);
      } catch (err) {
        const status = err?.status ?? err?.response?.status;
        console.warn(`[llm] OpenRouter model=${model} failed (${status ?? err?.message}) — trying next`);
      }
    }
    console.warn('[llm] All OpenRouter models exhausted — falling back to DeepSeek');
  }

  // ── 2. Fall back to DeepSeek ──────────────────────────────────────────────
  const dsClient = getDeepSeekClient();
  if (dsClient) {
    try {
      return await callProvider(dsClient, DEEPSEEK_MODEL, 'deepseek', opts);
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      if (status === 402) {
        throw new Error('All OpenRouter models and DeepSeek are unavailable (DeepSeek: insufficient balance).');
      }
      throw err;
    }
  }

  throw new Error('No LLM provider configured — set OPENROUTER_API_KEY or DEEPSEEK_API_KEY in env.');
}
