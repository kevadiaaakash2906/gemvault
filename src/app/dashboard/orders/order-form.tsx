// Plain module (no "use client") so server pages can call emptyOrder().
import type { OrderValues } from "@/lib/validation";
export { OrderForm } from "./order-form-client";

export const emptyOrder = (rates: { defaultMultiplier: number; defaultLabor: number; goldRate: number } | null): OrderValues => ({
  customer: "", style_no: "", jewelry_type: "", diamond_shape: "", order_date: new Date().toISOString().slice(0, 10),
  gross_wt: "", dia_qty: "", in_ct: "", colour_stone: "", net_wt: "", multiplier: rates ? String(rates.defaultMultiplier) : "0.595",
  sold_to: "", memo_no: "", sale_price: "", date_sold: "",
  cost: rates ? { gold_rate: String(rates.goldRate), diam_amount: "", l_charges: String(rates.defaultLabor), flat_labor: false } : undefined,
});
