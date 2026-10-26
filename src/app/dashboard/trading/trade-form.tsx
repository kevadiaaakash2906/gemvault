// Plain module (no "use client") so server pages can call emptyTrade().
import type { TradeValues } from "@/lib/validation";
export { TradeForm } from "./trade-form-client";

export const emptyTrade = (isOwner: boolean): TradeValues => ({
  trade_date: new Date().toISOString().slice(0, 10), item: "", notes: "", sold_to: "", memo_no: "", sale_price: "", date_sold: "",
  cost: isOwner ? { vendor: "", purchase_price: "" } : undefined,
});
