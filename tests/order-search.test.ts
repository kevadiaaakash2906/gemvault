import { describe, expect, it } from "vitest";
import { matchCt, matchText } from "@/lib/order-search";

describe("IN CT search", () => {
  it("matches everything when empty", () => expect(matchCt(5.15, "  ")).toBe(true));
  it("matches part of the number", () => {
    expect(matchCt(5.15, "5.1")).toBe(true);
    expect(matchCt(5.15, "6")).toBe(false);
  });
  it("matches a range, in either order", () => {
    expect(matchCt(4.2, "3-5")).toBe(true);
    expect(matchCt(4.2, "5-3")).toBe(true);
    expect(matchCt(6, "3-5")).toBe(false);
  });
  it("never matches an order with no IN CT when something is typed", () => expect(matchCt(null, "1")).toBe(false));
});

describe("text search", () => {
  const fields = ["BR-100", "HET", "CALI JEWELERS", "M7"];
  it("matches every word in any order and any case", () => {
    expect(matchText(fields, "cali br-100")).toBe(true);
    expect(matchText(fields, "het m7")).toBe(true);
  });
  it("fails when one word is missing", () => expect(matchText(fields, "cali ring")).toBe(false));
  it("matches everything when empty", () => expect(matchText(fields, "")).toBe(true));
});
