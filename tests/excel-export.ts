import ExcelJS from "exceljs";

/**
 * Builds the Excel download in the same layout as the VINERELEDGER workbook:
 * three tabs (Orders, Trading, Expenses), two empty rows on top, headers on row 3, data from row 4,
 * the same columns in the same order, the same date formats, and the Trading profit formula.
 */
export type Rec = Record<string, unknown>;
export type ExportData = {
  orders: Rec[]; orderCosts: Rec[]; trades: Rec[]; tradeCosts: Rec[]; expenses: Rec[]; payments: Rec[];
  show: { orders: boolean; trading: boolean; expenses: boolean; costs: boolean };
  active?: "orders" | "trading" | "expenses";
};

type Cell = string | number | boolean | Date | null | ExcelJS.CellFormulaValue;

const HEADER_ROW = 3;
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const text = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === "" ? null : String(v));
/** "2026-08-26" becomes a real Excel date (UTC midnight, so the day never shifts). */
const date = (v: unknown): Date | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.slice(0, 10) + "T00:00:00Z") : null);
const memoCell = (v: unknown): number | string | null => (/^\d+$/.test(String(v ?? "")) ? Number(v) : text(v));

export const ORDER_HEADERS = ["Sr. No.", "CUSTOMER ", "Style No.", "Jewelry Type", "Diamond Shape", "Date", "Gross Wt", "Dia Qty", "IN CT", "COLOUR STONE", "Net Wt", "Multiplier", "Pg Wt",
  "Gold Amount", "Diam Amount", "L CHARGES", "LABOR AMOUNT", "SUB TOTAL", "$", "Sold To", "Sale Price", "Date Sold", "Amount Paid", "Balance Due", "Payment Status", "Payment Log", "memo"];
export const TRADING_HEADERS = ["Sr. No.", "Date", "Item", "Vendor", "Purchase Price", "Sale Price", "Date Sold", "Sold To", "Amount Paid", "Balance Due", "Payment Status", "Payment Log", "Profit/Loss", "Notes", "memo"];
export const EXPENSE_HEADERS = ["Sr. No.", "Date", "Category", "Description", "Amount", "Seller", "Notes"];

/** Column widths of the Orders tab in your workbook (columns not listed keep Excel's default). */
const ORDER_WIDTHS: Record<number, number> = { 1: 6, 2: 31, 3: 16, 4: 12, 5: 12, 6: 12, 7: 9.01, 8: 8, 9: 8, 10: 10, 11: 9.01, 12: 10, 13: 8, 14: 12, 15: 12, 16: 20, 17: 12, 18: 15.1, 19: 20.6, 20: 20, 21: 12, 22: 12, 23: 12, 24: 18.1, 25: 14, 26: 30, 27: 8.7 };

function putRow(ws: ExcelJS.Worksheet, rowNumber: number, values: Cell[], formats: Record<number, string> = {}) {
  const row = ws.getRow(rowNumber);
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v as ExcelJS.CellValue;
    if (formats[i + 1] && v !== null) cell.numFmt = formats[i + 1];
  });
  row.commit();
}

function putHeaders(ws: ExcelJS.Worksheet, headers: string[], styled: boolean) {
  const row = ws.getRow(HEADER_ROW);
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    if (styled) {
      cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A4A4A" } };
      cell.alignment = { horizontal: "center" };
      const thin = { style: "thin" as const };
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
    }
  });
  row.commit();
}

export function buildLedgerWorkbook(d: ExportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vinere";
  const costOf = (rows: Rec[], key: string) => new Map(rows.map((c) => [String(c[key]), c]));
  const orderCosts = costOf(d.orderCosts, "order_id");
  const tradeCosts = costOf(d.tradeCosts, "trade_id");

  // Payments are kept per memo; the sheet shows them as a JSON list repeated on every row of the memo.
  const log = new Map<string, { amount: number; date: string }[]>();
  [...d.payments].sort((a, b) => String(a.paid_on).localeCompare(String(b.paid_on)) || String(a.created_at).localeCompare(String(b.created_at))).forEach((p) => {
    const list = log.get(String(p.memo_no)) ?? [];
    list.push({ amount: Number(p.amount), date: String(p.paid_on).slice(0, 10) });
    log.set(String(p.memo_no), list);
  });
  const logText = (memo: unknown) => JSON.stringify(log.get(String(memo)) ?? []);
  // Amount Paid / Balance Due are shown once per memo (on its first row) so column totals are not counted twice.
  // A memo that has orders shows them on its first order row; trades in that memo leave them empty.
  const memosWithOrders = new Set(d.orders.filter((o) => o.memo_no).map((o) => String(o.memo_no)));
  const shown = new Set<string>();
  const first = (memo: unknown) => { const k = String(memo ?? ""); if (!k || shown.has(k)) return false; shown.add(k); return true; };

  const sheets: Record<string, ExcelJS.Worksheet> = {};

  if (d.show.orders) {
    const ws = (sheets.orders = wb.addWorksheet("Orders", { views: [{ state: "frozen", ySplit: HEADER_ROW }] }));
    Object.entries(ORDER_WIDTHS).forEach(([c, w]) => { ws.getColumn(Number(c)).width = w; });
    putHeaders(ws, ORDER_HEADERS, true);
    d.orders.forEach((o, i) => {
      const c = orderCosts.get(String(o.id));
      const c$ = (k: string) => (d.show.costs ? num(c?.[k]) : null);
      const sold = o.sale_price !== null && o.sale_price !== undefined;
      const money = sold && first(o.memo_no);
      putRow(ws, HEADER_ROW + 1 + i, [
        num(o.sr_no), text(o.customer), text(o.style_no), text(o.jewelry_type), text(o.diamond_shape), date(o.order_date), num(o.gross_wt), num(o.dia_qty), num(o.in_ct), num(o.colour_stone),
        num(o.net_wt), num(o.multiplier), num(o.pg_wt), c$("gold_amount"), c$("diam_amount"), c$("l_charges"), c$("labor_amount"), c$("sub_total"), c$("usd_cost"),
        sold ? text(o.sold_to) : null, sold ? num(o.sale_price) : null, sold ? date(o.date_sold) : null,
        money ? num(o.memo_paid) : null, money ? num(o.memo_balance) : null,
        sold ? text(o.payment_status) : "Not Sold", sold ? logText(o.memo_no) : "[]", sold ? memoCell(o.memo_no) : null,
      ], { 6: "yyyy-mm-dd", 22: "M/d/yyyy" });
      ws.getRow(HEADER_ROW + 1 + i).height = 15.75;
    });
  }

  if (d.show.trading) {
    const ws = (sheets.trading = wb.addWorksheet("Trading"));
    putHeaders(ws, TRADING_HEADERS, false);
    d.trades.forEach((t, i) => {
      const r = HEADER_ROW + 1 + i;
      const c = tradeCosts.get(String(t.id));
      const sold = t.sale_price !== null && t.sale_price !== undefined;
      const purchase = d.show.costs ? num(c?.purchase_price) : null;
      const money = sold && !memosWithOrders.has(String(t.memo_no)) && first(t.memo_no);
      const profit = sold && purchase !== null ? Math.round((Number(t.sale_price) - purchase) * 100) / 100 : "";
      putRow(ws, r, [
        num(t.sr_no), date(t.trade_date), text(t.item), d.show.costs ? text(c?.vendor) : null, purchase, sold ? num(t.sale_price) : null, sold ? date(t.date_sold) : null, sold ? text(t.sold_to) : null,
        money ? num(t.memo_paid) : null, money ? num(t.memo_balance) : null, sold ? text(t.payment_status) : "Not Sold", sold ? logText(t.memo_no) : "[]",
        { formula: `IF(AND(F${r}<>"",E${r}<>""),F${r}-E${r},"")`, result: profit } as ExcelJS.CellFormulaValue,
        text(t.notes), sold ? memoCell(t.memo_no) : null,
      ], { 2: "yyyy-mm-dd", 7: "yyyy-mm-dd" });
    });
  }

  if (d.show.expenses) {
    const ws = (sheets.expenses = wb.addWorksheet("Expenses"));
    putHeaders(ws, EXPENSE_HEADERS, false);
    d.expenses.forEach((e, i) => {
      putRow(ws, HEADER_ROW + 1 + i, [num(e.sr_no), date(e.expense_date), text(e.category), text(e.description), num(e.amount), text(e.seller), text(e.notes)], { 2: "yyyy-mm-dd" });
    });
    if (d.expenses.length > 0) {
      const last = HEADER_ROW + d.expenses.length;
      const total = d.expenses.reduce((s, e) => s + (num(e.amount) ?? 0), 0);
      const row = ws.getRow(last + 1);
      row.getCell(1).value = "total";
      row.getCell(5).value = { formula: `SUM(E${HEADER_ROW + 1}:E${last})`, result: Math.round(total * 100) / 100 };
      row.commit();
    }
  }

  const active = d.active && sheets[d.active] ? d.active : null;
  if (active) wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: wb.worksheets.indexOf(sheets[active]), visibility: "visible" }];
  return wb;
}
