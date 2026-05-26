"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Account, Invoice, Quote } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QuoteModal } from "@/components/billing/quote-modal";
import { FileUpload } from "@/components/ui/file-upload";

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("fr-MA").format(value || 0)} MAD`;
}

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    variant: "primary" | "danger" | "warning";
    onConfirm: () => Promise<void> | void;
  }>(null);

  const load = useCallback(async () => {
    try {
      const quoteRow = await api<Quote>(`/billing/quotes/${id}`);
      setQuote(quoteRow);
      if (quoteRow.client_id) {
        const accounts = await api<Account[]>("/accounts");
        setAccount(accounts.find((row) => row.id === quoteRow.client_id) || null);
      }
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur chargement devis";
      setError(message);
      toast.error(message);
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  if (!quote) return <div className="p-4 text-sm text-slate-500">Chargement...</div>;

  const convert = async () => {
    const invoice = await api<Invoice>(`/billing/quotes/${quote.id}/convert-to-invoice`, { method: "POST" });
    toast.success(`Facture ${invoice.invoice_number} créée`, {
      action: {
        label: "Voir",
        onClick: () => router.push(`/invoices/${invoice.id}`),
      },
    });
    router.push(`/invoices/${invoice.id}`);
  };

  const sendDraftQuote = async () => {
    await api(`/billing/quotes/${quote.id}/send`, { method: "POST" });
    toast.success(`Devis ${quote.quote_number} envoyé au client`);
    await load();
  };

  const duplicate = async () => {
    const cloned = await api<Quote>(`/billing/quotes/${quote.id}/duplicate`, { method: "POST" });
    toast.success(`Devis ${cloned.quote_number} dupliqué`);
    router.push(`/quotes/${cloned.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/home" className="hover:underline">Accueil</Link> &gt; <Link href="/quotes" className="hover:underline">Devis</Link> &gt; {quote.quote_number}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <h1 className="text-2xl font-bold text-slate-900">{quote.quote_number}</h1>
            <p className="text-sm text-slate-500">{quote.issue_date} — validité {quote.valid_until}</p>
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Client</h2>
            <p className="font-medium text-slate-900">{account?.name || "Client"}</p>
            <p className="text-sm text-slate-500">{quote.client_id || "—"}</p>
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
                {quote.items.map((item, index) => (
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
          <Card className="bg-violet-50">
            <p className="text-sm text-slate-600">HT: {formatMoney(Number(quote.total_ht))}</p>
            <p className="text-sm text-slate-600">TVA: {formatMoney(Number(quote.tva_amount))}</p>
            <p className="text-xl font-bold text-violet-700">TTC: {formatMoney(Number(quote.total_ttc))}</p>
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Documents</h2>
            <FileUpload entityType="quote" entityId={quote.id} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="sticky top-24">
            <h2 className="mb-3 text-lg font-semibold">Actions rapides</h2>
            <div className="space-y-2">
              {quote.status === "draft" && <Button className="w-full" onClick={() => void sendDraftQuote()}>Envoyer</Button>}
              {quote.status === "draft" && <Button className="w-full" variant="secondary" onClick={() => setEditOpen(true)}>Modifier le devis</Button>}
              {(quote.status === "sent" || quote.status === "accepted") && (
                <Button
                  className="w-full"
                  onClick={() =>
                    setConfirmState({
                      title: "Convertir en facture ?",
                      description: `Le devis ${quote.quote_number} sera converti en facture.`,
                      confirmLabel: "Convertir",
                      variant: "primary",
                      onConfirm: async () => {
                        await convert();
                        setConfirmState(null);
                      },
                    })
                  }
                >
                  Convertir en facture
                </Button>
              )}
              {quote.status !== "draft" && (
                <Button className="w-full" variant="secondary" onClick={() => void duplicate()}>
                  Dupliquer le devis
                </Button>
              )}
              <Button variant="secondary" className="w-full" onClick={() => window.open(`/api/v1/billing/quotes/${quote.id}/pdf`, "_blank")}>Télécharger PDF</Button>
              {quote.status === "draft" && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() =>
                    setConfirmState({
                      title: "Supprimer le devis ?",
                      description: `Le devis ${quote.quote_number} sera supprimé définitivement.`,
                      confirmLabel: "Supprimer",
                      variant: "danger",
                      onConfirm: async () => {
                        await api(`/billing/quotes/${quote.id}`, { method: "DELETE" });
                        toast.warning("Devis supprimé");
                        router.push("/quotes");
                      },
                    })
                  }
                >
                  Supprimer
                </Button>
              )}
            </div>
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">Historique</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Créé le {quote.created_at ? new Date(quote.created_at).toLocaleString("fr-FR") : quote.issue_date}</li>
              <li>Statut actuel: {quote.status}</li>
            </ul>
          </Card>
        </div>
      </div>
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
      {editOpen && (
        <QuoteModal
          open={editOpen}
          quoteId={quote.id}
          onClose={() => setEditOpen(false)}
          onCreated={() => {
            setEditOpen(false);
            void load();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
