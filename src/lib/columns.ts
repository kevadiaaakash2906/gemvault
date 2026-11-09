/** The columns of the Orders and Trading tables that a person can hide. The key matches the data-col marker on the table. */
export type TableKey = "orders" | "trading";
export type ColumnDef = { key: string; label: string; ownerOnly?: boolean; locked?: boolean };

export const COLUMNS: Record<TableKey, ColumnDef[]> = {
  orders: [
    { key: "photo", label: "Photo" }, { key: "sr_no", label: "Sr. No.", locked: true }, { key: "customer", label: "Customer" },
    { key: "style_no", label: "Style No." }, { key: "jewelry_type", label: "Jewelry Type" }, { key: "diamond_shape", label: "Diamond Shape" },
    { key: "order_date", label: "Date" }, { key: "gross_wt", label: "Gross Wt" }, { key: "dia_qty", label: "Dia Qty" }, { key: "in_ct", label: "IN CT" },
    { key: "colour_stone", label: "Colour Stone" }, { key: "net_wt", label: "Net Wt" }, { key: "multiplier", label: "Multiplier" }, { key: "pg_wt", label: "Pg Wt" },
    { key: "gold_amount", label: "Gold Amount", ownerOnly: true }, { key: "diam_amount", label: "Diam Amount", ownerOnly: true },
    { key: "l_charges", label: "L Charges", ownerOnly: true }, { key: "labor_amount", label: "Labor Amount", ownerOnly: true },
    { key: "sub_total", label: "Sub Total", ownerOnly: true }, { key: "usd_cost", label: "$ (cost)", ownerOnly: true },
    { key: "sold_to", label: "Sold To" }, { key: "sale_price", label: "Sale Price" }, { key: "date_sold", label: "Date Sold" }, { key: "memo", label: "Memo" },
    { key: "memo_paid", label: "Memo Paid" }, { key: "memo_balance", label: "Memo Balance" }, { key: "payment_status", label: "Payment Status" },
  ],
  trading: [
    { key: "sr_no", label: "Sr. No.", locked: true }, { key: "trade_date", label: "Date" }, { key: "item", label: "Item" },
    { key: "vendor", label: "Vendor", ownerOnly: true }, { key: "purchase_price", label: "Purchase Price", ownerOnly: true },
    { key: "sale_price", label: "Sale Price" }, { key: "date_sold", label: "Date Sold" }, { key: "sold_to", label: "Sold To" }, { key: "memo", label: "Memo" },
    { key: "memo_paid", label: "Memo Paid" }, { key: "memo_balance", label: "Memo Balance" }, { key: "payment_status", label: "Payment Status" },
    { key: "profit", label: "Profit/Loss", ownerOnly: true }, { key: "notes", label: "Notes" },
  ],
};

/** Keeps only real, hideable column keys (anything else, including the locked Sr. No., is dropped). */
export function sanitizeHidden(table: TableKey, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(COLUMNS[table].filter((c) => !c.locked).map((c) => c.key));
  return [...new Set(value.filter((v): v is string => typeof v === "string" && allowed.has(v)))];
}

/** CSS that hides the chosen columns. Keys come from the fixed list above, so they are safe to put in a stylesheet. */
export function hiddenCss(table: TableKey, hidden: string[]): string {
  return hidden.map((k) => `table[data-table="${table}"] [data-col="${k}"]{display:none}`).join("");
}
