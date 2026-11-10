import { describe, expect, it } from "vitest";
import { formatFigure, parseFigure } from "@/lib/figure";

describe("count-up figures", () => {
  it("splits money with a sign and decimals", () => {
    expect(parseFigure("+$35,048.59")).toEqual({ prefix: "+$", target: 35048.59, places: 2, suffix: "" });
    expect(parseFigure("-$1,200.00")).toEqual({ prefix: "-$", target: 1200, places: 2, suffix: "" });
  });
  it("handles plain counts and ignores words", () => {
    expect(parseFigure("122")).toEqual({ prefix: "", target: 122, places: 0, suffix: "" });
    expect(parseFigure("Not sold")).toBeNull();
  });
  it("rebuilds the text at any step, keeping the original shape", () => {
    const f = parseFigure("$171,487.07")!;
    expect(formatFigure(f, 0)).toBe("$0.00");
    expect(formatFigure(f, f.target)).toBe("$171,487.07");
    expect(formatFigure(parseFigure("122")!, 61)).toBe("61");
  });
});
