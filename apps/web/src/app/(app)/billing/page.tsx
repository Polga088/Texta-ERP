"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Plus, Receipt, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { BillingKpis, Invoice, Payment, Quote } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "quotes" | "invoices" | "payments";

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("fr-MA").format(value || 0)} MAD`;
}

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>("quotes");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [kpis, setKpis] = useState<BillingKpis | null>(null);
  const [error, setError] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>("");
  const [quoteForm, setQuoteForm] = useState({
    lead_id: "",
    client_id: "",
    issue_date: "",
    valid_until: "",
    item_description: "",
    qty: "1",
    unit_price: "0",
    discount_percent: "0",
    tva_rate: "20",
    notes: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    quote_id: "",
    client_id: "",
    issue_date: "",
    due_date: "",
    item_description: "",
    qty: "1",
    unit_price: "0",
    discount_percent: "0",
    tva_rate: "20",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: "",
    method: "transfer",
    reference: "",
    notes: "",
  });

  const load = async () => {
    try {
      const [quoteRows, invoiceRows, paymentRows, kpiRows] = await Promise.all([
        api<Quote[]>("/billing/quotes"),
        api<Invoice[]>("/billing/invoices"),
        api<Payment[]>("/billing/payments"),
        api<BillingKpis>("/billing/kpis"),
      ]);
      setQuotes(quoteRows);
      setInvoices(invoiceRows);
      setPayments(paymentRows);
      setKpis(kpiRows);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement facturation");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const quoteAcceptable = useMemo(() => quotes.filter((row) => row.status === "draft" || row.status === "sent"), [quotes]);

  const createQuote = async () => {
    try {
      await api("/billing/quotes", {
        method: "POST",
        body: JSON.stringify({
          lead_id: quoteForm.lead_id || null,
          client_id: quoteForm.client_id || null,
          issue_date: quoteForm.issue_date,
          valid_until: quoteForm.valid_until || null,
          tva_rate: Number(quoteForm.tva_rate || "20"),
          notes: quoteForm.notes || null,
          items: [
            {
              description: quoteForm.item_description || "Ligne",
              qty: Number(quoteForm.qty || "1"),
              unit_price: Number(quoteForm.unit_price || "0"),
              discount_percent: Number(quoteForm.discount_percent || "0"),
              total_ht: 0,
            },
          ],
        }),
      });
      setQuoteOpen(false);
      setQuoteForm({
        lead_id: "",
        client_id: "",
        issue_date: "",
        valid_until: "",
        item_description: "",
        qty: "1",
        unit_price: "0",
        discount_percent: "0",
        tva_rate: "20",
        notes: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création devis");
    }
  };

  const createInvoice = async () => {
    try {
      await api("/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          quote_id: invoiceForm.quote_id || null,
          client_id: invoiceForm.client_id || null,
          issue_date: invoiceForm.issue_date,
          due_date: invoiceForm.due_date || null,
          tva_rate: Number(invoiceForm.tva_rate || "20"),
          notes: invoiceForm.notes || null,
          items: [
            {
              description: invoiceForm.item_description || "Ligne",
              qty: Number(invoiceForm.qty || "1"),
              unit_price: Number(invoiceForm.unit_price || "0"),
              discount_percent: Number(invoiceForm.discount_percent || "0"),
              total_ht: 0,
            },
          ],
        }),
      });
      setInvoiceOpen(false);
      setInvoiceForm({
        quote_id: "",
        client_id: "",
        issue_date: "",
        due_date: "",
        item_description: "",
        qty: "1",
        unit_price: "0",
        discount_percent: "0",
        tva_rate: "20",
        notes: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création facture");
    }
  };

  const addPayment = async () => {
    if (!paymentInvoiceId) return;
    try {
      await api(`/billing/invoices/${paymentInvoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentForm.amount || "0"),
          payment_date: paymentForm.payment_date,
          method: paymentForm.method,
          reference: paymentForm.reference || null,
          notes: paymentForm.notes || null,
        }),
      });
      setPaymentInvoiceId("");
      setPaymentForm({ amount: "", payment_date: "", method: "transfer", reference: "", notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur ajout paiement");
    }
  };

  const acceptQuote = async (quoteId: string) => {
    await api(`/billing/quotes/${quoteId}/accept`, { method: "POST" });
    await load();
  };

  const convertQuote = async (quoteId: string) => {
    await api(`/billing/quotes/${quoteId}/convert-to-invoice`, { method: "POST" });
    await load();
    setTab("invoices");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Facturation & Devis</h1>
          <p className="text-sm text-slate-500">Gérez devis, factures et paiements depuis le pipeline gagné.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setQuoteOpen(true)}>
            <Plus size={16} />
            Nouveau devis
          </Button>
          <Button variant="secondary" onClick={() => setInvoiceOpen(true)}>
            <Plus size={16} />
            Nouvelle facture
          </Button>
        </div>
      </div>

      <div className="kpi-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card priority="warning">
          <p className="text-xs uppercase text-slate-500">CA facturé (mois)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(kpis?.invoiced_month || 0)}</p>
        </Card>
        <Card priority="danger">
          <p className="text-xs uppercase text-slate-500">Factures en retard</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{kpis?.overdue_invoices || 0}</p>
        </Card>
        <Card priority="violet">
          <p className="text-xs uppercase text-slate-500">Devis en attente</p>
          <p className="mt-1 text-2xl font-bold text-violet-700">{kpis?.pending_quotes || 0}</p>
        </Card>
        <Card priority="success">
          <p className="text-xs uppercase text-slate-500">Encaissement (mois)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{formatMoney(kpis?.collected_month || 0)}</p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "quotes" ? "primary" : "secondary"} onClick={() => setTab("quotes")}>
            <FileText size={16} />
            Devis
          </Button>
          <Button size="sm" variant={tab === "invoices" ? "primary" : "secondary"} onClick={() => setTab("invoices")}>
            <Receipt size={16} />
            Factures
          </Button>
          <Button size="sm" variant={tab === "payments" ? "primary" : "secondary"} onClick={() => setTab("payments")}>
            <Wallet size={16} />
            Paiements
          </Button>
        </div>
      </Card>

      {tab === "quotes" && (
        <Card className="overflow-x-auto p-0">
          <table className="responsive-table min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Validité</th>
                <th className="px-4 py-3">Total TTC</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3" data-label="Numéro">{row.quote_number}</td>
                  <td className="px-4 py-3" data-label="Date">{row.issue_date}</td>
                  <td className="px-4 py-3" data-label="Validité">{row.valid_until}</td>
                  <td className="px-4 py-3" data-label="Total TTC">{formatMoney(row.total_ttc)}</td>
                  <td className="px-4 py-3" data-label="Statut">{row.status}</td>
                  <td className="px-4 py-3" data-label="Actions">
                    <div className="flex gap-2">
                      {(row.status === "draft" || row.status === "sent") && (
                        <Button size="sm" variant="secondary" onClick={() => acceptQuote(row.id)}>
                          <CheckCircle2 size={14} />
                          Accepter
                        </Button>
                      )}
                      {row.status === "accepted" && (
                        <Button size="sm" onClick={() => convertQuote(row.id)}>
                          Convertir facture
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "invoices" && (
        <Card className="overflow-x-auto p-0">
          <table className="responsive-table min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Total TTC</th>
                <th className="px-4 py-3">Payé</th>
                <th className="px-4 py-3">Reste dû</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3" data-label="Numéro">{row.invoice_number}</td>
                  <td className="px-4 py-3" data-label="Date">{row.issue_date}</td>
                  <td className="px-4 py-3" data-label="Échéance">{row.due_date}</td>
                  <td className="px-4 py-3" data-label="Total">{formatMoney(row.total_ttc)}</td>
                  <td className="px-4 py-3" data-label="Payé">{formatMoney(row.paid_amount)}</td>
                  <td className="px-4 py-3" data-label="Reste">{formatMoney(row.balance_due)}</td>
                  <td className="px-4 py-3" data-label="Statut">{row.status}</td>
                  <td className="px-4 py-3" data-label="Paiement">
                    <Button size="sm" variant="secondary" onClick={() => setPaymentInvoiceId(row.id)}>
                      Ajouter paiement
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "payments" && (
        <Card className="overflow-x-auto p-0">
          <table className="responsive-table min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Facture</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Méthode</th>
                <th className="px-4 py-3">Référence</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3" data-label="Facture">{invoices.find((invoice) => invoice.id === row.invoice_id)?.invoice_number || row.invoice_id}</td>
                  <td className="px-4 py-3" data-label="Date">{row.payment_date}</td>
                  <td className="px-4 py-3" data-label="Montant">{formatMoney(row.amount)}</td>
                  <td className="px-4 py-3" data-label="Méthode">{row.method}</td>
                  <td className="px-4 py-3" data-label="Référence">{row.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {quoteOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
          <div className="modal-content modal-panel mx-auto mt-10 w-full max-w-xl bg-white p-5">
            <div className="drawer-header mb-3">
              <h2 className="text-xl font-semibold">Nouveau devis</h2>
              <Button size="sm" variant="ghost" onClick={() => setQuoteOpen(false)}>Fermer</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Lead ID (won)" value={quoteForm.lead_id} onChange={(e) => setQuoteForm((s) => ({ ...s, lead_id: e.target.value }))} />
              <Input placeholder="Client ID" value={quoteForm.client_id} onChange={(e) => setQuoteForm((s) => ({ ...s, client_id: e.target.value }))} />
              <Input type="date" value={quoteForm.issue_date} onChange={(e) => setQuoteForm((s) => ({ ...s, issue_date: e.target.value }))} />
              <Input type="date" value={quoteForm.valid_until} onChange={(e) => setQuoteForm((s) => ({ ...s, valid_until: e.target.value }))} />
              <Input className="md:col-span-2" placeholder="Description ligne" value={quoteForm.item_description} onChange={(e) => setQuoteForm((s) => ({ ...s, item_description: e.target.value }))} />
              <Input type="number" placeholder="Quantité" value={quoteForm.qty} onChange={(e) => setQuoteForm((s) => ({ ...s, qty: e.target.value }))} />
              <Input type="number" placeholder="Prix unitaire" value={quoteForm.unit_price} onChange={(e) => setQuoteForm((s) => ({ ...s, unit_price: e.target.value }))} />
              <Input type="number" placeholder="Remise %" value={quoteForm.discount_percent} onChange={(e) => setQuoteForm((s) => ({ ...s, discount_percent: e.target.value }))} />
              <Input type="number" placeholder="TVA %" value={quoteForm.tva_rate} onChange={(e) => setQuoteForm((s) => ({ ...s, tva_rate: e.target.value }))} />
              <Input className="md:col-span-2" placeholder="Notes" value={quoteForm.notes} onChange={(e) => setQuoteForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setQuoteOpen(false)}>Annuler</Button>
              <Button onClick={createQuote}>Créer devis</Button>
            </div>
          </div>
        </div>
      )}

      {invoiceOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
          <div className="modal-content modal-panel mx-auto mt-10 w-full max-w-xl bg-white p-5">
            <div className="drawer-header mb-3">
              <h2 className="text-xl font-semibold">Nouvelle facture</h2>
              <Button size="sm" variant="ghost" onClick={() => setInvoiceOpen(false)}>Fermer</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select className="input-field md:col-span-2" value={invoiceForm.quote_id} onChange={(e) => setInvoiceForm((s) => ({ ...s, quote_id: e.target.value }))}>
                <option value="">Aucun devis source</option>
                {quoteAcceptable.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.quote_number}
                  </option>
                ))}
              </select>
              <Input placeholder="Client ID" value={invoiceForm.client_id} onChange={(e) => setInvoiceForm((s) => ({ ...s, client_id: e.target.value }))} />
              <Input type="date" value={invoiceForm.issue_date} onChange={(e) => setInvoiceForm((s) => ({ ...s, issue_date: e.target.value }))} />
              <Input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm((s) => ({ ...s, due_date: e.target.value }))} />
              <Input className="md:col-span-2" placeholder="Description ligne" value={invoiceForm.item_description} onChange={(e) => setInvoiceForm((s) => ({ ...s, item_description: e.target.value }))} />
              <Input type="number" placeholder="Quantité" value={invoiceForm.qty} onChange={(e) => setInvoiceForm((s) => ({ ...s, qty: e.target.value }))} />
              <Input type="number" placeholder="Prix unitaire" value={invoiceForm.unit_price} onChange={(e) => setInvoiceForm((s) => ({ ...s, unit_price: e.target.value }))} />
              <Input type="number" placeholder="Remise %" value={invoiceForm.discount_percent} onChange={(e) => setInvoiceForm((s) => ({ ...s, discount_percent: e.target.value }))} />
              <Input type="number" placeholder="TVA %" value={invoiceForm.tva_rate} onChange={(e) => setInvoiceForm((s) => ({ ...s, tva_rate: e.target.value }))} />
              <Input className="md:col-span-2" placeholder="Notes" value={invoiceForm.notes} onChange={(e) => setInvoiceForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setInvoiceOpen(false)}>Annuler</Button>
              <Button onClick={createInvoice}>Créer facture</Button>
            </div>
          </div>
        </div>
      )}

      {paymentInvoiceId && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
          <div className="modal-content modal-panel mx-auto mt-10 w-full max-w-md bg-white p-5">
            <div className="drawer-header mb-3">
              <h2 className="text-xl font-semibold">Ajouter paiement</h2>
              <Button size="sm" variant="ghost" onClick={() => setPaymentInvoiceId("")}>Fermer</Button>
            </div>
            <div className="grid gap-3">
              <Input type="number" placeholder="Montant" value={paymentForm.amount} onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))} />
              <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm((s) => ({ ...s, payment_date: e.target.value }))} />
              <select className="input-field" value={paymentForm.method} onChange={(e) => setPaymentForm((s) => ({ ...s, method: e.target.value }))}>
                <option value="transfer">Virement</option>
                <option value="card">CB</option>
                <option value="cash">Espèces</option>
                <option value="check">Chèque</option>
              </select>
              <Input placeholder="Référence" value={paymentForm.reference} onChange={(e) => setPaymentForm((s) => ({ ...s, reference: e.target.value }))} />
              <Input placeholder="Notes" value={paymentForm.notes} onChange={(e) => setPaymentForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPaymentInvoiceId("")}>Annuler</Button>
              <Button onClick={addPayment}>Ajouter</Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
