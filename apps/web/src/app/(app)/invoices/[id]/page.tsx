"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Account, Invoice, Payment } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaymentModal } from "@/components/billing/payment-modal";
import { FileUpload } from "@/components/ui/file-upload";

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("fr-MA").format(value || 0)} MAD`;
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const invoiceRow = await api<Invoice>(`/billing/invoices/${id}`);
      setInvoice(invoiceRow);
      if (invoiceRow.client_id) {
        const accounts = await api<Account[]>("/accounts");
        setAccount(accounts.find((row) => row.id === invoiceRow.client_id) || null);
      }
      const paymentRows = await api<Payment[]>(`/billing/payments?invoice_id=${id}`);
      setPayments(paymentRows);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement facture");
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  if (!invoice) return <div className="p-4 text-sm text-slate-500">Chargement...</div>;

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/home" className="hover:underline">Accueil</Link> &gt; <Link href="/invoices" className="hover:underline">Factures</Link> &gt; {invoice.invoice_number}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <h1 className="text-2xl font-bold text-slate-900">{invoice.invoice_number}</h1>
            <p className="text-sm text-slate-500">{invoice.issue_date} — échéance {invoice.due_date}</p>
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Client</h2>
            <p className="font-medium text-slate-900">{account?.name || "Client"}</p>
            <p className="text-sm text-slate-500">{invoice.client_id || "—"}</p>
          </Card>
          <Card className="overflow-x-auto">
            <h2 className="mb-2 text-lg font-semibold">Lignes</h2>
            <table className="w-full min-w-[540px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Qté</th>
                  <th className="pb-2">Prix unit.</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={`${item.description}-${index}`} className="border-t border-slate-100">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2">{item.qty}</td>
                    <td className="py-2">{formatMoney(Number(item.unit_price))}</td>
                    <td className="py-2">{formatMoney(Number(item.total_ht))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Paiements</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun paiement pour cette facture</p>
            ) : (
              <ul className="space-y-2">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span>{payment.payment_date} · {payment.method}</span>
                    <span className="font-semibold">{formatMoney(Number(payment.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Documents</h2>
            <FileUpload entityType="invoice" entityId={invoice.id} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="sticky top-24">
            <h2 className="mb-3 text-lg font-semibold">Actions rapides</h2>
            <div className="space-y-2">
              <Button className="w-full" variant="secondary" onClick={() => setPaymentOpen(true)}>Ajouter paiement</Button>
              {invoice.status === "draft" && <Button className="w-full" onClick={() => api(`/billing/invoices/${invoice.id}/send`, { method: "POST" }).then(load)}>Envoyer</Button>}
              {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <Button className="w-full" variant="ghost" onClick={() => api(`/billing/invoices/${invoice.id}/cancel`, { method: "POST" }).then(load)}>Annuler</Button>
              )}
              <Button variant="secondary" className="w-full" onClick={() => window.open(`/api/v1/billing/invoices/${invoice.id}/pdf`, "_blank")}>Télécharger PDF</Button>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              <p>Total TTC: {formatMoney(Number(invoice.total_ttc))}</p>
              <p>Payé: {formatMoney(Number(invoice.paid_amount))}</p>
              <p className="font-semibold text-amber-700">Solde: {formatMoney(Number(invoice.balance_due))}</p>
            </div>
          </Card>
        </div>
      </div>
      <PaymentModal open={paymentOpen} invoice={invoice} onClose={() => setPaymentOpen(false)} onCreated={() => void load()} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
