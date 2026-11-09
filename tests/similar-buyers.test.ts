import { describe, expect, it } from "vitest";
import { buyerKey, duplicateGroups, looksSame, similarTo } from "@/lib/similar-buyers";

describe("similar buyers", () => {
  it("spots the same business spelled two ways", () => {
    expect(looksSame("BENNY'S JEWELER", "BENNY'S JEWELERS")).toBe(true);
    expect(looksSame("Vatche's Jewelry", "VATCHES JEWELRY INC")).toBe(true);
    expect(looksSame("S&J JEWELERS", "S & J Jewelers")).toBe(true);
  });
  it("does not confuse different businesses", () => {
    expect(looksSame("LAZARO", "LAZARO DAVINCHY")).toBe(false);
    expect(looksSame("CALI JEWELERS", "CARLSBAD JEWELRY STORE")).toBe(false);
    expect(looksSame("AK", "AL")).toBe(false);
  });
  it("treats an exact match as the same buyer, not a lookalike", () => {
    expect(looksSame("AK", "ak")).toBe(false);
    expect(similarTo("Benny's Jeweler", ["BENNY'S JEWELER", "BENNY'S JEWELERS"])).toEqual([]);
  });
  it("suggests existing names for a new typed name", () => {
    expect(similarTo("Bennys Jeweler", ["BENNY'S JEWELER", "BENNY'S JEWELERS", "CALI JEWELERS"])).toEqual(["BENNY'S JEWELER", "BENNY'S JEWELERS"]);
    expect(similarTo("ab", ["ABC"])).toEqual([]);
  });
  it("groups lookalikes", () => {
    const g = duplicateGroups([{ id: "1", name: "BENNY'S JEWELER" }, { id: "2", name: "CALI JEWELERS" }, { id: "3", name: "BENNY'S JEWELERS" }]);
    expect(g.map((x) => x.map((b) => b.id))).toEqual([["1", "3"]]);
  });
  it("builds a key without filler words", () => {
    expect(buyerKey("The Diamond Outlet, LLC")).toBe("diamondoutlet");
  });
});
