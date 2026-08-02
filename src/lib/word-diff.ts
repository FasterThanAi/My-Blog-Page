export interface DiffToken {
  value: string;
  type: "same" | "added" | "removed";
}

/**
 * Simple word-level diff via longest-common-subsequence, used to render a
 * lightweight "what changed" view between two post version snapshots.
 * Not meant to compete with a real diff library — just enough to highlight
 * additions/removals for a short article body at a glance.
 */
export function wordDiff(oldText: string, newText: string): DiffToken[] {
  const oldWords = oldText.split(/(\s+)/).filter(Boolean);
  const newWords = newText.split(/(\s+)/).filter(Boolean);

  const m = oldWords.length;
  const n = newWords.length;

  // LCS table (capped to avoid pathological O(n*m) blowups on huge posts)
  if (m * n > 4_000_000) {
    return [
      { value: oldText, type: "removed" },
      { value: newText, type: "added" },
    ];
  }

  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] =
        oldWords[i] === newWords[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (oldWords[i] === newWords[j]) {
      tokens.push({ value: oldWords[i], type: "same" });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      tokens.push({ value: oldWords[i], type: "removed" });
      i++;
    } else {
      tokens.push({ value: newWords[j], type: "added" });
      j++;
    }
  }
  while (i < m) tokens.push({ value: oldWords[i++], type: "removed" });
  while (j < n) tokens.push({ value: newWords[j++], type: "added" });

  return tokens;
}
