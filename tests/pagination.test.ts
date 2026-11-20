import { describe, expect, it } from "vitest";
import { pageWindow } from "@/lib/pagination";

describe("pageWindow", () => {
  it("shows everything when there are few pages", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("keeps first and last and hides the middle with …", () => {
    expect(pageWindow(1, 11)).toEqual([1, 2, 3, "…", 11]);
    expect(pageWindow(6, 11)).toEqual([1, "…", 4, 5, 6, 7, 8, "…", 11]);
    expect(pageWindow(11, 11)).toEqual([1, "…", 9, 10, 11]);
  });
  it("fills a gap of one page instead of showing …", () => {
    expect(pageWindow(5, 20)).toEqual([1, 2, 3, 4, 5, 6, 7, "…", 20]);
  });
});
