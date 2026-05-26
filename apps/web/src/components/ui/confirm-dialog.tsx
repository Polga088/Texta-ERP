"use client";

import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "primary",
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  const confirmVariant = variant === "danger" ? "danger" : "primary";

  return (
    <div className="modal-overlay fixed inset-0 z-[60] bg-slate-900/50">
      <div className="modal-content modal-panel mx-auto mt-20 w-full max-w-lg bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
