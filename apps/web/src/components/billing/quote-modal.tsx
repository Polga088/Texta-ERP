"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FileText, ListOrdered, Save, Send, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Account, Lead, ProductCatalogItem, Project, Quote } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QuoteStep = "client" | "lines" | "totals" | "preview";

type LineItem = {
  id: string;
  product_id?: string;
  description: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
};

const STEPS: Array<{ id: QuoteStep; label: string; icon: typeof User }> = [
  { id: "client", label: "Client", icon: User },
  { id: "lines", label: "Lignes", icon: ListOrdered },
  { id: "totals", label: "Totaux", icon: FileText },
  { id: "preview", label: "Aperçu", icon: Eye },
];

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("fr-MA").format(value || 0)} MAD`;
}

export function QuoteModal({
  open,
  onClose,
  onCreated,
  initialLead,
  quoteId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (quote: Quote) => void;
  initialLead?: Lead | null;
  quoteId?: string;
}) {
  const router = useRouter();
  const isEditMode = Boolean(quoteId);
  const [step, setStep] = useState<QuoteStep>("client");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [catalog, setCatalog] = useState<ProductCatalogItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [tvaRate, setTvaRate] = useState(20);
  const [lines, setLines] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", qty: 1, unit_price: 0, discount_percent: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingNumber, setEditingNumber] = useState("");

  useEffect(() => {
    if (!open) return;
    Promise.all([api<Account[]>("/accounts"), api<Project[]>("/projects")])
      .then(([accountRows, projectRows]) => {
        setAccounts(accountRows);
        setProjects(projectRows);
      })
      .catch(() => {
        setAccounts([]);
        setProjects([]);
      });
  }, [open]);

  useEffect(() => {
    if (!open || !quoteId) return;
    api<Quote>(`/billing/quotes/${quoteId}`)
      .then((quote) => {
        setEditingNumber(quote.quote_number);
        setSelectedClientId(quote.client_id || "");
        setIssueDate(quote.issue_date);
        setValidUntil(quote.valid_until);
        setNotes(quote.notes || "");
        setTvaRate(Number(quote.tva_rate || 20));
        setLines(
          (quote.items || []).map((item) => ({
            id: crypto.randomUUID(),
            product_id: item.product_id,
            description: item.description || "",
            qty: Number(item.qty || 1),
            unit_price: Number(item.unit_price || 0),
            discount_percent: Number(item.discount_percent || 0),
          })),
        );
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Erreur chargement devis";
        setError(message);
        toast.error(message);
      });
  }, [open, quoteId]);

  useEffect(() => {
    if (!open) return;
    if (!initialLead) return;
    setSelectedClientId(initialLead.account_id || "");
    setNotes((prev) => prev || `Créé depuis lead ${initialLead.title}`);
    if ((initialLead.deal_value || 0) > 0) {
      setLines([
        {
          id: crypto.randomUUID(),
          description: initialLead.product_service || initialLead.title,
          qty: 1,
          unit_price: Number(initialLead.deal_value || 0),
          discount_percent: 0,
        },
      ]);
    }
  }, [open, initialLead]);

  useEffect(() => {
    if (!open) return;
    const term = productSearch.trim();
    if (term.length < 2) {
      setCatalog([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const rows = await api<ProductCatalogItem[]>(`/billing/products/search?q=${encodeURIComponent(term)}`);
        setCatalog(rows);
      } catch {
        setCatalog([]);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productSearch, open]);

  const computed = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, line) => sum + line.qty * line.unit_price * (1 - line.discount_percent / 100),
      0,
    );
    const tvaAmount = subtotal * (tvaRate / 100);
    return {
      subtotal,
      tvaAmount,
      total: subtotal + tvaAmount,
    };
  }, [lines, tvaRate]);

  if (!open) return null;

  const upsertLine = (lineId: string, patch: Partial<LineItem>) => {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      { id: crypto.randomUUID(), description: "", qty: 1, unit_price: 0, discount_percent: 0 },
    ]);
  };

  const removeLine = (lineId: string) => {
    setLines((current) =>
      current.length <= 1
        ? current
        : current.filter((line) => line.id !== lineId),
    );
  };

  const selectProductForLine = (lineId: string, productId: string) => {
    const product = catalog.find((row) => row.id === productId);
    if (!product) return;
    upsertLine(lineId, {
      product_id: product.id,
      description: product.name,
      unit_price: Number(product.unit_price || 0),
    });
    setTvaRate(Number(product.tva_rate || tvaRate));
  };

  const submit = async (sendAfterCreate: boolean) => {
    try {
      setSaving(true);
      setError("");
      const payload = {
        lead_id: initialLead?.id || null,
        client_id: selectedClientId || null,
        issue_date: issueDate,
        valid_until: validUntil || null,
        tva_rate: tvaRate,
        notes: notes || null,
        items: lines.map((line) => ({
          product_id: line.product_id || null,
          description: line.description || "Ligne",
          qty: Number(line.qty || 1),
          unit_price: Number(line.unit_price || 0),
          discount_percent: Number(line.discount_percent || 0),
          total_ht: 0,
        })),
      };
      const created = isEditMode
        ? await api<Quote>(`/billing/quotes/${quoteId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await api<Quote>("/billing/quotes", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      if (sendAfterCreate) {
        await api(`/billing/quotes/${created.id}/send`, { method: "POST" });
        const refreshed = await api<Quote>(`/billing/quotes/${created.id}`);
        onCreated(refreshed);
        toast.success(`Devis ${refreshed.quote_number} envoyé au client`);
      } else {
        onCreated(created);
        toast.success(
          isEditMode
            ? `Devis ${created.quote_number} mis à jour`
            : `Devis ${created.quote_number} enregistré`,
        );
      }
      router.refresh();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de sauvegarde du devis";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const activeStepIndex = STEPS.findIndex((entry) => entry.id === step);
  const progress = ((activeStepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
      <div className="modal-content modal-panel mx-auto mt-8 w-full max-w-5xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {isEditMode ? `Modifier ${editingNumber || "devis"}` : "Nouveau Devis"}
          </h2>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
        </div>
        <div className="mb-3 h-1.5 w-full rounded-full bg-slate-100">
          <div className="h-1.5 rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {STEPS.map((entry) => {
            const Icon = entry.icon;
            const active = entry.id === step;
            return (
              <Button key={entry.id} size="sm" variant={active ? "primary" : "secondary"} onClick={() => setStep(entry.id)}>
                <Icon size={14} />
                {entry.label}
              </Button>
            );
          })}
        </div>

        {step === "client" && (
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="input-field md:col-span-2"
              value={selectedClientId}
              disabled={!!initialLead?.account_id}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Sélectionner un client</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            <select className="input-field md:col-span-2" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">Projet associé (optionnel)</option>
              {projects
                .filter((project) => !selectedClientId || project.account_id === selectedClientId)
                .map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
            </select>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            <Input className="md:col-span-2" placeholder="Notes internes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}

        {step === "lines" && (
          <div className="space-y-3">
            <Input
              placeholder="Rechercher un produit (2 caractères min)"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Qté</th>
                    <th className="px-3 py-2 text-left">Prix unit.</th>
                    <th className="px-3 py-2 text-left">Remise %</th>
                    <th className="px-3 py-2 text-left">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const lineTotal = line.qty * line.unit_price * (1 - line.discount_percent / 100);
                    return (
                      <tr key={line.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <div className="space-y-2">
                            <select
                              className="input-field"
                              value={line.product_id || ""}
                              onChange={(e) => selectProductForLine(line.id, e.target.value)}
                            >
                              <option value="">Produit (optionnel)</option>
                              {catalog.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.sku} — {product.name}
                                </option>
                              ))}
                            </select>
                            <Input
                              placeholder="Description"
                              value={line.description}
                              onChange={(e) => upsertLine(line.id, { description: e.target.value })}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="1" step="0.5" value={line.qty} onChange={(e) => upsertLine(line.id, { qty: Number(e.target.value || "1") })} />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => upsertLine(line.id, { unit_price: Number(e.target.value || "0") })} />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" max="100" step="0.01" value={line.discount_percent} onChange={(e) => upsertLine(line.id, { discount_percent: Number(e.target.value || "0") })} />
                        </td>
                        <td className="px-3 py-2 font-semibold">{formatMoney(lineTotal)}</td>
                        <td className="px-3 py-2">
                          <Button variant="ghost" onClick={() => removeLine(line.id)}>Supprimer</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button variant="secondary" onClick={addLine}>Ajouter une ligne</Button>
          </div>
        )}

        {step === "totals" && (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={tvaRate}
              onChange={(e) => setTvaRate(Number(e.target.value || "20"))}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Sous-total HT</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(computed.subtotal)}</p>
              <p className="mt-2 text-sm text-slate-500">TVA ({tvaRate}%)</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(computed.tvaAmount)}</p>
              <p className="mt-2 text-sm text-slate-500">Total TTC</p>
              <p className="text-2xl font-bold text-violet-700">{formatMoney(computed.total)}</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Aperçu Devis</p>
            <p className="text-lg font-semibold text-slate-900">
              Client: {accounts.find((account) => account.id === selectedClientId)?.name || "—"}
            </p>
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                  <span className="text-sm text-slate-700">{line.description || "Ligne"}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {line.qty} × {formatMoney(line.unit_price)} = {formatMoney(line.qty * line.unit_price * (1 - line.discount_percent / 100))}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xl font-bold text-violet-700">Total TTC: {formatMoney(computed.total)}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="secondary" disabled={saving || !selectedClientId} onClick={() => submit(false)}>
            <Save size={14} />
            {isEditMode ? "Enregistrer les modifications" : "Enregistrer brouillon"}
          </Button>
          <Button disabled={saving || !selectedClientId} onClick={() => submit(true)}>
            <Send size={14} />
            Enregistrer & Envoyer
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
