/** Helpers that spot buyer names that probably mean the same business (for example "BENNY'S JEWELER" and "BENNY'S JEWELERS"). */

const NOISE_WORDS = new Set(["jewelers", "jeweler", "jewellers", "jeweller", "jewelry", "jewellery", "jewels", "jewel", "inc", "llc", "ltd", "co", "corp", "the", "and"]);

/** Lower case letters and digits only, without filler words such as "Jewelers" or "Inc". */
export function buyerKey(name: string): string {
  const words = name.toLowerCase().replace(/&/g, " and ").replace(/['’`]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const core = words.filter((w) => !NOISE_WORDS.has(w));
  const used = core.length > 0 ? core : words;
  return used.join("").replace(/s$/, "");
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** True when two different names are probably the same buyer. */
export function looksSame(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return false;   // identical names are not "similar", they are the same buyer
  const ka = buyerKey(a);
  const kb = buyerKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const longest = Math.max(ka.length, kb.length);
  if (longest < 5) return false;                                          // very short names (AK, HET) are too easy to confuse
  const allowed = longest <= 8 ? 1 : 2;
  return distance(ka, kb) <= allowed;
}

/** Names in `existing` that look like `typed`. Returns nothing when `typed` already exists exactly. */
export function similarTo(typed: string, existing: string[]): string[] {
  const t = typed.trim();
  if (t.length < 3) return [];
  if (existing.some((e) => e.trim().toLowerCase() === t.toLowerCase())) return [];
  return existing.filter((e) => looksSame(t, e)).slice(0, 3);
}

/** Groups of existing buyers that look alike, for the Buyers page. */
export function duplicateGroups<T extends { id: string; name: string }>(buyers: T[]): T[][] {
  const seen = new Set<string>();
  const groups: T[][] = [];
  for (const b of buyers) {
    if (seen.has(b.id)) continue;
    const group = [b, ...buyers.filter((o) => o.id !== b.id && !seen.has(o.id) && looksSame(b.name, o.name))];
    if (group.length > 1) { group.forEach((g) => seen.add(g.id)); groups.push(group); }
  }
  return groups;
}
