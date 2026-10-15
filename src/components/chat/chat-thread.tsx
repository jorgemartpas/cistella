import type { ChatMessage } from "@/lib/chat";
import { TIME_ZONE, madridDate } from "@/lib/domain/dates";
import { groupByDay, relativeDay } from "@/lib/domain/chat";
import { capitalize, formatDay } from "@/lib/format";
import { cx } from "../ui";

const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

/** La conversación: separada por días, lo propio a la derecha y lo del otro lado a la izquierda. */
export function ChatThread({ messages, now, empty }: { messages: ChatMessage[]; now: Date; empty: string }) {
  if (messages.length === 0) {
    return <p className="card-surface px-5 py-8 text-center text-sm text-muted">{empty}</p>;
  }
  const today = madridDate(now);
  return (
    <ol className="space-y-5" aria-label="Mensajes">
      {groupByDay(messages).map((group) => (
        <li key={group.date}>
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {relativeDay(group.date, today) ?? capitalize(formatDay(group.date))}
          </p>
          <ol className="space-y-2">
            {group.messages.map((m, i) => (
              <li key={m.id} className={cx("flex flex-col", m.mine ? "items-end" : "items-start")}>
                {/* El nombre solo en el primero de varios seguidos de la misma persona */}
                {m.author && group.messages[i - 1]?.author !== m.author && (
                  <span className="mb-0.5 px-1 text-xs font-semibold text-muted">{m.author}</span>
                )}
                <div
                  className={cx(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-snug sm:max-w-[70%]",
                    m.mine ? "rounded-br-md bg-primary text-primary-ink" : "card-surface rounded-bl-md",
                  )}
                >
                  {m.body}
                </div>
                <time dateTime={m.created_at} className="mt-0.5 px-1 text-[11px] text-muted">
                  {timeFormatter.format(new Date(m.created_at))}
                </time>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
