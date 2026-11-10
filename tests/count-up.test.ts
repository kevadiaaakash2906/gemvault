import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountUp } from "@/components/count-up";

const html = (value: string) => renderToStaticMarkup(createElement(CountUp, { value }));

describe("CountUp on the page as first sent", () => {
  it("contains the real figure, so nothing is lost if scripts never run", () => {
    expect(html("$35,048.59")).toContain("$35,048.59");
    expect(html("+$1,234.50")).toContain("+$1,234.50");
    expect(html("18.6%")).toContain("18.6%");
  });
  it("hides a figure only for the instant before it counts (the stylesheet reveals it anyway)", () => {
    expect(html("$35,048.59")).toContain("countup-pending");
  });
  it("shows plain text such as Travel or a dash as it is, never hidden", () => {
    for (const v of ["Travel", "—", "Not sold"]) {
      const m = html(v);
      expect(m).toContain(v);
      expect(m).not.toContain("countup-pending");
    }
  });
});
