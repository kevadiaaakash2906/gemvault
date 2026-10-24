import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";
import { buildQuery, cleanSearch, computeCosts, parsePage, pickSort } from "@/lib/ledger";
import { expenseSchema, orderSchema, paymentSchema, ratesSchema, tradeSchema } from "@/lib/validation";
import { can } from "@/lib/permissions";

const order = {
  customer: "HET", style_no: "BR-100", jewelry_type: "Bracelet", diamond_shape: "Round", order_date: "2026-06-10", gross_wt: "7.026", dia_qty: "60",
  in_ct: "5.15", colour_stone: "0", net_wt: "5.996", multiplier: "0.595", sold_to: "", memo_no: "", sale_price: "", date_sold: "",
};

describe("cost arithmetic matches the Excel sheet", () => {
  it("bracelet row: gold 60,650, labour 5,396, sub total 99,521, $1,058.73", () => {
    const r = computeCosts({ net: 5.996, multiplier: 0.595, goldRate: 17000, diamAmount: 33475, lCharges: 900, flatLabor: false, usdRate: 94 });
    expect(r).toMatchObject({ pg: 3.568, gold: 60650, labor: 5396, sub: 99521, usd: 1058.73 });
  });
  it("earring row with flat labour: sub total 27,731, $295.01", () => {
    const r = computeCosts({ net: 1.477, multiplier: 0.595, goldRate: 16000, diamAmount: 12170, lCharges: 1500, flatLabor: true, usdRate: 94 });
    expect(r).toMatchObject({ gold: 14061, labor: 1500, sub: 27731, usd: 295.01 });
  });
});

describe("order validation", () => {
  it("accepts an unsold order", () => expect(orderSchema.safeParse(order).success).toBe(true));
  it("accepts a complete sale", () => expect(orderSchema.safeParse({ ...order, sold_to: "CALI", memo_no: "12", sale_price: "1000" }).success).toBe(true));
  it("rejects a half-filled sale", () => {
    expect(orderSchema.safeParse({ ...order, sold_to: "CALI" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, sale_price: "100" }).success).toBe(false);
  });
  it("rejects net weight above gross, bad numbers and bad memo numbers", () => {
    expect(orderSchema.safeParse({ ...order, net_wt: "9" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, gross_wt: "-1" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, multiplier: "1.5" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, sold_to: "A", memo_no: "<b>", sale_price: "1" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, style_no: "" }).success).toBe(false);
  });
});

describe("other forms", () => {
  it("trade needs an item and a complete sale", () => {
    const t = { trade_date: "2026-08-08", item: "Ring", notes: "", sold_to: "", memo_no: "", sale_price: "", date_sold: "" };
    expect(tradeSchema.safeParse(t).success).toBe(true);
    expect(tradeSchema.safeParse({ ...t, item: "" }).success).toBe(false);
    expect(tradeSchema.safeParse({ ...t, memo_no: "5" }).success).toBe(false);
  });
  it("expense needs a date, category, description and amount", () => {
    const e = { expense_date: "2026-09-06", category: "Travel", description: "Flight", amount: "379.83", seller: "", notes: "" };
    expect(expenseSchema.safeParse(e).success).toBe(true);
    expect(expenseSchema.safeParse({ ...e, amount: "-5" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...e, amount: "1.234" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...e, expense_date: "" }).success).toBe(false);
  });
  it("payments must be above zero", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(paymentSchema.safeParse({ memoId: id, amount: "50.5", paidOn: "2026-10-01" }).success).toBe(true);
    expect(paymentSchema.safeParse({ memoId: id, amount: "0", paidOn: "2026-10-01" }).success).toBe(false);
    expect(paymentSchema.safeParse({ memoId: id, amount: "-3", paidOn: "2026-10-01" }).success).toBe(false);
  });
  it("rates must be positive", () => {
    expect(ratesSchema.safeParse({ gold_rate: "17000", usd_rate: "94", default_multiplier: "0.595", default_labor: "900" }).success).toBe(true);
    expect(ratesSchema.safeParse({ gold_rate: "0", usd_rate: "94", default_multiplier: "0.595", default_labor: "900" }).success).toBe(false);
  });
});

describe("who can do what", () => {
  it("keeps costs, expenses, rates, cancelling payments and deleting owner-only", () => {
    for (const p of ["costs.view", "expenses.manage", "settings.edit", "payments.void", "records.delete"] as const) {
      expect(can("owner", p)).toBe(true);
      expect(can("staff", p)).toBe(false);
      expect(can("seller", p)).toBe(false);
    }
  });
  it("lets staff work with orders, trades and payments but not sellers", () => {
    for (const p of ["orders.edit", "trades.edit", "payments.record", "memos.view"] as const) {
      expect(can("staff", p)).toBe(true);
      expect(can("seller", p)).toBe(false);
    }
  });
});

describe("helpers", () => {
  it("csv escapes and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(toCsv([["a"], [1]])).toBe("a\r\n1\r\n");
  });
  it("search, sort and page helpers are safe", () => {
    expect(cleanSearch("x),sale_price.gt.0")).not.toMatch(/[(),]/);
    expect(pickSort("evil", ["sr_no", "style_no"] as const, "sr_no")).toBe("sr_no");
    expect(parsePage("-1")).toBe(1);
    expect(buildQuery({ q: "a", page: undefined })).toBe("?q=a");
  });
});
