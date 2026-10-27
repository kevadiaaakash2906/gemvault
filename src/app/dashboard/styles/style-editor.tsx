"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteStyle, saveStyle, uploadStylePhoto } from "@/app/actions/styles";
import type { ActionResult } from "@/app/actions/auth";
import { styleSchema, type StyleValues } from "@/lib/validation";
import { shrinkImage } from "@/lib/shrink";
import { Button, Field, Notice } from "@/components/ui";

export function StyleEditor({
  initial, isNew, photoUrl, orderCount, canDelete,
}: { initial: StyleValues; isNew: boolean; photoUrl: string | null; orderCount: number; canDelete: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<StyleValues>({ resolver: zodResolver(styleSchema), defaultValues: initial });

  const onSubmit = (values: StyleValues) =>
    start(async () => {
      setServerError(undefined);
      const r = await saveStyle(values);
      if (r.error) return setServerError(r.error);
      router.push(isNew && r.id ? `/dashboard/styles?edit=${r.id}` : "/dashboard/styles");
      router.refresh();
    });

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 rounded-md border border-gold-soft bg-white p-5">
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <input type="hidden" {...register("id")} />
        <Field id="style_no" label="Style No." readOnly={!isNew} hint={isNew ? "The number cannot be changed later." : "The style number cannot be changed."} error={errors.style_no?.message} {...register("style_no")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="jewelry_type" label="Jewelry Type" error={errors.jewelry_type?.message} {...register("jewelry_type")} />
          <Field id="diamond_shape" label="Diamond Shape" error={errors.diamond_shape?.message} {...register("diamond_shape")} />
        </div>
        <p className="text-sm text-ink-soft">New orders with this style number fill these in for you. Old orders keep what they were saved with.</p>
        <div className="flex gap-3">
          <Button type="submit" loading={pending}>{isNew ? "Save and add photo" : "Save"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/dashboard/styles")}>Back</Button>
        </div>
      </form>

      {initial.id && <PhotoPanel styleId={initial.id} photoUrl={photoUrl} />}

      {initial.id && canDelete && (
        <DeleteStyle styleId={initial.id} orderCount={orderCount} />
      )}
    </div>
  );
}

function PhotoPanel({ styleId, photoUrl }: { styleId: string; photoUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blobs, setBlobs] = useState<{ photo: Blob; thumb: Blob } | null>(null);
  const [msg, setMsg] = useState<ActionResult>();
  const [pending, start] = useTransition();

  const choose = async (file: File | undefined) => {
    setMsg(undefined);
    setBlobs(null);
    setPreview(null);
    if (!file) return;
    try {
      const [photo, thumb] = await Promise.all([shrinkImage(file, 1200, 0.82), shrinkImage(file, 240, 0.75)]);
      setBlobs({ photo, thumb });
      setPreview(URL.createObjectURL(photo));
    } catch {
      setMsg({ error: "That photo could not be read. Try another one." });
    }
  };

  const upload = () =>
    start(async () => {
      if (!blobs) return;
      const fd = new FormData();
      fd.set("styleId", styleId);
      fd.set("photo", new File([blobs.photo], "photo.jpg", { type: "image/jpeg" }));
      fd.set("thumb", new File([blobs.thumb], "thumb.jpg", { type: "image/jpeg" }));
      const r = await uploadStylePhoto(fd);
      setMsg(r);
      if (r.success) { setBlobs(null); setPreview(null); if (input.current) input.current.value = ""; router.refresh(); }
    });

  const shown = preview ?? photoUrl;
  return (
    <section aria-labelledby="photo" className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
      <h2 id="photo" className="font-display text-xl text-forest">Photo</h2>
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="Style photo" className="max-h-80 w-auto rounded-md object-contain" />
      ) : (
        <p className="text-ink-soft">No photo yet.</p>
      )}
      <div>
        <label htmlFor="photo-file" className="block text-sm font-medium">Choose a photo (it is shrunk automatically)</label>
        <input id="photo-file" ref={input} type="file" accept="image/*" onChange={(e) => choose(e.target.files?.[0])} className="mt-1 block min-h-11 text-sm" />
      </div>
      {blobs && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={upload} loading={pending}>Save this photo</Button>
          <span className="text-sm text-ink-soft">{Math.round(blobs.photo.size / 1024)} KB after shrinking</span>
        </div>
      )}
      {msg?.error && <Notice tone="error">{msg.error}</Notice>}
      {msg?.success && <Notice tone="success">{msg.success}</Notice>}
    </section>
  );
}

function DeleteStyle({ styleId, orderCount }: { styleId: string; orderCount: number }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (orderCount > 0) return <p className="text-sm text-ink-soft">Used by {orderCount} {orderCount === 1 ? "order" : "orders"}, so it cannot be deleted.</p>;
  return (
    <div className="space-y-2">
      <Button type="button" variant="danger" loading={pending}
        onClick={() => window.confirm("Delete this style and its photo? A copy is kept in the audit log.") && start(async () => {
          const r = await deleteStyle(styleId);
          if (r.error) setError(r.error); else { router.push("/dashboard/styles"); router.refresh(); }
        })}>
        Delete this style
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
