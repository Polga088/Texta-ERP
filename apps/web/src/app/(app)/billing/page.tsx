"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, File, FileImage, FileText, Package, Paperclip, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { BillingAttachment, BillingKpis, Invoice, Payment, ProductCatalogItem, Quote } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "quotes" | "invoices" | "payments" | "catalog";

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("fr-MA").format(value || 0)} MAD`;
}

function statusClass(status: string): string {
  if (status === "paid" || status === "accepted") return "badge badge-success";
  if (status === "overdue") return "badge badge-danger animate-pulse";
  if (status === "partial") return "badge badge-warning";
  if (status === "sent") return "badge badge-primary";
  if (status === "cancelled") return "badge badge-slate line-through";
  return "badge badge-slate";
}

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>("quotes");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [kpis, setKpis] = useState<BillingKpis | null>(null);
  const [error, setError] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>("");
  const [productOpen, setProductOpen] = useState(false);
  const [attachmentTarget, setAttachmentTarget] = useState<{
    kind: "quotes" | "invoices";
    id: string;
    label: string;
  } | null>(null);
  const [attachments, setAttachments] = useState<BillingAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentSearch, setAttachmentSearch] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState<"pdf" | "image" | "other" | "">("");
  const [quoteForm, setQuoteForm] = useState({
    lead_id: "",
    client_id: "",
    issue_date: "",
    valid_until: "",
    product_id: "",
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
    product_id: "",
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
  const [productForm, setProductForm] = useState({
    sku: "",
    name: "",
    category: "",
    description: "",
    unit_price: "0",
    tva_rate: "20",
  });

  const load = async () => {
    try {
      const [quoteRows, invoiceRows, paymentRows, productRows, kpiRows] = await Promise.all([
        api<Quote[]>("/billing/quotes"),
        api<Invoice[]>("/billing/invoices"),
        api<Payment[]>("/billing/payments"),
        api<ProductCatalogItem[]>("/billing/products"),
        api<BillingKpis>("/billing/kpis"),
      ]);
      setQuotes(quoteRows);
      setInvoices(invoiceRows);
      setPayments(paymentRows);
      setProducts(productRows);
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
  const activeProducts = useMemo(() => products.filter((product) => product.is_active), [products]);
  const filteredAttachments = useMemo(() => {
    const term = attachmentSearch.trim().toLowerCase();
    if (!term) return attachments;
    return attachments.filter((attachment) => attachment.original_filename.toLowerCase().includes(term));
  }, [attachments, attachmentSearch]);

  const fileMeta = (filename: string, contentType?: string) => {
    const lower = filename.toLowerCase();
    if (contentType?.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => lower.endsWith(ext))) {
      return { label: "Image", Icon: FileImage, className: "text-emerald-600 bg-emerald-50" };
    }
    if (contentType?.includes("pdf") || lower.endsWith(".pdf")) {
      return { label: "PDF", Icon: FileText, className: "text-rose-600 bg-rose-50" };
    }
    if (lower.endsWith(".docx")) {
      return { label: "DOCX", Icon: FileText, className: "text-indigo-600 bg-indigo-50" };
    }
    if (lower.endsWith(".xlsx")) {
      return { label: "XLSX", Icon: File, className: "text-amber-600 bg-amber-50" };
    }
    if (lower.endsWith(".txt")) {
      return { label: "TXT", Icon: FileText, className: "text-slate-600 bg-slate-100" };
    }
    return { label: "Fichier", Icon: File, className: "text-slate-600 bg-slate-100" };
  };

  const applyQuoteProduct = (productId: string) => {
    const selected = activeProducts.find((product) => product.id === productId);
    setQuoteForm((state) => ({
      ...state,
      product_id: productId,
      item_description: selected?.name || state.item_description,
      unit_price: selected ? String(selected.unit_price || 0) : state.unit_price,
      tva_rate: selected ? String(selected.tva_rate || 20) : state.tva_rate,
    }));
  };

  const applyInvoiceProduct = (productId: string) => {
    const selected = activeProducts.find((product) => product.id === productId);
    setInvoiceForm((state) => ({
      ...state,
      product_id: productId,
      item_description: selected?.name || state.item_description,
      unit_price: selected ? String(selected.unit_price || 0) : state.unit_price,
      tva_rate: selected ? String(selected.tva_rate || 20) : state.tva_rate,
    }));
  };

  const downloadPdf = async (path: string, fallbackFilename: string) => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/v1${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error("Téléchargement PDF impossible");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fallbackFilename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur téléchargement PDF");
    }
  };

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
              product_id: quoteForm.product_id || null,
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
        product_id: "",
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
              product_id: invoiceForm.product_id || null,
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
        product_id: "",
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

  const loadAttachments = async (target: { kind: "quotes" | "invoices"; id: string; label: string }) => {
    try {
      const rows = await api<BillingAttachment[]>(`/billing/${target.kind}/${target.id}/attachments`);
      setAttachments(rows);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement documents");
    }
  };

  const openAttachments = async (kind: "quotes" | "invoices", id: string, label: string) => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl("");
    setPreviewName("");
    setPreviewType("");
    setAttachmentSearch("");
    const target = { kind, id, label };
    setAttachmentTarget(target);
    await loadAttachments(target);
  };

  const uploadAttachment = async (file: File) => {
    if (!attachmentTarget) return;
    try {
      setUploadingAttachment(true);
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/v1/billing/${attachmentTarget.kind}/${attachmentTarget.id}/attachments`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Upload impossible");
      }
      await loadAttachments(attachmentTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload document");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const downloadAttachment = async (attachmentId: string, filename: string) => {
    await downloadPdf(`/billing/attachments/${attachmentId}/download`, filename);
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!attachmentTarget) return;
    try {
      await api(`/billing/attachments/${attachmentId}`, { method: "DELETE" });
      await loadAttachments(attachmentTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur suppression document");
    }
  };

  const previewAttachment = async (attachmentId: string, filename: string) => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/v1/billing/attachments/${attachmentId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error("Prévisualisation indisponible");
      }
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
      setPreviewName(filename);
      setPreviewUrl(url);
      if (contentType.includes("pdf")) {
        setPreviewType("pdf");
      } else if (contentType.startsWith("image/")) {
        setPreviewType("image");
      } else {
        setPreviewType("other");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur prévisualisation document");
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const createProduct = async () => {
    try {
      await api("/billing/products", {
        method: "POST",
        body: JSON.stringify({
          sku: productForm.sku,
          name: productForm.name,
          category: productForm.category || null,
          description: productForm.description || null,
          unit_price: Number(productForm.unit_price || "0"),
          tva_rate: Number(productForm.tva_rate || "20"),
          is_active: true,
        }),
      });
      setProductOpen(false);
      setProductForm({
        sku: "",
        name: "",
        category: "",
        description: "",
        unit_price: "0",
        tva_rate: "20",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création produit");
    }
  };

  const acceptQuote = async (quoteId: string) => {
    await api(`/billing/quotes/${quoteId}/accept`, { method: "POST" });
    await load();
  };

  const sendQuote = async (quoteId: string) => {
    await api(`/billing/quotes/${quoteId}/send`, { method: "POST" });
    await load();
  };

  const deleteQuote = async (quoteId: string) => {
    await api(`/billing/quotes/${quoteId}`, { method: "DELETE" });
    await load();
  };

  const convertQuote = async (quoteId: string) => {
    await api(`/billing/quotes/${quoteId}/convert-to-invoice`, { method: "POST" });
    await load();
    setTab("invoices");
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Facturation & Devis</h1>
          <p className="text-sm text-slate-500">Gérez devis, factures et paiements depuis le pipeline gagné.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setProductOpen(true)}>
            <Plus size={16} />
            Nouveau produit
          </Button>
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
          <Button size="sm" variant={tab === "catalog" ? "primary" : "secondary"} onClick={() => setTab("catalog")}>
            <Package size={16} />
            Catalogue
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
                  <td className="px-4 py-3" data-label="Statut">
                    <span className={statusClass(row.status)}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3" data-label="Actions">
                    <div className="flex gap-2">
                      {row.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => sendQuote(row.id)}>
                          Envoyer
                        </Button>
                      )}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadPdf(`/billing/quotes/${row.id}/pdf`, `${row.quote_number}.pdf`)}
                      >
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openAttachments("quotes", row.id, row.quote_number)}
                      >
                        <Paperclip size={14} />
                        Docs
                      </Button>
                      {row.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => deleteQuote(row.id)}>
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
                  <td className="px-4 py-3" data-label="Statut">
                    <span className={statusClass(row.status)}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3" data-label="Paiement">
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setPaymentInvoiceId(row.id)}>
                        Ajouter paiement
                      </Button>
                      {row.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => sendInvoice(row.id)}>
                          Envoyer
                        </Button>
                      )}
                      {row.status !== "cancelled" && row.status !== "paid" && (
                        <Button size="sm" variant="ghost" onClick={() => cancelInvoice(row.id)}>
                          Annuler
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadPdf(`/billing/invoices/${row.id}/pdf`, `${row.invoice_number}.pdf`)}
                      >
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openAttachments("invoices", row.id, row.invoice_number)}
                      >
                        <Paperclip size={14} />
                        Docs
                      </Button>
                      {row.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => deleteInvoice(row.id)}>
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

      {tab === "catalog" && (
        <Card className="overflow-x-auto p-0">
          <table className="responsive-table min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Prix unitaire</th>
                <th className="px-4 py-3">TVA</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {products.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3" data-label="SKU">{row.sku}</td>
                  <td className="px-4 py-3" data-label="Nom">{row.name}</td>
                  <td className="px-4 py-3" data-label="Catégorie">{row.category || "—"}</td>
                  <td className="px-4 py-3" data-label="Prix unitaire">{formatMoney(row.unit_price)}</td>
                  <td className="px-4 py-3" data-label="TVA">{row.tva_rate}%</td>
                  <td className="px-4 py-3" data-label="Statut">{row.is_active ? "Actif" : "Archivé"}</td>
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
              <select className="input-field md:col-span-2" value={quoteForm.product_id} onChange={(e) => applyQuoteProduct(e.target.value)}>
                <option value="">Produit libre</option>
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} — {product.name}
                  </option>
                ))}
              </select>
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
              <select className="input-field md:col-span-2" value={invoiceForm.product_id} onChange={(e) => applyInvoiceProduct(e.target.value)}>
                <option value="">Produit libre</option>
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} — {product.name}
                  </option>
                ))}
              </select>
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

      {productOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
          <div className="modal-content modal-panel mx-auto mt-10 w-full max-w-xl bg-white p-5">
            <div className="drawer-header mb-3">
              <h2 className="text-xl font-semibold">Nouveau produit / service</h2>
              <Button size="sm" variant="ghost" onClick={() => setProductOpen(false)}>Fermer</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="SKU" value={productForm.sku} onChange={(e) => setProductForm((s) => ({ ...s, sku: e.target.value }))} />
              <Input placeholder="Nom" value={productForm.name} onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))} />
              <Input placeholder="Catégorie" value={productForm.category} onChange={(e) => setProductForm((s) => ({ ...s, category: e.target.value }))} />
              <Input type="number" placeholder="Prix unitaire" value={productForm.unit_price} onChange={(e) => setProductForm((s) => ({ ...s, unit_price: e.target.value }))} />
              <Input type="number" placeholder="TVA %" value={productForm.tva_rate} onChange={(e) => setProductForm((s) => ({ ...s, tva_rate: e.target.value }))} />
              <Input className="md:col-span-2" placeholder="Description" value={productForm.description} onChange={(e) => setProductForm((s) => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setProductOpen(false)}>Annuler</Button>
              <Button onClick={createProduct}>Créer</Button>
            </div>
          </div>
        </div>
      )}

      {attachmentTarget && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
          <div className="modal-content modal-panel mx-auto mt-10 w-full max-w-2xl bg-white p-5">
            <div className="drawer-header mb-3">
              <h2 className="text-xl font-semibold">Documents — {attachmentTarget.label}</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (previewUrl) {
                    window.URL.revokeObjectURL(previewUrl);
                  }
                  setPreviewUrl("");
                  setPreviewName("");
                  setPreviewType("");
                  setAttachmentTarget(null);
                }}
              >
                Fermer
              </Button>
            </div>
            <div className="mb-4 flex items-center gap-2">
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void uploadAttachment(file);
                    e.currentTarget.value = "";
                  }
                }}
              />
              <span className="text-xs text-slate-500">{uploadingAttachment ? "Upload..." : "Max 10 MB"}</span>
            </div>
            <div className="mb-3">
              <Input
                placeholder="Rechercher un document..."
                value={attachmentSearch}
                onChange={(e) => setAttachmentSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              {filteredAttachments.length === 0 && <p className="text-sm text-slate-500">Aucun document pour le moment.</p>}
              {filteredAttachments.map((attachment) => {
                const meta = fileMeta(attachment.original_filename, attachment.content_type);
                return (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.className}`}>
                      <meta.Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{attachment.original_filename}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{Math.max(1, Math.round((attachment.size_bytes || 0) / 1024))} Ko</span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px]">{meta.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => previewAttachment(attachment.id, attachment.original_filename)}
                    >
                      <Eye size={14} />
                      Aperçu
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadAttachment(attachment.id, attachment.original_filename)}
                    >
                      <Download size={14} />
                      Télécharger
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeAttachment(attachment.id)}>
                      <Trash2 size={14} />
                      Supprimer
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
            {previewUrl && (
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium text-slate-900">Prévisualisation: {previewName}</p>
                {previewType === "pdf" && (
                  <iframe title="Aperçu PDF" src={previewUrl} className="h-[420px] w-full rounded-lg border border-slate-200" />
                )}
                {previewType === "image" && (
                  <iframe title="Aperçu image" src={previewUrl} className="h-[420px] w-full rounded-lg border border-slate-200" />
                )}
                {previewType === "other" && (
                  <p className="text-sm text-slate-500">Aperçu non disponible pour ce type de fichier. Utilisez Télécharger.</p>
                )}
              </div>
            )}
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
