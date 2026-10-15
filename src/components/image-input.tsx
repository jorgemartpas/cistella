"use client";

import { useRef, useState } from "react";

const MAX_SIDE = 1200;

/** Reduce la foto en el propio móvil antes de subirla (JPEG de 1200 px como máximo). */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function ImageInput({ name, currentUrl }: { name: string; currentUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Foto del producto" className="size-20 rounded-lg object-cover bg-surface-2" />
      ) : (
        <div className="flex size-20 items-center justify-center rounded-lg bg-surface-2 text-xs text-muted">Sin foto</div>
      )}
      <label className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-2">
        {busy ? "Preparando…" : preview ? "Cambiar foto" : "Añadir foto"}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            const small = await shrink(file);
            const transfer = new DataTransfer();
            transfer.items.add(small);
            if (inputRef.current) inputRef.current.files = transfer.files;
            setPreview(URL.createObjectURL(small));
            setBusy(false);
          }}
        />
      </label>
    </div>
  );
}
