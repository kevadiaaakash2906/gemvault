import { describe, expect, it } from "vitest";
import { DIAMOND_SHAPES, findShapeBase, shapeVariants } from "@/lib/diamond-shapes";

const all = Object.values(DIAMOND_SHAPES).flat();

describe("diamond shape list", () => {
  it("has the same 8 shapes and 27 choices as the old site", () => {
    expect(Object.keys(DIAMOND_SHAPES)).toEqual(["Round", "Oval", "Marquise", "Emerald", "Pear", "Radiant", "Cushion", "Fancy Mix"]);
    expect(all).toHaveLength(27);
    expect(new Set(all.map((v) => v.value)).size).toBe(27);
  });
  it("keeps every saved value within the 60 characters the database allows", () => {
    expect(Math.max(...all.map((v) => v.value.length))).toBeLessThanOrEqual(60);
  });
  it("spells the old site's values exactly", () => {
    const vals = all.map((v) => v.value);
    for (const v of ["Round Bezel", "Oval East/West", "Oval Bezel North/South", "Cushion Half Bezel", "Fancy Mix Bezel", "Pear Bezel East/West"]) expect(vals).toContain(v);
  });
});

describe("findShapeBase", () => {
  it("finds the shape for every listed choice", () => {
    for (const [base, variants] of Object.entries(DIAMOND_SHAPES)) for (const v of variants) expect(findShapeBase(v.value)).toBe(base);
  });
  it("is empty for nothing and for unknown text", () => {
    expect(findShapeBase("")).toBeNull();
    expect(findShapeBase(null)).toBeNull();
    expect(findShapeBase("Heart")).toBeNull();
    expect(findShapeBase("Ovalish")).toBeNull();
  });
  it("still recognises the values already in the Vinere workbook", () => {
    const old = ["Round", "Fancy Mix", "Emerald", "Oval", "Pear North/South", "Emerald Bezel North/South", "Emerald North/South", "Pear East/West",
      "Oval Bezel North/South", "Emerald Bezel", "Pear", "Radiant North/South", "Oval North/South", "Fancy Mix Bezel"];
    for (const v of old) expect(findShapeBase(v), v).not.toBeNull();
    expect(findShapeBase("Emerald Bezel")).toBe("Emerald");
    expect(findShapeBase("Oval")).toBe("Oval");
  });
});

describe("shapeVariants", () => {
  it("lists a shape's styles", () => {
    expect(shapeVariants("Round", "").map((v) => v.label)).toEqual(["Standard", "Bezel"]);
    expect(shapeVariants("Cushion", "Cushion").map((v) => v.label)).toEqual(["Standard", "Bezel", "Half Bezel"]);
  });
  it("keeps an old value that is not on the list as an extra choice, so nothing is lost", () => {
    const list = shapeVariants("Oval", "Oval");
    expect(list).toHaveLength(5);
    expect(list.at(-1)).toEqual({ value: "Oval", label: "As entered: Oval" });
    expect(shapeVariants("Oval", "Oval North/South")).toHaveLength(4);
  });
  it("shows unknown text as its own choice under Other", () => {
    expect(shapeVariants("Other", "Heart")).toEqual([{ value: "Heart", label: "Heart" }]);
  });
});
