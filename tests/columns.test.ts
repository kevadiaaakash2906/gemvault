import { describe, expect, it } from "vitest";
import { COLUMNS, hiddenCss, sanitizeHidden } from "@/lib/columns";

describe("column choices", () => {
  it("drops unknown keys, duplicates and the always-shown Sr. No.", () => {
    expect(sanitizeHidden("orders", ["memo", "memo", "nonsense", "sr_no", 5])).toEqual(["memo"]);
    expect(sanitizeHidden("trading", "memo")).toEqual([]);
  });
  it("builds a stylesheet scoped to one table", () => {
    expect(hiddenCss("orders", ["memo", "photo"])).toBe(
      'table[data-table="orders"] [data-col="memo"]{display:none}table[data-table="orders"] [data-col="photo"]{display:none}',
    );
    expect(hiddenCss("orders", [])).toBe("");
  });
  it("keeps every column key unique and safe for CSS", () => {
    for (const cols of Object.values(COLUMNS)) {
      const keys = cols.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
      keys.forEach((k) => expect(k).toMatch(/^[a-z_]+$/));
    }
  });
});
