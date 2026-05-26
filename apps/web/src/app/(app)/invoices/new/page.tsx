"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Account, Invoice, Quote } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function NewInvoicePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [form, setForm] = useState({
    quote_id: "",
    client_id: "",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    item_description: "",
    qty: "1",
    unit_price: "0",
    discount_percent: "0",
    tva_rate: "20",
    notes: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Account[]>("/accounts"), api<Quote[]>("/billing/quotes")])
      .then(([accountRows, quoteRows]) => {
        setAccounts(accountRows);
        setQuotes(quoteRows);
      })
      .catch(() => undefined);
  }, []);

  const create = async () => {
    try {
      const invoice = await api<Invoice>("/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          quote_id: form.quote_id || null,
          client_id: form.client_id || null,
          issue_date: form.issue_date,
          due_date: form.due_date || null,
          tva_rate: Number(form.tva_rate || "20"),
          notes: form.notes || null,
          items: [
            {
              description: form.item_description || "Ligne",
              qty: Number(form.qty || "1"),
              unit_price: Number(form.unit_price || "0"),
              discount_percent: Number(form.discount_percent || "0"),
              total_ht: 0,
            },
          ],
        }),
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création facture");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Nouvelle facture</h1>
      <Card className="grid gap-3 md:grid-cols-2">
        <select className="input-field md:col-span-2" value={form.quote_id} onChange={(e) => setForm((s) => ({ ...s, quote_id: e.target.value }))}>
          <option value="">Aucun devis source</option>
          {quotes.filter((quote) => quote.status === "accepted").map((quote) => (
            <option key={quote.id} value={quote.id}>{quote.quote_number}</option>
          ))}
        </select>
        <select className="input-field" value={form.client_id} onChange={(e) => setForm((s) => ({ ...s, client_id: e.target.value }))}>
          <option value="">Client</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
        <Input type="date" value={form.issue_date} onChange={(e) => setForm((s) => ({ ...s, issue_date: e.target.value }))} />
        <Input type="date" value={form.due_date} onChange={(e) => setForm((s) => ({ ...s, due_date: e.target.value }))} />
        <Input className="md:col-span-2" placeholder="Description ligne" value={form.item_description} onChange={(e) => setForm((s) => ({ ...s, item_description: e.target.value }))} />
        <Input type="number" placeholder="Quantité" value={form.qty} onChange={(e) => setForm((s) => ({ ...s, qty: e.target.value }))} />
        <Input type="number" placeholder="Prix unitaire" value={form.unit_price} onChange={(e) => setForm((s) => ({ ...s, unit_price: e.target.value }))} />
        <Input type="number" placeholder="Remise %" value={form.discount_percent} onChange={(e) => setForm((s) => ({ ...s, discount_percent: e.target.value }))} />
        <Input type="number" placeholder="TVA %" value={form.tva_rate} onChange={(e) => setForm((s) => ({ ...s, tva_rate: e.target.value }))} />
      </Card>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.push("/invoices")}>Annuler</Button>
        <Button onClick={create}>Créer la facture</Button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
