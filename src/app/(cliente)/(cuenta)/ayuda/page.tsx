import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { CUSTOMER_FAQS } from "@/lib/faqs";

export const metadata: Metadata = { title: "Preguntas frecuentes" };

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Preguntas frecuentes" />
      <div className="divide-y divide-border rounded-lg border border-border">
        {CUSTOMER_FAQS.map((faq) => (
          <details key={faq.q} className="group px-4 py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold">
              {faq.q}
              <span aria-hidden className="text-xl text-muted transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-4 text-muted">{faq.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
