"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Account, Invoice, Lead, Quote } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuoteModal } from "@/components/billing/quote-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("fr-MA").format(value || 0)} MAD`;
}

function quoteStatusBadge(status: Quote["status"]): string {
  if (status === "accepted") return "badge badge-success";
  if (status === "sent") return "badge badge-primary";
  if (status === "rejected") return "badge badge-danger";
  if (status === "expired") return "badge badge-warning";
  return "badge badge-slate";
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [error, setError] = useState("");
  const [confirmState, setConfirmState] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    variant: "primary" | "danger" | "warning";
    onConfirm: () => Promise<void> | void;
  }>(null);

  const load = async () => {
    try {
      const [quoteRows, accountRows, invoiceRows, leadRows] = await Promise.all([
        api<Quote[]>("/billing/quotes"),
        api<Account[]>("/accounts"),
        api<Invoice[]>("/billing/invoices"),
        api<Lead[]>("/leads"),
      ]);
      setQuotes(quoteRows);
      setAccounts(accountRows);
      setInvoices(invoiceRows);
      setLeads(leadRows);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de chargement";
      setError(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();
    const bySearch = quotes.filter((quote) => {
      const client = accounts.find((account) => account.id === quote.client_id)?.name || "";
      return (
        !searchTerm ||
        quote.quote_number.toLowerCase().includes(searchTerm) ||
        client.toLowerCase().includes(searchTerm)
      );
    });
    const byStatus = statusFilter ? bySearch.filter((quote) => quote.status === statusFilter) : bySearch;
    const byClient = clientFilter ? byStatus.filter((quote) => quote.client_id === clientFilter) : byStatus;
    const byDate = byClient.filter((quote) => {
      const d = quote.issue_date;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
    return [...byDate].sort((a, b) => {
      if (sortBy === "amount_desc") return Number(b.total_ttc) - Number(a.total_ttc);
      if (sortBy === "amount_asc") return Number(a.total_ttc) - Number(b.total_ttc);
      if (sortBy === "date_asc") return a.issue_date.localeCompare(b.issue_date);
      return b.issue_date.localeCompare(a.issue_date);
    });
  }, [quotes, search, statusFilter, clientFilter, dateFrom, dateTo, sortBy, accounts]);

  const convertedQuoteIds = useMemo(() => new Set(invoices.map((invoice) => invoice.quote_id).filter(Boolean)), [invoices]);

  const kpis = useMemo(() => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const inProgress = quotes.filter((quote) => quote.status === "draft" || quote.status === "sent").length;
    const acceptedThisMonth = quotes.filter((quote) => {
      const d = new Date(quote.issue_date);
      return quote.status === "accepted" && d.getMonth() + 1 === month && d.getFullYear() === year;
    }).length;
    const expired = quotes.filter((quote) => quote.status === "expired").length;
    const waitingRevenue = quotes
      .filter((quote) => (quote.status === "sent" || quote.status === "accepted") && !convertedQuoteIds.has(quote.id))
      .reduce((sum, quote) => sum + Number(quote.total_ttc || 0), 0);
    return { inProgress, acceptedThisMonth, expired, waitingRevenue };
  }, [quotes, convertedQuoteIds]);

  const quoteFromLead = async () => {
    if (!selectedLeadId) return;
    try {
      await api(`/billing/quotes/${selectedLeadId}/from-lead`, { method: "POST" });
      setLeadModalOpen(false);
      setSelectedLeadId("");
      await load();
      toast.success("Devis créé depuis lead");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur création depuis lead";
      setError(message);
      toast.error(message);
    }
  };

  const sendQuote = async (quoteId: string) => {
    await api(`/billing/quotes/${quoteId}/send`, { method: "POST" });
    await load();
    toast.success("Devis envoyé au client");
  };

  const deleteQuote = async (quoteId: string) => {
    await api(`/billing/quotes/${quoteId}`, { method: "DELETE" });
    await load();
    toast.warning("Devis supprimé");
  };

  const convertQuote = async (quoteId: string) => {
    const invoice = await api<Invoice>(`/billing/quotes/${quoteId}/convert-to-invoice`, { method: "POST" });
    toast.success(`Facture ${invoice.invoice_number} créée`, {
      description: "Redirection vers la facture...",
      action: {
        label: "Voir",
        onClick: () => router.push(`/invoices/${invoice.id}`),
      },
      duration: 5000,
    });
    router.push(`/invoices/${invoice.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestion des Devis</h1>
          <p className="text-sm text-slate-500">Créer, envoyer et convertir vos propositions commerciales</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            Nouveau devis
          </Button>
          <Button variant="secondary" onClick={() => setLeadModalOpen(true)}>
            Créer depuis Lead
          </Button>
        </div>
      </div>

      <div className="kpi-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card priority="info"><p className="text-xs uppercase text-slate-500">Devis en cours</p><p className="text-2xl font-bold">{kpis.inProgress}</p></Card>
        <Card priority="success"><p className="text-xs uppercase text-slate-500">Acceptés ce mois</p><p className="text-2xl font-bold">{kpis.acceptedThisMonth}</p></Card>
        <Card priority="warning"><p className="text-xs uppercase text-slate-500">Expirés</p><p className="text-2xl font-bold">{kpis.expired}</p></Card>
        <Card priority="violet"><p className="text-xs uppercase text-slate-500">CA en attente</p><p className="text-2xl font-bold">{formatMoney(kpis.waitingRevenue)}</p></Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-3.5 text-slate-400" size={14} />
            <Input className="pl-9" placeholder="Recherche numéro ou client" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoyé</option>
            <option value="accepted">Accepté</option>
            <option value="rejected">Refusé</option>
            <option value="expired">Expiré</option>
          </select>
          <select className="input-field" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="">Tous clients</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <select className="input-field" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date_desc">Date ↓</option>
            <option value="date_asc">Date ↑</option>
            <option value="amount_desc">Montant ↓</option>
            <option value="amount_asc">Montant ↑</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="responsive-table min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Numéro</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Validité</th>
              <th className="px-4 py-3">Total HT</th>
              <th className="px-4 py-3">TVA</th>
              <th className="px-4 py-3">Total TTC</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((quote) => (
              <tr key={quote.id} className="border-t border-slate-100">
                <td className="px-4 py-3" data-label="Numéro">{quote.quote_number}</td>
                <td className="px-4 py-3" data-label="Client">{accounts.find((a) => a.id === quote.client_id)?.name || "—"}</td>
                <td className="px-4 py-3" data-label="Date">{quote.issue_date}</td>
                <td className="px-4 py-3" data-label="Validité">{quote.valid_until}</td>
                <td className="px-4 py-3" data-label="Total HT">{formatMoney(Number(quote.total_ht))}</td>
                <td className="px-4 py-3" data-label="TVA">{quote.tva_rate}%</td>
                <td className="px-4 py-3" data-label="Total TTC">{formatMoney(Number(quote.total_ttc))}</td>
                <td className="px-4 py-3" data-label="Statut"><span className={quoteStatusBadge(quote.status)}>{quote.status}</span></td>
                <td className="px-4 py-3" data-label="Actions">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/quotes/${quote.id}`} className="btn-secondary inline-flex h-11 items-center rounded-[var(--radius-md)] border px-3 text-sm">Voir</Link>
                    {quote.status === "draft" && (
                      <Button size="sm" variant="ghost" onClick={() => sendQuote(quote.id)}>Envoyer</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => window.open(`/api/v1/billing/quotes/${quote.id}/pdf`, "_blank")}>PDF</Button>
                    {quote.status === "accepted" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setConfirmState({
                            title: "Convertir en facture ?",
                            description: `Cette action créera une facture à partir du devis ${quote.quote_number}.`,
                            confirmLabel: "Convertir",
                            variant: "primary",
                            onConfirm: async () => {
                              await convertQuote(quote.id);
                              setConfirmState(null);
                            },
                          })
                        }
                      >
                        Convertir en facture
                      </Button>
                    )}
                    {quote.status === "draft" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmState({
                            title: "Supprimer le devis ?",
                            description: `Le devis ${quote.quote_number} sera supprimé définitivement.`,
                            confirmLabel: "Supprimer",
                            variant: "danger",
                            onConfirm: async () => {
                              await deleteQuote(quote.id);
                              setConfirmState(null);
                            },
                          })
                        }
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modalOpen && (
        <QuoteModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            void load();
          }}
        />
      )}

      {leadModalOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
          <div className="modal-content modal-panel mx-auto mt-16 w-full max-w-md bg-white p-5">
            <h2 className="mb-3 text-xl font-semibold">Créer depuis Lead</h2>
            <select className="input-field" value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)}>
              <option value="">Sélectionner un lead gagné</option>
              {leads.filter((lead) => lead.status === "won").map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.title}</option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setLeadModalOpen(false)}>Annuler</Button>
              <Button className="flex-1" onClick={quoteFromLead}>Créer</Button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title || ""}
        description={confirmState?.description || ""}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => void confirmState?.onConfirm()}
      />
    </div>
  );
}
