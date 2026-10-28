import { z } from "zod";

const email = z.string().trim().pipe(z.email("Enter a valid email address."));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords do not match.", path: ["confirm"] });

export const setRoleSchema = z.object({
  userId: z.uuid("Invalid user."),
  role: z.enum(["owner", "staff", "seller"], { error: "Choose a role." }),
});

export const setActiveSchema = z.object({
  userId: z.uuid("Invalid user."),
  active: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type ResetRequestValues = z.infer<typeof resetRequestSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

// ---------- Orders, Trading, Expenses, Payments ----------
const text = (max: number, label: string) => z.string().trim().max(max, `${label} is too long.`);
const optDecimal = (places: number, label: string, maxInt = 10) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || new RegExp(`^\\d{1,${maxInt}}(\\.\\d{1,${places}})?$`).test(v), `${label}: enter a number like 12 or 12.5 (up to ${places} decimals).`);
const optInt = (label: string) => z.string().trim().refine((v) => v === "" || /^\d{1,6}$/.test(v), `${label}: enter a whole number.`);
const date = z.string().trim().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date.");
const reqDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");
const memoNo = z.string().trim().refine((v) => v === "" || /^[A-Za-z0-9._-]{1,20}$/.test(v), "Memo: letters, numbers and . _ - only (max 20).");

const saleGroupOk = (v: { sold_to: string; memo_no: string; sale_price: string }) =>
  (v.sold_to === "") === (v.memo_no === "") && (v.memo_no === "") === (v.sale_price === "");
const saleGroupMsg = { message: "To record a sale, fill in Sold To, Memo and Sale Price together.", path: ["sale_price"] };

export const orderSchema = z
  .object({
    id: z.string().optional(),
    customer: text(60, "Customer"),
    style_no: z.string().trim().min(1, "Enter the style number.").max(120),
    jewelry_type: text(40, "Jewelry type"),
    diamond_shape: text(60, "Diamond shape"),
    order_date: date,
    gross_wt: optDecimal(3, "Gross weight", 7),
    dia_qty: optInt("Dia Qty"),
    in_ct: optDecimal(3, "IN CT", 7),
    colour_stone: optDecimal(3, "Colour stone", 7),
    net_wt: optDecimal(3, "Net weight", 7),
    multiplier: optDecimal(3, "Multiplier", 1).refine((v) => v === "" || (Number(v) > 0 && Number(v) <= 1), "Multiplier must be above 0 and at most 1."),
    sold_to: text(120, "Sold to"),
    memo_no: memoNo,
    sale_price: optDecimal(2, "Sale price", 12),
    date_sold: date,
    cost: z
      .object({
        gold_rate: optDecimal(2, "Gold rate", 8),
        diam_amount: optDecimal(2, "Diam amount", 12),
        l_charges: optDecimal(2, "L charges", 8),
        flat_labor: z.boolean(),
      })
      .optional(),
  })
  .refine(saleGroupOk, saleGroupMsg)
  .refine((v) => !v.gross_wt || !v.net_wt || Number(v.net_wt) <= Number(v.gross_wt), {
    message: "Net weight cannot be more than gross weight.",
    path: ["net_wt"],
  });
export type OrderValues = z.infer<typeof orderSchema>;

export const tradeSchema = z
  .object({
    id: z.string().optional(),
    trade_date: date,
    item: z.string().trim().min(1, "Enter the item.").max(200),
    notes: text(300, "Notes"),
    sold_to: text(120, "Sold to"),
    memo_no: memoNo,
    sale_price: optDecimal(2, "Sale price", 12),
    date_sold: date,
    cost: z.object({ vendor: text(200, "Vendor"), purchase_price: optDecimal(2, "Purchase price", 12) }).optional(),
  })
  .refine(saleGroupOk, saleGroupMsg);
export type TradeValues = z.infer<typeof tradeSchema>;

export const expenseSchema = z.object({
  id: z.string().optional(),
  expense_date: reqDate,
  category: z.string().trim().min(1, "Enter a category.").max(60),
  description: z.string().trim().min(1, "Enter a description.").max(200),
  amount: z.string().trim().refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), "Amount: enter a number like 120 or 120.50."),
  seller: text(120, "Seller"),
  notes: text(300, "Notes"),
});
export type ExpenseValues = z.infer<typeof expenseSchema>;

export const paymentSchema = z.object({
  memoId: z.uuid(),
  amount: z.string().trim().refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Amount: enter a number above zero."),
  paidOn: reqDate,
  key: z.string().max(80).optional(),
});
export const voidSchema = z.object({ paymentId: z.uuid(), reason: z.string().trim().min(3, "Give a short reason.").max(300) });
export const returnSchema = z.object({
  kind: z.enum(["order", "trade"]),
  id: z.uuid(),
  reason: z.string().trim().min(3, "Give a short reason for the return.").max(300, "The reason is too long (300 characters at most)."),
  password: z.string().min(1, "Enter your password to confirm the return.").max(200),
  returnedOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid return date.")]).optional(),
});
export const deleteSchema = z.object({ kind: z.enum(["order", "trade", "expense"]), id: z.uuid() });
export const ratesSchema = z.object({
  gold_rate: optDecimal(2, "Gold rate", 8).refine((v) => Number(v) > 0, "Enter the gold rate."),
  usd_rate: optDecimal(4, "Dollar rate", 4).refine((v) => Number(v) > 0, "Enter the dollar rate."),
  default_multiplier: optDecimal(3, "Multiplier", 1).refine((v) => Number(v) > 0 && Number(v) <= 1, "Multiplier must be above 0 and at most 1."),
  default_labor: optDecimal(2, "Labour charge", 8).refine((v) => v !== "", "Enter the labour charge."),
});
export type RatesValues = z.infer<typeof ratesSchema>;

export const styleSchema = z.object({
  id: z.string().optional(),
  style_no: z.string().trim().min(1, "Enter the style number.").max(120, "Style number is too long."),
  jewelry_type: text(40, "Jewelry type"),
  diamond_shape: text(60, "Diamond shape"),
});
export type StyleValues = z.infer<typeof styleSchema>;
