"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ProductCatalogItem } from "@/types";

export type QuoteEditorLine = {
  id: string;
  product_id?: string;
  description: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  sort_order: number;
};

function SortableLine({
  line,
  catalog,
  onUpdate,
  onDelete,
  onSelectProduct,
}: {
  line: QuoteEditorLine;
  catalog: ProductCatalogItem[];
  onUpdate: (lineId: string, patch: Partial<QuoteEditorLine>) => void;
  onDelete: (lineId: string) => void;
  onSelectProduct: (lineId: string, productId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: line.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const lineTotal = line.qty * line.unit_price * (1 - line.discount_percent / 100);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 text-slate-400 transition-colors hover:text-slate-600 active:cursor-grabbing"
      >
        <GripVertical size={18} />
      </div>
      <div className="grid flex-1 grid-cols-12 gap-2">
        <div className="col-span-12 space-y-1 md:col-span-5">
          <select
            className="input-field h-9 w-full text-sm"
            value={line.product_id || ""}
            onChange={(e) => onSelectProduct(line.id, e.target.value)}
          >
            <option value="">Produit (optionnel)</option>
            {catalog.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} - {product.name}
              </option>
            ))}
          </select>
          <Input
            value={line.description}
            onChange={(e) => onUpdate(line.id, { description: e.target.value })}
            placeholder="Description du produit/service"
            className="h-9"
          />
        </div>
        <div className="col-span-4 md:col-span-2">
          <Input
            type="number"
            min="0.5"
            step="0.5"
            value={line.qty}
            onChange={(e) => onUpdate(line.id, { qty: Number(e.target.value || "1") })}
            className="h-9 text-center"
          />
        </div>
        <div className="col-span-4 md:col-span-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={line.unit_price}
            onChange={(e) => onUpdate(line.id, { unit_price: Number(e.target.value || "0") })}
            className="h-9"
          />
        </div>
        <div className="col-span-4 md:col-span-2">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={line.discount_percent}
            onChange={(e) => onUpdate(line.id, { discount_percent: Number(e.target.value || "0") })}
            className="h-9 text-center"
          />
        </div>
        <div className="col-span-12 flex items-center justify-end md:col-span-1">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {new Intl.NumberFormat("fr-MA").format(lineTotal)} MAD
          </span>
        </div>
      </div>
      <button
        onClick={() => onDelete(line.id)}
        className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-900/20"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function QuoteLinesEditor({
  lines,
  catalog,
  onLinesChange,
  onSelectProduct,
}: {
  lines: QuoteEditorLine[];
  catalog: ProductCatalogItem[];
  onLinesChange: (lines: QuoteEditorLine[]) => void;
  onSelectProduct: (lineId: string, productId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reindex = (rows: QuoteEditorLine[]) => rows.map((line, index) => ({ ...line, sort_order: index }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lines.findIndex((line) => line.id === active.id);
    const newIndex = lines.findIndex((line) => line.id === over.id);
    onLinesChange(reindex(arrayMove(lines, oldIndex, newIndex)));
  };

  const handleUpdate = (lineId: string, patch: Partial<QuoteEditorLine>) => {
    onLinesChange(lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const handleDelete = (lineId: string) => {
    if (lines.length <= 1) {
      toast.error("Au moins une ligne est requise");
      return;
    }
    onLinesChange(reindex(lines.filter((line) => line.id !== lineId)));
  };

  const handleAdd = () => {
    onLinesChange(
      reindex([
        ...lines,
        {
          id: crypto.randomUUID(),
          description: "",
          qty: 1,
          unit_price: 0,
          discount_percent: 0,
          sort_order: lines.length,
        },
      ]),
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <div className="col-span-12 md:col-span-5">Description</div>
        <div className="col-span-4 text-center md:col-span-2">Qté</div>
        <div className="col-span-4 md:col-span-2">Prix unit.</div>
        <div className="col-span-4 text-center md:col-span-2">Remise</div>
        <div className="col-span-12 text-right md:col-span-1">Total</div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={lines.map((line) => line.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {lines.map((line) => (
              <SortableLine
                key={line.id}
                line={line}
                catalog={catalog}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        onClick={handleAdd}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:hover:border-violet-500"
      >
        + Ajouter une ligne
      </button>
    </div>
  );
}
