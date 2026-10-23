import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";
import { buildQuery, cleanSearch, detectFileType, parsePage, parseSort } from "@/lib/inventory";
import { adjustSchema, productSchema } from "@/lib/validation";
import { can } from "@/lib/permissions";

const base = {
  sku: "R-001", barcode: "", name: "Ring", description: "", category: "Rings", collection: "", metal_type: "gold" as const,
  purity: "18K", gross_weight_g: "4.2", net_metal_weight_g: "3.9", tracking: "individual" as const, retail_price: "85000",
  hsn_code: "", gst_rate: "", low_stock_threshold: "0", stones: [],
};

describe("product validation", () => {
  it("accepts a normal product", () => expect(productSchema.safeParse(base).success).toBe(true));
  it("rejects spaces and odd characters in SKU", () => {
    expect(productSchema.safeParse({ ...base, sku: "R 001" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, sku: "<script>" }).success).toBe(false);
  });
  it("rejects net weight above gross weight", () =>
    expect(productSchema.safeParse({ ...base, net_metal_weight_g: "9" }).success).toBe(false));
  it("rejects bad numbers", () => {
    expect(productSchema.safeParse({ ...base, retail_price: "-5" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, retail_price: "1e5" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, retail_price: "12.345" }).success).toBe(false);
  });
  it("requires a stone type when a stone is added", () => {
    const stone = { stone_type: "", shape: "", cut: "", colour: "", clarity: "", carat_weight: "", length_mm: "", width_mm: "", depth_mm: "", origin: "", treatment: "", piece_count: "1" };
    expect(productSchema.safeParse({ ...base, stones: [stone] }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, stones: [{ ...stone, stone_type: "Ruby", carat_weight: "0.25" }] }).success).toBe(true);
  });
  it("requires a reason and whole number for stock corrections", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(adjustSchema.safeParse({ productId: id, locationId: id, delta: "-2", reason: "Damaged" }).success).toBe(true);
    expect(adjustSchema.safeParse({ productId: id, locationId: id, delta: "0", reason: "Damaged" }).success).toBe(false);
    expect(adjustSchema.safeParse({ productId: id, locationId: id, delta: "1.5", reason: "Damaged" }).success).toBe(false);
    expect(adjustSchema.safeParse({ productId: id, locationId: id, delta: "1", reason: "" }).success).toBe(false);
  });
});

describe("inventory permissions", () => {
  it("keeps costs, adjustments and archiving owner-only", () => {
    for (const p of ["costs.view", "stock.adjust", "products.archive", "locations.manage"] as const) {
      expect(can("owner", p)).toBe(true);
      expect(can("staff", p)).toBe(false);
      expect(can("seller", p)).toBe(false);
    }
  });
  it("lets staff work with inventory but not sellers", () => {
    expect(can("staff", "inventory.edit")).toBe(true);
    expect(can("seller", "inventory.view")).toBe(false);
  });
});

describe("CSV export", () => {
  it("escapes commas, quotes and line breaks", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toContain("'=");
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe("-5");
  });
  it("builds rows", () => expect(toCsv([["a", "b"], [1, null]])).toBe("a,b\r\n1,\r\n"));
});

describe("list helpers", () => {
  it("cleans search text", () => {
    expect(cleanSearch("ring),name.eq.x")).not.toMatch(/[(),]/);
    expect(cleanSearch("  gold   chain ")).toBe("gold chain");
    expect(cleanSearch("x".repeat(200)).length).toBe(80);
  });
  it("only allows known sort columns and sane pages", () => {
    expect(parseSort("name")).toBe("name");
    expect(parseSort("password; drop table")).toBe("created_at");
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("4")).toBe(4);
  });
  it("builds links without empty values", () => expect(buildQuery({ q: "ring", page: undefined, low: "1" })).toBe("?q=ring&low=1"));
});

describe("uploaded file checks", () => {
  it("recognises real file types by content, not by name", () => {
    expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(detectFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("pdf");
    expect(detectFileType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("MZ executable"))).toBeNull();
  });
});
