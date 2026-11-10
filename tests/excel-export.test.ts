import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { EXPENSE_HEADERS, ORDER_HEADERS, TRADING_HEADERS, buildLedgerWorkbook, type ExportData } from "@/lib/excel-export";

const data = (over: Partial<ExportData> = {}): ExportData => ({
  orders: [
    { id: "o1", sr_no: 1, customer: "HET", style_no: "CLBR-1", jewelry_type: "Bracelet", diamond_shape: "Round", order_date: "2026-06-03", gross_wt: 7.02, dia_qty: 35, in_ct: 5.15, colour_stone: 0, net_wt: 5.996, multiplier: 0.595, pg_wt: 3.568,
      sold_to: "ACME", sale_price: 1300, date_sold: "2026-08-26", memo_no: "31", memo_paid: 1300, memo_balance: 0, payment_status: "Paid" },
    { id: "o2", sr_no: 2, customer: "HET", style_no: "CLBR-2", jewelry_type: "Ring", order_date: "2026-06-04", net_wt: 3, multiplier: 0.595, pg_wt: 1.8,
      sold_to: "ACME", sale_price: 700, date_sold: "2026-08-27", memo_no: "31", memo_paid: 1300, memo_balance: 700, payment_status: "Partial" },
    { id: "o3", sr_no: 3, style_no: "=HYPERLINK(1)", sold_to: null, sale_price: null, memo_no: null, payment_status: "Not Sold" },
  ],
  orderCosts: [{ order_id: "o1", gold_amount: 60650, diam_amount: 33475, l_charges: 900, labor_amount: 5396, sub_total: 99521, usd_cost: 1058.73 }],
  trades: [
    { id: "t1", sr_no: 1, trade_date: "2026-08-08", item: "BAND", sold_to: "ZED", sale_price: 2880, date_sold: "2026-07-24", memo_no: "119", memo_paid: 0, memo_balance: 2880, payment_status: "Unpaid", notes: "n1" },
    { id: "t2", sr_no: 2, trade_date: "2026-08-20", item: "SHARED", sold_to: "ACME", sale_price: 600, date_sold: "2026-08-20", memo_no: "31", memo_paid: 1300, memo_balance: 700, payment_status: "Partial" },
    { id: "t3", sr_no: 3, trade_date: "2026-08-21", item: "UNSOLD", sale_price: null, memo_no: null },
  ],
  tradeCosts: [{ trade_id: "t1", vendor: "CARAT", purchase_price: 2495.9 }, { trade_id: "t2", vendor: "V", purchase_price: 500 }, { trade_id: "t3", vendor: "V", purchase_price: 90 }],
  expenses: [{ sr_no: 1, expense_date: "2026-09-06", category: "Travel", description: "FLIGHT", amount: 379.83, seller: "MIAMI", notes: "TRIP" }, { sr_no: 2, expense_date: "2026-09-07", category: "Office", description: "PAPER", amount: 20.17, seller: null, notes: null }],
  payments: [
    { memo_no: "31", amount: 1000, paid_on: "2026-10-03", created_at: "2026-10-03T10:00:00Z" },
    { memo_no: "31", amount: 300, paid_on: "2026-08-26", created_at: "2026-08-26T10:00:00Z" },
  ],
  show: { orders: true, trading: true, expenses: true, costs: true },
  ...over,
});

async function roundTrip(d: ExportData) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildLedgerWorkbook(d).xlsx.writeBuffer());
  return wb;
}

describe("Excel download, laid out like the VINERELEDGER workbook", () => {
  it("has the three tabs with two empty rows on top and headers on row 3", async () => {
    const wb = await roundTrip(data());
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Orders", "Trading", "Expenses"]);
    for (const [name, headers] of [["Orders", ORDER_HEADERS], ["Trading", TRADING_HEADERS], ["Expenses", EXPENSE_HEADERS]] as const) {
      const ws = wb.getWorksheet(name)!;
      expect(ws.getRow(1).values).toEqual([]);
      expect(ws.getRow(2).values).toEqual([]);
      expect(headers.map((_, i) => ws.getRow(3).getCell(i + 1).value)).toEqual(headers);
    }
    expect(ORDER_HEADERS).toHaveLength(27);
    expect(ORDER_HEADERS[1]).toBe("CUSTOMER ");        // the trailing space your sheet has
    expect(ORDER_HEADERS.at(-1)).toBe("memo");
  });

  it("styles and freezes the Orders header like your sheet", async () => {
    const ws = (await roundTrip(data())).getWorksheet("Orders")!;
    const h = ws.getCell("A3");
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 3 });
    expect(h.font).toMatchObject({ name: "Arial", bold: true });
    expect(h.fill).toMatchObject({ fgColor: { argb: "FF4A4A4A" } });
    expect(h.alignment?.horizontal).toBe("center");
    expect(ws.getColumn(2).width).toBe(31);
    expect(ws.getColumn(26).width).toBe(30);
  });

  it("writes real dates with your formats and real numbers", async () => {
    const ws = (await roundTrip(data())).getWorksheet("Orders")!;
    expect(ws.getCell("F4").value).toEqual(new Date("2026-06-03T00:00:00Z"));
    expect(ws.getCell("F4").numFmt).toBe("yyyy-mm-dd");
    expect(ws.getCell("V4").numFmt).toBe("M/d/yyyy");
    expect(ws.getCell("U4").value).toBe(1300);
    expect(ws.getCell("S4").value).toBe(1058.73);
    expect(ws.getCell("AA4").value).toBe(31);          // memo is a number, as in your sheet
  });

  it("shows the payment list on every row of the memo, in date order, but Amount Paid and Balance Due once", async () => {
    const ws = (await roundTrip(data())).getWorksheet("Orders")!;
    const log = '[{"amount":300,"date":"2026-08-26"},{"amount":1000,"date":"2026-10-03"}]';
    expect(ws.getCell("Z4").value).toBe(log);
    expect(ws.getCell("Z5").value).toBe(log);
    expect([ws.getCell("W4").value, ws.getCell("X4").value]).toEqual([1300, 0]);
    expect([ws.getCell("W5").value, ws.getCell("X5").value]).toEqual([null, null]);
  });

  it("marks unsold pieces the way your sheet does", async () => {
    const ws = (await roundTrip(data())).getWorksheet("Orders")!;
    expect(ws.getCell("Y6").value).toBe("Not Sold");
    expect(ws.getCell("Z6").value).toBe("[]");
    expect(ws.getCell("T6").value).toBeNull();
  });

  it("keeps text that starts with = as plain text, never a formula", async () => {
    const ws = (await roundTrip(data())).getWorksheet("Orders")!;
    expect(ws.getCell("C6").value).toBe("=HYPERLINK(1)");
    expect(ws.getCell("C6").type).toBe(ExcelJS.ValueType.String);
  });

  it("keeps the Trading profit formula and adds the memo column", async () => {
    const ws = (await roundTrip(data())).getWorksheet("Trading")!;
    expect(ws.getCell("M4").value).toMatchObject({ formula: 'IF(AND(F4<>"",E4<>""),F4-E4,"")', result: 384.1 });
    const unsold = ws.getCell("M6").value as ExcelJS.CellFormulaValue;                // unsold: shows nothing, like your sheet
    expect(unsold.formula).toContain("F6");
    expect(unsold.result ?? "").toBe("");
    expect(ws.getCell("O4").value).toBe(119);
    expect(ws.getCell("B4").numFmt).toBe("yyyy-mm-dd");
    expect(ws.getCell("L4").value).toBe("[]");
  });

  it("does not count a shared memo's money twice (trades leave it to the orders)", async () => {
    const ws = (await roundTrip(data())).getWorksheet("Trading")!;
    expect([ws.getCell("I5").value, ws.getCell("J5").value]).toEqual([null, null]);
    expect(ws.getCell("L5").value).toContain('"amount":300');                      // the payments still show
    expect([ws.getCell("I4").value, ws.getCell("J4").value]).toEqual([0, 2880]);    // a trade-only memo shows its own money once
  });

  it("totals the expenses with a working formula", async () => {
    const ws = (await roundTrip(data())).getWorksheet("Expenses")!;
    expect(ws.getCell("A6").value).toBe("total");
    expect(ws.getCell("E6").value).toMatchObject({ formula: "SUM(E4:E5)", result: 400 });
    expect(ws.getCell("G4").value).toBe("TRIP");
  });

  it("leaves cost columns empty when the person may not see costs, and leaves out tabs they may not see", async () => {
    const wb = await roundTrip(data({ show: { orders: true, trading: true, expenses: false, costs: false } }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Orders", "Trading"]);
    const o = wb.getWorksheet("Orders")!;
    expect(o.getCell("N4").value).toBeNull();
    expect(o.getCell("S4").value).toBeNull();
    expect(wb.getWorksheet("Trading")!.getCell("D4").value).toBeNull();
    expect(wb.getWorksheet("Trading")!.getCell("E4").value).toBeNull();
  });

  it("opens on the tab the person came from", async () => {
    const wb = await roundTrip(data({ active: "trading" }));
    expect(wb.views[0].activeTab).toBe(1);
  });
});
