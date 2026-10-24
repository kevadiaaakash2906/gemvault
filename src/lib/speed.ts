import type { SupabaseClient } from "@supabase/supabase-js";

async function time(fn: () => PromiseLike<unknown>): Promise<number> {
  const t = performance.now();
  await fn();
  return Math.round(performance.now() - t);
}

/** Times three database questions in a row and one login check. */
export async function measureSpeed(supabase: SupabaseClient) {
  const runs: number[] = [];
  for (let i = 0; i < 3; i++) runs.push(await time(() => supabase.from("memos").select("id", { head: true, count: "exact" })));
  const login = await time(() => supabase.auth.getUser());
  return { runs, login };
}
