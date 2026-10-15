"use client";

import { useState, useTransition } from "react";
import { sendChatMessage } from "@/lib/actions/chat";
import { MAX_MESSAGE_LENGTH } from "@/lib/domain/chat";
import { Icon } from "../icons";
import { buttonStyles, cx } from "../ui";

/** Escribir un mensaje: Intro envía, Mayúsculas + Intro hace un salto de línea. */
export function ChatComposer({ shopId, placeholder }: { shopId: string; placeholder: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    if (!text.trim() || pending) return;
    // La caja se vacía al momento para poder seguir escribiendo; si falla, el texto vuelve
    const message = text;
    setText("");
    setError(null);
    startTransition(async () => {
      const result = await sendChatMessage(shopId, message);
      if (result.error) {
        setError(result.error);
        setText((current) => (current.trim() ? current : message));
      }
    });
  };

  return (
    <form
      className="card-surface sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] mt-6 p-3 md:bottom-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={placeholder}
          aria-label="Mensaje"
          className="min-h-12 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-[15px] focus:border-primary"
          style={{ outline: "none" }}
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className={cx(buttonStyles.primary, "min-h-12 shrink-0 px-4")}
          aria-label="Enviar"
        >
          <Icon name="chat" className="size-5" />
          <span className="hidden sm:inline">{pending ? "Enviando…" : "Enviar"}</span>
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
