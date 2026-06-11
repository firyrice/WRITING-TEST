/**
 * Assign anonymous aliases (模型 A, 模型 B, ...) to a list of model IDs.
 * After Z, continues as AA, BB, CC (rare; we never have 27+ candidates in practice).
 */
export function assignAliases(modelIds: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  modelIds.forEach((id, i) => {
    out[id] = `模型 ${aliasLetter(i)}`;
  });
  return out;
}

function aliasLetter(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  // 26 -> AA, 27 -> BB, 28 -> CC ...
  const ch = String.fromCharCode(65 + ((index - 26) % 26));
  return ch + ch;
}

/**
 * Replace alias mentions in markdown with their human-readable model labels.
 *
 * Uses a negative lookahead on `[A-Z]` to avoid eating "模型 A" when "模型 AB"
 * is the actual token (defensive — current scheme uses single letters, but
 * supports the AA-style overflow as well).
 */
export function applyAliasReplacement(
  markdown: string,
  aliasToLabel: Record<string, string>
): string {
  // Sort by length desc so "模型 AA" matches before "模型 A".
  const entries = Object.entries(aliasToLabel).sort(
    ([a], [b]) => b.length - a.length
  );
  let out = markdown;
  for (const [alias, label] of entries) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // (?![A-Z]) prevents "模型 A" from matching inside "模型 AB"
    const re = new RegExp(escaped + '(?![A-Z])', 'g');
    out = out.replace(re, label);
  }
  return out;
}
