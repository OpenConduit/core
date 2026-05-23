// Shared context-window helpers used by InputBar, ContextWarningBanner, ContextBar, and useChat.

// Keys are matched by substring (case-insensitive). More-specific keys must come before
// any key they are a substring of (e.g. 'llama-4' before 'llama-3').
const CONTEXT_LIMITS: [string, number][] = [
  // Anthropic
  ['claude',          200_000],
  // OpenAI
  ['gpt-4o',          128_000],
  ['gpt-4-turbo',     128_000],
  ['gpt-4',             8_192],
  ['gpt-3.5',          16_385],
  ['o1',              200_000],
  ['o3',              200_000],
  ['o4',              200_000],
  // Google
  ['gemini',        1_000_000],
  // Meta (most-specific variants first)
  ['llama-4',       1_000_000],
  ['llama-3',         131_072],
  ['llama-2',           4_096],
  // Mistral / Mixtral (codestral before mistral — longer match wins)
  ['codestral',       256_000],
  ['mistral',          32_768],
  ['mixtral',          32_768],
  // Google / local (gemma-3 before gemma)
  ['gemma-3',         131_072],
  ['gemma',             8_192],
  ['phi-3',           128_000],
  ['phi-4',            16_384],
  // DeepSeek
  ['deepseek',        128_000],
  // Alibaba
  ['qwen',            131_072],
  // xAI
  ['grok',            131_072],
  // Cohere
  ['command-r',       128_000],
  // Nous Research
  ['hermes',           32_768],
];

export function getContextLimit(model: string): number | null {
  const lower = model.toLowerCase();
  for (const [key, limit] of CONTEXT_LIMITS) {
    if (lower.includes(key)) return limit;
  }
  return null;
}

export function fmtTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
}

/** Rough token estimate from raw text (chars / 4). Good enough for trim decisions. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compute how many messages would be dropped by "trim oldest".
 * Mirrors the logic in useChat.trimOldMessages — use this for UI previews.
 * Returns 0 if nothing needs trimming.
 */
export function computeTrimCount(
  messages: Array<{ role: string; content: string }>,
  contextLimit: number | null,
): number {
  // Only user/assistant messages participate; skip tool_results, thinking, etc.
  let msgs = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  // Ensure we start on a user message
  while (msgs.length > 0 && msgs[0].role !== 'user') msgs = msgs.slice(1);
  if (msgs.length <= 2) return 0;

  const original = msgs.length;

  if (contextLimit) {
    const target = contextLimit * 0.5;
    if (msgs.reduce((s, m) => s + estimateTokens(m.content), 0) <= target) return 0;
    while (msgs.reduce((s, m) => s + estimateTokens(m.content), 0) > target && msgs.length > 2) {
      const idx = msgs.findIndex((m, i) => i > 0 && m.role === 'user');
      if (idx <= 0) break;
      msgs = msgs.slice(idx);
    }
  } else {
    // No known limit: drop up to 4 messages
    let dropped = 0;
    while (dropped < 4 && msgs.length > 2) {
      const idx = msgs.findIndex((m, i) => i > 0 && m.role === 'user');
      if (idx <= 0) break;
      dropped += idx;
      msgs = msgs.slice(idx);
    }
  }

  return original - msgs.length;
}
