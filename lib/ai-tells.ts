// Flags phrasing that reads as machine-written. Source: Wikipedia's
// "Signs of AI writing" (checked 28 Nov 2026), trimmed to patterns a
// program can match with few false alarms, plus a few resume clichés.
// Recruiters skim; a bullet full of "leveraged" and "pivotal" reads as
// generated even when the facts are real. We only flag, never rewrite
// meaning, so the candidate stays in charge of their own claims.

export type AiTell = {
  /** The exact text that matched, as it appears in the input. */
  match: string;
  kind: "word" | "phrase" | "punctuation" | "structure";
  /** Plain-language hint shown to the user. */
  hint: string;
};

// Words Wikipedia lists as over-used by AI models (2023 to 2026), and
// resume clichés with the same effect. Left out on purpose because they
// have real meanings on a CV: "landscape" (landscape architect) and
// "dynamic" (dynamic programming). Matched as whole words, any case,
// with common endings (leverage, leveraged, leveraging).
const WORDS: ReadonlyArray<string> = [
  "delve", "tapestry", "testament", "pivotal", "crucial", "intricate", "meticulous",
  "meticulously", "underscore", "showcase", "foster", "bolster", "garner", "vibrant",
  "multifaceted", "leverage", "seamless", "seamlessly", "robust", "synergy", "spearhead",
  "realm", "enduring", "interplay", "groundbreaking", "renowned",
  "results-driven", "passionate",
];

const PHRASES: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:plays?|played) an? (?:crucial|pivotal|vital|key|significant) role\b/gi, "Say what you did instead of calling it a role."],
  [/\bis a testament to\b/gi, "Stock AI phrase; state the fact directly."],
  [/\bstands? as\b|\bserves? as a\b/gi, "Use a plain verb such as 'is' or 'was'."],
  [/\bevolving landscape\b|\bfast-paced environment\b/gi, "Filler; name the actual setting."],
  [/\bvaluable insights?\b/gi, "Say what the insight was."],
  [/\bin order to\b/gi, "Shorter: 'to'."],
  [/\bin (?:summary|conclusion)\b/gi, "Closing summary; cut it."],
  [/\bnot only\b[^.]{0,60}\bbut also\b/gi, "'Not only... but also' reads as generated; split into two facts."],
  [/\b(?:it'?s|it is) not (?:just )?[^.,]{1,40}, (?:it'?s|it is)\b/gi, "'It's not X, it's Y' pattern; state Y."],
];

// "leverage" becomes leverag(?:e|es|ed|ing) so "leveraging" matches too;
// other words just take an optional s / es / ed / ing.
function wordForms(word: string): string {
  const escaped = word.replace(/-/g, "\\-");
  return word.endsWith("e") ? `${escaped.slice(0, -1)}(?:e|es|ed|ing)` : `${escaped}(?:s|es|ed|ing)?`;
}

const WORD_PATTERN = new RegExp(`\\b(?:${WORDS.map(wordForms).join("|")})\\b`, "gi");

/**
 * Returns every AI-writing tell in `text`, in the order found.
 * Empty input returns an empty list.
 */
export function findAiTells(text: string): AiTell[] {
  if (!text.trim()) return [];
  const found: Array<AiTell & { at: number }> = [];

  for (const hit of text.matchAll(WORD_PATTERN)) {
    found.push({ match: hit[0], kind: "word", hint: "Often-overused AI word; prefer a plain one.", at: hit.index ?? 0 });
  }
  for (const [pattern, hint] of PHRASES) {
    for (const hit of text.matchAll(pattern)) {
      found.push({ match: hit[0], kind: hit[0].includes(",") ? "structure" : "phrase", hint, at: hit.index ?? 0 });
    }
  }
  // An em dash with spaces around it, used where a comma would do.
  for (const hit of text.matchAll(/ — /g)) {
    found.push({ match: "—", kind: "punctuation", hint: "Spaced em dash; a comma or full stop reads more natural.", at: hit.index ?? 0 });
  }

  return found.sort((left, right) => left.at - right.at).map(({ match, kind, hint }) => ({ match, kind, hint }));
}

/** Short summary for a warning line, e.g. `"leveraged", "pivotal" and 1 more`. */
export function describeTells(tells: AiTell[], limit = 3): string {
  const unique = [...new Set(tells.map((tell) => tell.match.toLowerCase()))];
  const shown = unique.slice(0, limit).map((value) => `“${value}”`);
  const rest = unique.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  if (shown.length > 1) return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return shown[0] ?? "";
}
