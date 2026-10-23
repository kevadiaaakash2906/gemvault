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

// ---------- Inventory ----------
const text = (max: number, label: string) => z.string().trim().max(max, `${label} is too long.`);
const optDecimal = (places: number, label: string, maxInt = 10) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || new RegExp(`^\\d{1,${maxInt}}(\\.\\d{1,${places}})?$`).test(v), `${label}: enter a number like 12 or 12.5 (up to ${places} decimals).`);
const whole = (label: string, max = 100000) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d{1,6}$/.test(v) && Number(v) <= max, `${label}: enter a whole number.`);

export const stoneSchema = z.object({
  stone_type: z.string().trim().min(1, "Enter the stone type.").max(60),
  shape: text(60, "Shape"),
  cut: text(60, "Cut"),
  colour: text(60, "Colour"),
  clarity: text(60, "Clarity"),
  carat_weight: optDecimal(3, "Carat weight"),
  length_mm: optDecimal(2, "Length", 6),
  width_mm: optDecimal(2, "Width", 6),
  depth_mm: optDecimal(2, "Depth", 6),
  origin: text(80, "Origin"),
  treatment: text(120, "Treatment"),
  piece_count: z.string().trim().refine((v) => /^[1-9]\d{0,3}$/.test(v), "Pieces: enter 1 or more."),
});

export const costsSchema = z.object({
  purchase_cost: optDecimal(2, "Purchase cost"),
  additional_cost: optDecimal(2, "Additional cost"),
  making_charges: optDecimal(2, "Making charges"),
});

export const productSchema = z
  .object({
    id: z.string().optional(),
    sku: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/, "SKU: letters, numbers and . _ / - only (max 40, no spaces)."),
    barcode: text(64, "Barcode"),
    name: z.string().trim().min(1, "Enter a product name.").max(200),
    description: text(4000, "Description"),
    category: z.string().trim().min(1, "Enter a category.").max(80),
    collection: text(80, "Collection"),
    metal_type: z.enum(["", "gold", "silver", "platinum", "palladium", "other"]),
    purity: text(20, "Purity"),
    gross_weight_g: optDecimal(3, "Gross weight"),
    net_metal_weight_g: optDecimal(3, "Net metal weight"),
    tracking: z.enum(["individual", "quantity"]),
    retail_price: optDecimal(2, "Retail price", 12),
    hsn_code: z.string().trim().refine((v) => v === "" || /^\d{4,8}$/.test(v), "HSN code: 4 to 8 digits."),
    gst_rate: optDecimal(2, "GST rate", 3).refine((v) => v === "" || Number(v) <= 100, "GST rate cannot be above 100."),
    low_stock_threshold: whole("Low-stock level", 100000),
    stones: z.array(stoneSchema).max(30, "Too many stones."),
    costs: costsSchema.optional(),
    opening: z.object({ locationId: z.string(), quantity: z.string().trim() }).optional(),
  })
  .refine((v) => !v.gross_weight_g || !v.net_metal_weight_g || Number(v.net_metal_weight_g) <= Number(v.gross_weight_g), {
    message: "Net metal weight cannot be more than gross weight.",
    path: ["net_metal_weight_g"],
  });
export type ProductValues = z.infer<typeof productSchema>;

const key = z.string().max(80).optional();
export const openingSchema = z.object({
  productId: z.uuid(),
  locationId: z.uuid("Choose a location."),
  quantity: z.string().trim().regex(/^[1-9]\d{0,5}$/, "Enter a whole number, 1 or more."),
  key,
});
export const adjustSchema = z.object({
  productId: z.uuid(),
  locationId: z.uuid("Choose a location."),
  delta: z.string().trim().regex(/^-?[1-9]\d{0,5}$/, "Enter a whole number such as 3 or -2."),
  reason: z.string().trim().min(3, "Give a short reason.").max(300),
  key,
});
export const transferSchema = z.object({
  productId: z.uuid(),
  fromId: z.uuid("Choose where it is moving from."),
  toId: z.uuid("Choose where it is moving to."),
  quantity: z.string().trim().regex(/^[1-9]\d{0,5}$/, "Enter a whole number, 1 or more."),
  key,
});
export const locationSchema = z.object({ name: z.string().trim().min(1, "Enter a name.").max(80) });
export const locationActiveSchema = z.object({ id: z.uuid(), active: z.boolean() });
