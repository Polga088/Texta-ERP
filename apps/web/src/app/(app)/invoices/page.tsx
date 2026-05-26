"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Account, Invoice, Payment, Quote } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaymentModal } from "@/components/billing/payment-modal";

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("fr-MA").format(value || 0)} MAD`;
}

function invoiceStatusBadge(status: Invoice["status"]): string {
  if (status === "paid") return "badge badge-success";
  if (status === "sent") return "badge badge-primary";
  if (status === "partial") return "badge badge-warning";
  if (status === "overdue") return "badge badge-danger animate-pulse";
  if (status === "cancelled") return "badge badge-slate line-through";
  return "badge badge-slate";
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [createFromQuoteOpen, setCreateFromQuoteOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");

  const load = async () => {
    try {
      const [invoiceRows, accountRows, quoteRows, paymentRows] = await Promise.all([
        api<Invoice[]>("/billing/invoices"),
        api<Account[]>("/accounts"),
        api<Quote[]>("/billing/quotes"),
        api<Payment[]>("/billing/payments"),
      ]);
      setInvoices(invoiceRows);
      setAccounts(accountRows);
      setQuotes(quoteRows);
      setPayments(paymentRows);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement factures");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return invoices.filter((invoice) => {
      const client = accounts.find((account) => account.id === invoice.client_id)?.name || "";
      return !term || invoice.invoice_number.toLowerCase().includes(term) || client.toLowerCase().includes(term);
    });
  }, [search, invoices, accounts]);

  const kpis = useMemo(() => {
    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    const invoicedMonth = invoices
      .filter((invoice) => {
        const d = new Date(invoice.issue_date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, invoice) => sum + Number(invoice.total_ttc || 0), 0);
    const paidMonth = payments
      .filter((payment) => {
        const d = new Date(payment.payment_date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const overdue = invoices.filter((invoice) => invoice.status === "overdue").length;
    const unpaid = invoices
      .filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled")
      .reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0);
    return { invoicedMonth, paidMonth, overdue, unpaid };
  }, [invoices, payments]);

  const sendInvoice = async (invoiceId: string) => {
    await api(`/billing/invoices/${invoiceId}/send`, { method: "POST" });
    await load();
  };

  const cancelInvoice = async (invoiceId: string) => {
    await api(`/billing/invoices/${invoiceId}/cancel`, { method: "POST" });
    await load();
  };

  const deleteInvoice = async (invoiceId: string) => {
    await api(`/billing/invoices/${invoiceId}`, { method: "DELETE" });
    await load();
  };

  const createFromQuote = async () => {
    if (!selectedQuoteId) return;
    const invoice = await api<Invoice>(`/billing/quotes/${selectedQuoteId}/convert-to-invoice`, { method: "POST" });
    setCreateFromQuoteOpen(false);
    setSelectedQuoteId("");
    window.alert(`Facture ${invoice.invoice_number} créée avec succès`);
    window.location.href = `/invoices/${invoice.id}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestion des Factures</h1>
          <p className="text-sm text-slate-500">Suivi des paiements et relances</p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices/new"><Button><Plus size={14} />Nouvelle facture</Button></Link>
          <Button variant="secondary" onClick={() => setCreateFromQuoteOpen(true)}>Créer depuis Devis</Button>
        </div>
      </div>

      <div className="kpi-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card priority="violet"><p className="text-xs uppercase text-slate-500">CA Facturé ce mois</p><p className="text-2xl font-bold">{formatMoney(kpis.invoicedMonth)}</p></Card>
        <Card priority="success"><p className="text-xs uppercase text-slate-500">Payé ce mois</p><p className="text-2xl font-bold">{formatMoney(kpis.paidMonth)}</p></Card>
        <Card priority="danger"><p className="text-xs uppercase text-slate-500">En retard</p><p className="text-2xl font-bold">{kpis.overdue}</p></Card>
        <Card priority="warning"><p className="text-xs uppercase text-slate-500">Solde impayé</p><p className="text-2xl font-bold">{formatMoney(kpis.unpaid)}</p></Card>
      </div>

      <Card className="p-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3.5 text-slate-400" size={14} />
          <Input className="pl-9" placeholder="Recherche numéro ou client" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="responsive-table min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Numéro</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Émission</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3">Total TTC</th>
              <th className="px-4 py-3">Payé</th>
              <th className="px-4 py-3">Solde</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((invoice) => (
              <tr key={invoice.id} className="border-t border-slate-100">
                <td className="px-4 py-3" data-label="Numéro">{invoice.invoice_number}</td>
                <td className="px-4 py-3" data-label="Client">{accounts.find((a) => a.id === invoice.client_id)?.name || "—"}</td>
                <td className="px-4 py-3" data-label="Émission">{invoice.issue_date}</td>
                <td className="px-4 py-3" data-label="Échéance">{invoice.due_date}</td>
                <td className="px-4 py-3" data-label="Total TTC">{formatMoney(Number(invoice.total_ttc))}</td>
                <td className="px-4 py-3" data-label="Payé">{formatMoney(Number(invoice.paid_amount))}</td>
                <td className="px-4 py-3" data-label="Solde">{formatMoney(Number(invoice.balance_due))}</td>
                <td className="px-4 py-3" data-label="Statut"><span className={invoiceStatusBadge(invoice.status)}>{invoice.status}</span></td>
                <td className="px-4 py-3" data-label="Actions">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/invoices/${invoice.id}`} className="btn-secondary inline-flex h-11 items-center rounded-[var(--radius-md)] border px-3 text-sm">Voir</Link>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedInvoice(invoice)}>Ajouter paiement</Button>
                    {invoice.status === "draft" && <Button size="sm" variant="ghost" onClick={() => sendInvoice(invoice.id)}>Envoyer</Button>}
                    <Button size="sm" variant="ghost" onClick={() => window.open(`/api/v1/billing/invoices/${invoice.id}/pdf`, "_blank")}>PDF</Button>
                    {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" onClick={() => cancelInvoice(invoice.id)}>Annuler</Button>
                    )}
                    {invoice.status === "draft" && (
                      <Button size="sm" variant="ghost" onClick={() => deleteInvoice(invoice.id)}>Supprimer</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <PaymentModal
        open={!!selectedInvoice}
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onCreated={() => void load()}
      />

      {createFromQuoteOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
          <div className="modal-content modal-panel mx-auto mt-16 w-full max-w-md bg-white p-5">
            <h2 className="mb-3 text-xl font-semibold">Créer facture depuis devis</h2>
            <select className="input-field" value={selectedQuoteId} onChange={(e) => setSelectedQuoteId(e.target.value)}>
              <option value="">Sélectionner un devis accepté</option>
              {quotes.filter((quote) => quote.status === "accepted").map((quote) => (
                <option key={quote.id} value={quote.id}>{quote.quote_number}</option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setCreateFromQuoteOpen(false)}>Annuler</Button>
              <Button className="flex-1" onClick={createFromQuote}>Créer</Button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
