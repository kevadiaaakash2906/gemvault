"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { saveProduct } from "@/app/actions/inventory";
import { productSchema, type ProductValues } from "@/lib/validation";
import { Button, Field, Notice, SelectField, TextAreaField } from "@/components/ui";

const emptyStone = { stone_type: "", shape: "", cut: "", colour: "", clarity: "", carat_weight: "", length_mm: "", width_mm: "", depth_mm: "", origin: "", treatment: "", piece_count: "1" };

export const emptyProduct: ProductValues = {
  sku: "", barcode: "", name: "", description: "", category: "", collection: "", metal_type: "", purity: "",
  gross_weight_g: "", net_metal_weight_g: "", tracking: "individual", retail_price: "", hsn_code: "", gst_rate: "",
  low_stock_threshold: "0", stones: [], costs: { purchase_cost: "", additional_cost: "", making_charges: "" },
};

export function ProductForm({
  initial, canSeeCosts, locations, isNew,
}: { initial: ProductValues; canSeeCosts: boolean; locations: { id: string; name: string }[]; isNew: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { register, control, handleSubmit, formState: { errors } } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { ...initial, opening: isNew ? { locationId: locations[0]?.id ?? "", quantity: "" } : undefined },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "stones" });
  const tracking = useWatch({ control, name: "tracking" });

  const onSubmit = (values: ProductValues) =>
    startTransition(async () => {
      setServerError(undefined);
      const result = await saveProduct(canSeeCosts ? values : { ...values, costs: undefined });
      if (result.id && !result.error) return router.push(`/dashboard/inventory/${result.id}`);
      if (result.id && result.error) return router.push(`/dashboard/inventory/${result.id}?notice=${encodeURIComponent(result.error)}`);
      setServerError(result.error);
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-4xl space-y-8">
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <input type="hidden" {...register("id")} />

      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Basics</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sku" label="SKU" hint="Your own code, e.g. R-0001. Must be unique." error={errors.sku?.message} {...register("sku")} />
          <Field id="barcode" label="Barcode (optional)" hint="Scan it into this box with a barcode scanner." error={errors.barcode?.message} {...register("barcode")} />
        </div>
        <Field id="name" label="Product name" error={errors.name?.message} {...register("name")} />
        <TextAreaField id="description" label="Description (optional)" error={errors.description?.message} {...register("description")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="category" label="Category" hint="For example Rings, Necklaces" error={errors.category?.message} {...register("category")} />
          <Field id="collection" label="Collection (optional)" error={errors.collection?.message} {...register("collection")} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Metal and weight</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField id="metal_type" label="Metal" error={errors.metal_type?.message} {...register("metal_type")}>
            <option value="">None / not applicable</option>
            <option value="gold">Gold</option><option value="silver">Silver</option><option value="platinum">Platinum</option>
            <option value="palladium">Palladium</option><option value="other">Other</option>
          </SelectField>
          <Field id="purity" label="Purity" hint="22K, 18K, 925…" error={errors.purity?.message} {...register("purity")} />
          <Field id="gross_weight_g" label="Gross weight (g)" inputMode="decimal" error={errors.gross_weight_g?.message} {...register("gross_weight_g")} />
          <Field id="net_metal_weight_g" label="Net metal weight (g)" inputMode="decimal" error={errors.net_metal_weight_g?.message} {...register("net_metal_weight_g")} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Stones</legend>
        {fields.length === 0 && <p className="text-ink-soft">No stones added. Skip this for plain metal pieces.</p>}
        {fields.map((f, i) => {
          const e = errors.stones?.[i];
          return (
            <div key={f.id} className="space-y-3 rounded-md border border-gold-soft p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">Stone {i + 1}</p>
                <button type="button" onClick={() => remove(i)} className="inline-flex min-h-11 items-center gap-1 text-sm text-danger" aria-label={`Remove stone ${i + 1}`}>
                  <Trash2 className="size-4" aria-hidden /> Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field id={`s${i}-type`} label="Type" placeholder="Diamond, Ruby…" error={e?.stone_type?.message} {...register(`stones.${i}.stone_type`)} />
                <Field id={`s${i}-shape`} label="Shape" error={e?.shape?.message} {...register(`stones.${i}.shape`)} />
                <Field id={`s${i}-cut`} label="Cut" error={e?.cut?.message} {...register(`stones.${i}.cut`)} />
                <Field id={`s${i}-colour`} label="Colour" error={e?.colour?.message} {...register(`stones.${i}.colour`)} />
                <Field id={`s${i}-clarity`} label="Clarity" error={e?.clarity?.message} {...register(`stones.${i}.clarity`)} />
                <Field id={`s${i}-carat`} label="Carat weight" inputMode="decimal" error={e?.carat_weight?.message} {...register(`stones.${i}.carat_weight`)} />
                <Field id={`s${i}-pieces`} label="Number of stones" inputMode="numeric" error={e?.piece_count?.message} {...register(`stones.${i}.piece_count`)} />
                <Field id={`s${i}-origin`} label="Origin" error={e?.origin?.message} {...register(`stones.${i}.origin`)} />
                <Field id={`s${i}-len`} label="Length (mm)" inputMode="decimal" error={e?.length_mm?.message} {...register(`stones.${i}.length_mm`)} />
                <Field id={`s${i}-wid`} label="Width (mm)" inputMode="decimal" error={e?.width_mm?.message} {...register(`stones.${i}.width_mm`)} />
                <Field id={`s${i}-dep`} label="Depth (mm)" inputMode="decimal" error={e?.depth_mm?.message} {...register(`stones.${i}.depth_mm`)} />
                <Field id={`s${i}-treat`} label="Treatment" error={e?.treatment?.message} {...register(`stones.${i}.treatment`)} />
              </div>
            </div>
          );
        })}
        <Button type="button" variant="ghost" onClick={() => append(emptyStone)}>
          <Plus className="size-4" aria-hidden /> Add a stone
        </Button>
        {errors.stones?.message && <p role="alert" className="text-sm text-danger">{errors.stones.message}</p>}
      </fieldset>

      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Price, tax and stock</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="retail_price" label="Retail price (₹)" inputMode="decimal" error={errors.retail_price?.message} {...register("retail_price")} />
          <Field id="hsn_code" label="HSN code (optional)" inputMode="numeric" error={errors.hsn_code?.message} {...register("hsn_code")} />
          <Field id="gst_rate" label="GST rate % (optional)" inputMode="decimal" hint="Leave blank to use your business default later." error={errors.gst_rate?.message} {...register("gst_rate")} />
          <Field id="low_stock_threshold" label="Warn me at or below" inputMode="numeric" hint="0 turns the warning off." error={errors.low_stock_threshold?.message} {...register("low_stock_threshold")} />
        </div>
        <SelectField id="tracking" label="How is it counted?" error={errors.tracking?.message} {...register("tracking")}>
          <option value="individual">One-of-a-kind piece (only ever 1)</option>
          <option value="quantity">Quantity (several identical items)</option>
        </SelectField>
        {isNew && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="opening-loc" label="Opening stock location" {...register("opening.locationId")}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </SelectField>
            <Field id="opening-qty" label="Opening quantity" inputMode="numeric" hint={tracking === "individual" ? "Type 1 if you have this piece now." : "How many do you have right now? Leave blank to add later."} {...register("opening.quantity")} />
          </div>
        )}
      </fieldset>

      {canSeeCosts && (
        <fieldset className="space-y-4 rounded-md border border-gold-soft bg-parchment p-5">
          <legend className="px-2 font-display text-xl text-forest">Costs (owner only)</legend>
          <p className="text-sm text-ink-soft">Staff and sellers can never see these amounts.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="purchase_cost" label="Purchase cost (₹)" inputMode="decimal" error={errors.costs?.purchase_cost?.message} {...register("costs.purchase_cost")} />
            <Field id="additional_cost" label="Additional cost (₹)" inputMode="decimal" error={errors.costs?.additional_cost?.message} {...register("costs.additional_cost")} />
            <Field id="making_charges" label="Making charges (₹)" inputMode="decimal" error={errors.costs?.making_charges?.message} {...register("costs.making_charges")} />
          </div>
        </fieldset>
      )}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>Save product</Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
