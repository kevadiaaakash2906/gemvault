import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

type Cell = string | number | boolean | null | undefined;

async function allRows(supabase: Awaited<ReturnType<typeof createClient>>, table: string, order: string) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").order(order).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

export async function GET(request: Request) {
  const session = await getSession();
  const sheet = new URL(request.url).searchParams.get("sheet");
  if (!session?.role) return new NextResponse("Not allowed", { status: 403 });
  const owner = can(session.role, "costs.view");
  const supabase = await createClient();
  let rows: Cell[][];

  try {
    if (sheet === "orders" && can(session.role, "orders.view")) {
      const [orders, costs] = await Promise.all([allRows(supabase, "order_overview", "sr_no"), owner ? allRows(supabase, "order_costs", "order_id") : Promise.resolve([])]);
      const cm = new Map(costs.map((c) => [c.order_id as string, c]));
      const head: Cell[] = ["Sr. No.", "CUSTOMER", "Style No.", "Jewelry Type", "Diamond Shape", "Date", "Gross Wt", "Dia Qty", "IN CT", "COLOUR STONE", "Net Wt", "Multiplier", "Pg Wt"];
      if (owner) head.push("Gold Amount", "Diam Amount", "L CHARGES", "LABOR AMOUNT", "SUB TOTAL", "$");
      head.push("Sold To", "Sale Price", "Date Sold", "memo", "Memo Paid", "Memo Balance", "Payment Status");
      rows = [head, ...orders.map((o) => {
        const c = cm.get(o.id as string);
        const r: Cell[] = [o.sr_no, o.customer, o.style_no, o.jewelry_type, o.diamond_shape, o.order_date, o.gross_wt, o.dia_qty, o.in_ct, o.colour_stone, o.net_wt, o.multiplier, o.pg_wt].map((x) => x as Cell);
        if (owner) r.push(c?.gold_amount as Cell, c?.diam_amount as Cell, c?.l_charges as Cell, c?.labor_amount as Cell, c?.sub_total as Cell, c?.usd_cost as Cell);
        r.push(...[o.sold_to, o.sale_price, o.date_sold, o.memo_no, o.memo_paid, o.memo_balance, o.payment_status].map((x) => x as Cell));
        return r;
      })];
    } else if (sheet === "trading" && can(session.role, "trades.view")) {
      const [trades, costs] = await Promise.all([allRows(supabase, "trade_overview", "sr_no"), owner ? allRows(supabase, "trade_costs", "trade_id") : Promise.resolve([])]);
      const cm = new Map(costs.map((c) => [c.trade_id as string, c]));
      const head: Cell[] = ["Sr. No.", "Date", "Item"];
      if (owner) head.push("Vendor", "Purchase Price");
      head.push("Sale Price", "Date Sold", "Sold To", "memo", "Memo Paid", "Memo Balance", "Payment Status");
      if (owner) head.push("Profit/Loss");
      head.push("Notes");
      rows = [head, ...trades.map((t) => {
        const c = cm.get(t.id as string);
        const r: Cell[] = [t.sr_no, t.trade_date, t.item].map((x) => x as Cell);
        if (owner) r.push(c?.vendor as Cell, c?.purchase_price as Cell);
        r.push(...[t.sale_price, t.date_sold, t.sold_to, t.memo_no, t.memo_paid, t.memo_balance, t.payment_status].map((x) => x as Cell));
        if (owner) r.push(c && t.sale_price !== null ? Number(t.sale_price) - Number(c.purchase_price) : "");
        r.push(t.notes as Cell);
        return r;
      })];
    } else if (sheet === "expenses" && can(session.role, "expenses.view")) {
      const ex = await allRows(supabase, "expenses", "sr_no");
      rows = [["Sr. No.", "Date", "Category", "Description", "Amount", "Seller", "Notes"], ...ex.map((e) => [e.sr_no, e.expense_date, e.category, e.description, e.amount, e.seller, e.notes].map((x) => x as Cell))];
    } else {
      return new NextResponse("Not allowed", { status: 403 });
    }
  } catch {
    return new NextResponse("Could not read the data", { status: 500 });
  }
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("\uFEFF" + toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vinere-${sheet}-${date}.csv"`, "Cache-Control": "no-store" },
  });
}
