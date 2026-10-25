import type { SupabaseClient } from "@supabase/supabase-js";

async function time(fn: () => PromiseLike<unknown>): Promise<number> {
  const t = performance.now();
  await fn();
  return Math.round(performance.now() - t);
}

/**
 * Times three DIFFERENT database questions (identical ones can be reused by the website and look instant)
 * and both ways of checking the login.
 */
export async function measureSpeed(supabase: SupabaseClient) {
  const runs: number[] = [];
  for (const table of ["memos", "buyers", "payments"]) {
    runs.push(await time(() => supabase.from(table).select("id", { head: true, count: "exact" })));
  }
  const loginServer = await time(() => supabase.auth.getUser());
  await supabase.auth.getClaims();                       // first call may download the signing keys
  const loginLocal = await time(() => supabase.auth.getClaims());
  return { runs, loginServer, loginLocal };
}
