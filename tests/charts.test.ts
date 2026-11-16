import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SalesProfitChart, TopBars, shortMonth } from "@/components/charts";

describe("charts", () => {
  it("shortens month labels", () => {
    expect(shortMonth("2026-08-01")).toBe("Aug ’26");
  });
  it("draws two bars per month and marks a loss in red", () => {
    const html = renderToStaticMarkup(createElement(SalesProfitChart, {
      label: "Sales and net profit by month",
      data: [{ label: "Aug ’26", sales: 2400, profit: 441.27 }, { label: "Sep ’26", sales: 3300, profit: -50 }],
    }));
    expect(html).toContain("Aug ’26");
    expect(html.match(/<rect/g)).toHaveLength(4);
    expect(html).toContain("fill-danger");
    expect(html).toContain("fill-forest");
  });
  it("says so when there is nothing to draw", () => {
    expect(renderToStaticMarkup(createElement(SalesProfitChart, { label: "x", data: [] }))).toContain("No sales yet.");
    expect(renderToStaticMarkup(createElement(TopBars, { rows: [] }))).toContain("No sales yet.");
  });
  it("lists top buyers with their amounts", () => {
    const html = renderToStaticMarkup(createElement(TopBars, { rows: [{ key: "a", name: "ALPHA", value: 1200, note: "Profit $300.00" }, { key: "b", name: "BETA", value: 600 }] }));
    expect(html).toContain("ALPHA");
    expect(html).toContain("$1,200.00");
    expect(html).toContain("Profit $300.00");
  });
});
