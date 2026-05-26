"use client";

import { useRouter } from "next/navigation";
import { Quote } from "@/types";
import { QuoteModal } from "@/components/billing/quote-modal";

export default function NewQuotePage() {
  const router = useRouter();

  return (
    <QuoteModal
      open
      onClose={() => router.push("/quotes")}
      onCreated={(quote: Quote) => router.push(`/quotes/${quote.id}`)}
    />
  );
}
