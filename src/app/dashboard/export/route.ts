import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { buildLedgerWorkbook } from "@/lib/excel-export";

export const runtime = "nodejs";

async function allRows(supabase: Awaited<ReturnType<typeof createClient>>, table: string, order: string) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").order(order).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/** One Excel file with the Orders, Trading and Expenses tabs, laid out like the VINERELEDGER workbook. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.role) return new NextResponse("Not allowed", { status: 403 });
  const show = {
    orders: can(session.role, "orders.view"),
    trading: can(session.role, "trades.view"),
    expenses: can(session.role, "expenses.view"),
    costs: can(session.role, "costs.view"),
  };
  if (!show.orders && !show.trading && !show.expenses) return new NextResponse("Not allowed", { status: 403 });
  const asked = new URL(request.url).searchParams.get("sheet");
  const active = asked === "orders" || asked === "trading" || asked === "expenses" ? asked : undefined;
  const supabase = await createClient();
  const none = Promise.resolve([] as Record<string, unknown>[]);

  try {
    const [orders, orderCosts, trades, tradeCosts, expenses, payments] = await Promise.all([
      show.orders ? allRows(supabase, "order_overview", "sr_no") : none,
      show.orders && show.costs ? allRows(supabase, "order_costs", "order_id") : none,
      show.trading ? allRows(supabase, "trade_overview", "sr_no") : none,
      show.trading && show.costs ? allRows(supabase, "trade_costs", "trade_id") : none,
      show.expenses ? allRows(supabase, "expenses", "sr_no") : none,
      show.orders || show.trading ? allRows(supabase, "recent_payments", "created_at") : none,
    ]);
    const workbook = buildLedgerWorkbook({ orders, orderCosts, trades, tradeCosts, expenses, payments, show, active });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="VINERELEDGER-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Could not read the data", { status: 500 });
  }
}
