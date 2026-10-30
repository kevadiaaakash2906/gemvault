import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiamondShapePicker } from "@/components/diamond-shape-picker";

const html = (value: string) => renderToStaticMarkup(createElement(DiamondShapePicker, { id: "diamond_shape", value, onChange: () => {} }));
const options = (markup: string, id: string) => {
  const sel = new RegExp(`<select id="${id}"[^>]*>(.*?)</select>`).exec(markup)?.[1] ?? "";
  return [...sel.matchAll(/<option value="([^"]*)"( selected="")?>([^<]*)<\/option>/g)].map((m) => ({ value: m[1], selected: !!m[2], label: m[3] }));
};

describe("DiamondShapePicker", () => {
  it("starts empty with the Style box waiting for a Shape", () => {
    const m = html("");
    expect(options(m, "diamond_shape-shape")).toHaveLength(9);                 // placeholder + 8 shapes
    expect(options(m, "diamond_shape-style").map((o) => o.label)).toEqual(["Select shape first…"]);
    expect(m).toMatch(/<select id="diamond_shape-style"[^>]*disabled=""/);
  });
  it("shows a saved value as its Shape and Style", () => {
    const m = html("Oval Bezel North/South");
    expect(options(m, "diamond_shape-shape").find((o) => o.selected)?.value).toBe("Oval");
    const style = options(m, "diamond_shape-style");
    expect(style.map((o) => o.label)).toEqual(["Select style…", "East/West", "North/South", "Bezel East/West", "Bezel North/South"]);
    expect(style.find((o) => o.selected)?.value).toBe("Oval Bezel North/South");
    expect(m).not.toMatch(/<select id="diamond_shape-style"[^>]*disabled=""/);
  });
  it("keeps an old value like plain 'Oval' selectable", () => {
    const style = options(html("Oval"), "diamond_shape-style");
    expect(style.find((o) => o.selected)).toEqual({ value: "Oval", selected: true, label: "As entered: Oval" });
  });
  it("keeps unknown text under Other so it is never lost", () => {
    const m = html("Heart");
    expect(options(m, "diamond_shape-shape").find((o) => o.selected)?.value).toBe("Other");
    expect(options(m, "diamond_shape-style").find((o) => o.selected)?.value).toBe("Heart");
  });
});
