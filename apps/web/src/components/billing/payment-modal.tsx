"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Invoice, Payment } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PaymentModal({
  open,
  invoice,
  onClose,
  onCreated,
}: {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onCreated: (payment: Payment) => void;
}) {
  const [amount, setAmount] = useState("");
  const [dateValue, setDateValue] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<Payment["method"]>("transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open || !invoice) return null;

  const submit = async () => {
    const numericAmount = Number(amount || "0");
    if (numericAmount <= 0) {
      setError("Montant invalide");
      return;
    }
    if (numericAmount > Number(invoice.balance_due || 0)) {
      setError("Le montant ne peut pas depasser le solde restant");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const payment = await api<Payment>(`/billing/invoices/${invoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: numericAmount,
          payment_date: dateValue,
          method,
          reference: reference || null,
          notes: notes || null,
        }),
      });
      onCreated(payment);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur paiement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50">
      <div className="modal-content modal-panel mx-auto mt-10 w-full max-w-md bg-white p-5">
        <h2 className="mb-3 text-xl font-semibold">Ajouter un paiement</h2>
        <div className="grid gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Montant</p>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Solde restant: {invoice.balance_due} MAD</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Date</p>
            <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Méthode</p>
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as Payment["method"])}>
              <option value="transfer">Virement</option>
              <option value="card">Carte bancaire</option>
              <option value="cash">Espèces</option>
              <option value="check">Chèque</option>
            </select>
          </div>
          <Input placeholder="Référence" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" onClick={submit} disabled={saving}>Enregistrer le paiement</Button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
