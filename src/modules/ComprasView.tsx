import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import {
  COMMON_UNITS,
  InventoryItemType,
  MATERIAL_CATEGORIES,
  MaterialCategory,
  Purchase,
} from '../types';
import { formatCOP, formatDate, formatNumber, getTodayISO } from '../utils/format';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { NumberInput } from '../components/ui/NumberInput';

function formatCleanDecimal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return String(Math.round(value * 1000) / 1000);
}

export const ComprasView: React.FC = () => {
  const {
    data,
    addPurchase,
    updatePurchase,
    deletePurchase,
    preselectedPurchaseMaterialId,
    setPreselectedPurchaseMaterialId,
    autoOpenCreateFor,
    setAutoOpenCreateFor,
    addToast,
  } = useDinemelly();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'total_desc'>('date_desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);

  // Campos del formulario
  const [modeMaterial, setModeMaterial] = useState<'nuevo' | 'existente'>('nuevo');
  const [existingItemId, setExistingItemId] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('Hilos y lanas');
  const [itemType, setItemType] = useState<InventoryItemType>('consumible');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('g');
  const [hasRealContentConversion, setHasRealContentConversion] = useState(false);
  const [contentPerUnit, setContentPerUnit] = useState('');
  const [realTotalQty, setRealTotalQty] = useState('');
  const [realUnit, setRealUnit] = useState('g');
  const [totalPrice, setTotalPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [invoiceRef, setInvoiceRef] = useState('');
  const [observations, setObservations] = useState('');
  const [minStock, setMinStock] = useState('100');
  const [formError, setFormError] = useState('');

  const selectedInvItem = useMemo(
    () => data.inventory.find((i) => i.id === existingItemId),
    [data.inventory, existingItemId]
  );

  const openNewModal = (preselectedInvId?: string) => {
    setEditingPurchase(null);
    setFormError('');
    if (preselectedInvId) {
      const inv = data.inventory.find((i) => i.id === preselectedInvId);
      if (inv) {
        setModeMaterial('existente');
        setExistingItemId(inv.id);
        setMaterialName(inv.name);
        setCategory(inv.category);
        setItemType(inv.itemType);
        setUnit(inv.unit);
        setRealUnit(inv.unit);
        setMinStock(String(inv.minStock));
      }
    } else {
      setModeMaterial('nuevo');
      setExistingItemId('');
      setMaterialName('');
      setCategory('Hilos y lanas');
      setItemType('consumible');
      setUnit('g');
      setRealUnit('g');
      setMinStock('100');
    }
    setQuantity('');
    setHasRealContentConversion(false);
    setContentPerUnit('');
    setRealTotalQty('');
    setTotalPrice('');
    setSupplier('');
    setDate(getTodayISO());
    setInvoiceRef('');
    setObservations('');
    setFormOpen(true);
  };

  useEffect(() => {
    if (preselectedPurchaseMaterialId) {
      openNewModal(preselectedPurchaseMaterialId);
      setPreselectedPurchaseMaterialId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPurchaseMaterialId]);

  useEffect(() => {
    if (autoOpenCreateFor === 'compras') {
      openNewModal();
      setAutoOpenCreateFor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreateFor]);

  const openEditModal = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setFormError('');
    setModeMaterial('existente');
    setExistingItemId(purchase.inventoryItemId);
    setMaterialName(purchase.materialName);
    setCategory(purchase.category);
    setItemType(purchase.itemType);

    const hasConversion = Boolean(
      purchase.purchasedQuantity !== undefined &&
        purchase.purchasedUnit !== undefined &&
        (purchase.purchasedQuantity !== purchase.quantity ||
          purchase.purchasedUnit !== purchase.unit ||
          (purchase.contentPerUnit !== undefined && purchase.contentPerUnit > 0))
    );

    if (hasConversion && purchase.purchasedQuantity && purchase.purchasedUnit) {
      setHasRealContentConversion(true);
      setQuantity(String(purchase.purchasedQuantity));
      setUnit(purchase.purchasedUnit);
      setRealUnit(purchase.unit);
      setRealTotalQty(String(purchase.quantity));
      setContentPerUnit(
        purchase.contentPerUnit && purchase.contentPerUnit > 0
          ? String(purchase.contentPerUnit)
          : formatCleanDecimal(purchase.quantity / purchase.purchasedQuantity)
      );
    } else {
      setHasRealContentConversion(false);
      setQuantity(String(purchase.quantity));
      setUnit(purchase.unit);
      setRealUnit(purchase.unit);
      setContentPerUnit('');
      setRealTotalQty('');
    }

    setTotalPrice(String(purchase.totalPrice));
    setSupplier(purchase.supplier);
    setDate(purchase.date);
    setInvoiceRef(purchase.invoiceRef);
    setObservations(purchase.observations);
    setFormOpen(true);
  };

  const handleSelectExistingItem = (id: string) => {
    setExistingItemId(id);
    const found = data.inventory.find((i) => i.id === id);
    if (found) {
      setMaterialName(found.name);
      setCategory(found.category);
      setItemType(found.itemType);
      setRealUnit(found.unit);
      if (!hasRealContentConversion) {
        setUnit(found.unit);
      }
      setMinStock(String(found.minStock));
    }
  };

  const handlePurchasedQtyChange = (valStr: string) => {
    setQuantity(valStr);
    if (!hasRealContentConversion) return;
    const pQty = parseFloat(valStr);
    const perUnit = parseFloat(contentPerUnit);
    const rTotal = parseFloat(realTotalQty);
    if (Number.isFinite(pQty) && pQty > 0) {
      if (Number.isFinite(perUnit) && perUnit > 0) {
        setRealTotalQty(formatCleanDecimal(pQty * perUnit));
      } else if (Number.isFinite(rTotal) && rTotal > 0) {
        setContentPerUnit(formatCleanDecimal(rTotal / pQty));
      }
    } else if (contentPerUnit.trim() !== '') {
      setRealTotalQty('');
    }
  };

  const handleContentPerUnitChange = (valStr: string) => {
    setContentPerUnit(valStr);
    const pQty = parseFloat(quantity);
    const perUnit = parseFloat(valStr);
    if (Number.isFinite(pQty) && pQty > 0 && Number.isFinite(perUnit) && perUnit > 0) {
      setRealTotalQty(formatCleanDecimal(pQty * perUnit));
    } else if (valStr.trim() === '') {
      setRealTotalQty('');
    }
  };

  const handleRealTotalQtyChange = (valStr: string) => {
    setRealTotalQty(valStr);
    const pQty = parseFloat(quantity);
    const rTotal = parseFloat(valStr);
    if (Number.isFinite(pQty) && pQty > 0 && Number.isFinite(rTotal) && rTotal > 0) {
      setContentPerUnit(formatCleanDecimal(rTotal / pQty));
    } else if (valStr.trim() === '') {
      setContentPerUnit('');
    }
  };

  const handleToggleRealConversion = (checked: boolean) => {
    setHasRealContentConversion(checked);
    if (checked) {
      const targetRealUnit =
        editingPurchase?.unit ||
        (modeMaterial === 'existente' && selectedInvItem ? selectedInvItem.unit : realUnit || 'g');
      setRealUnit(targetRealUnit);
      if (unit === 'g' || unit === 'm') {
        setUnit('rollos');
      }
      const pQty = parseFloat(quantity);
      const perUnit = parseFloat(contentPerUnit);
      if (Number.isFinite(pQty) && pQty > 0 && Number.isFinite(perUnit) && perUnit > 0) {
        setRealTotalQty(formatCleanDecimal(pQty * perUnit));
      }
    } else {
      if (editingPurchase) {
        setUnit(editingPurchase.unit);
      } else if (modeMaterial === 'existente' && selectedInvItem) {
        setUnit(selectedInvItem.unit);
      }
    }
  };

  const effectiveRealUnit = useMemo(() => {
    if (hasRealContentConversion) {
      if (editingPurchase) return editingPurchase.unit;
      if (modeMaterial === 'existente' && selectedInvItem) return selectedInvItem.unit;
      return realUnit;
    }
    if (editingPurchase) return editingPurchase.unit;
    if (modeMaterial === 'existente' && selectedInvItem) return selectedInvItem.unit;
    return unit;
  }, [hasRealContentConversion, editingPurchase, modeMaterial, selectedInvItem, realUnit, unit]);

  const parsedPurchasedQty = parseFloat(quantity);
  const parsedRealTotalQty = parseFloat(realTotalQty);
  const effectiveInventoryQty = hasRealContentConversion ? parsedRealTotalQty : parsedPurchasedQty;
  const parsedTotal = parseFloat(totalPrice);
  const calculatedUnitCost =
    Number.isFinite(effectiveInventoryQty) &&
    effectiveInventoryQty > 0 &&
    Number.isFinite(parsedTotal) &&
    parsedTotal > 0
      ? parsedTotal / effectiveInventoryQty
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (modeMaterial === 'existente' && !existingItemId && !editingPurchase) {
      setFormError('Selecciona un material existente del inventario o cambia a "Material nuevo".');
      return;
    }

    if (!Number.isFinite(parsedPurchasedQty) || parsedPurchasedQty <= 0) {
      setFormError('La cantidad comprada debe ser mayor a cero.');
      return;
    }

    let finalInventoryQty = parsedPurchasedQty;
    let finalContentPerUnit: number | undefined = undefined;

    if (hasRealContentConversion) {
      if (!Number.isFinite(parsedRealTotalQty) || parsedRealTotalQty <= 0) {
        setFormError(
          'Ingresa el contenido real por unidad o el total real de material que entra al inventario.'
        );
        return;
      }
      finalInventoryQty = Math.round(parsedRealTotalQty * 1000) / 1000;
      const parsedPerUnit = parseFloat(contentPerUnit);
      finalContentPerUnit =
        Number.isFinite(parsedPerUnit) && parsedPerUnit > 0
          ? Math.round(parsedPerUnit * 1000) / 1000
          : Math.round((finalInventoryQty / parsedPurchasedQty) * 1000) / 1000;
    }

    const payload = {
      materialName:
        modeMaterial === 'existente' && selectedInvItem ? selectedInvItem.name : materialName,
      existingItemId: modeMaterial === 'existente' ? existingItemId : undefined,
      category,
      itemType,
      quantity: finalInventoryQty,
      unit: effectiveRealUnit,
      purchasedQuantity: Math.round(parsedPurchasedQty * 1000) / 1000,
      purchasedUnit: hasRealContentConversion ? unit : effectiveRealUnit,
      contentPerUnit: finalContentPerUnit,
      totalPrice: parseFloat(totalPrice),
      supplier,
      date,
      invoiceRef,
      observations,
      minStock: parseFloat(minStock) || 10,
    };

    const res = editingPurchase
      ? updatePurchase(editingPurchase.id, payload)
      : addPurchase(payload);

    if (!res.ok) {
      setFormError(res.error || 'Verifica los datos ingresados.');
      return;
    }
    setFormOpen(false);
  };

  const filteredPurchases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.purchases
      .filter((p) => {
        if (categoryFilter !== 'todas' && p.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          p.materialName.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.supplier.toLowerCase().includes(q) ||
          p.invoiceRef.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
        if (sortBy === 'total_desc') return b.totalPrice - a.totalPrice;
        return b.date.localeCompare(a.date) || b.code.localeCompare(a.code);
      });
  }, [data.purchases, search, categoryFilter, sortBy]);

  const totalSpentFiltered = filteredPurchases.reduce((s, p) => s + p.totalPrice, 0);

  return (
    <div className="space-y-6">
      {/* Barra superior de acciones y filtros */}
      <div className="bg-white border border-[#E7E3DC] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="block text-xs text-[#6E675F]">Compras registradas</span>
              <span className="text-lg font-bold font-mono tabular-nums text-[#1F1C19]">
                {filteredPurchases.length}
              </span>
            </div>
            <div className="h-8 w-px bg-[#E7E3DC]" />
            <div>
              <span className="block text-xs text-[#6E675F]">Total invertido (vista actual)</span>
              <span className="text-lg font-bold font-mono tabular-nums text-[#1F1C19]">
                {formatCOP(totalSpentFiltered)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openNewModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#AF8064] hover:bg-[#976B51] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar compra</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E7E3DC]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar material, proveedor o factura..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoría"
            className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
          >
            <option value="todas">Todas las categorías</option>
            {MATERIAL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Ordenar compras"
            className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
          >
            <option value="date_desc">Más recientes primero</option>
            <option value="date_asc">Más antiguas primero</option>
            <option value="total_desc">Mayor valor de compra</option>
          </select>
        </div>
      </div>

      {/* Tabla de historial de compras */}
      {filteredPurchases.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={
            data.purchases.length === 0
              ? 'Aquí se registra lo que gastas'
              : 'No hay compras que coincidan'
          }
          description={
            data.purchases.length === 0
              ? 'Registra tus compras de hilos, rellenos, accesorios, empaques o herramientas para alimentar el inventario automáticamente.'
              : 'Ajusta la búsqueda o el filtro de categoría para ver otras compras registradas.'
          }
          actionLabel="Registrar compra"
          onAction={() => openNewModal()}
        />
      ) : (
        <div className="bg-white border border-[#E7E3DC] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Material / Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4 text-right">Costo unit.</th>
                  <th className="py-3 px-4 text-right">Total compra</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E3DC] text-sm">
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1F1C19] whitespace-nowrap">
                      {p.code}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#6E675F] whitespace-nowrap">
                      {formatDate(p.date)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#1F1C19]">{p.materialName}</p>
                      {p.invoiceRef && (
                        <p className="text-xs text-[#6E675F]">Comprobante: {p.invoiceRef}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#5A5550] whitespace-nowrap">
                      {p.category}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#1F1C19] whitespace-nowrap">
                      <div>
                        {formatNumber(p.quantity)} {p.unit}
                      </div>
                      {p.purchasedQuantity &&
                        p.purchasedUnit &&
                        (p.purchasedQuantity !== p.quantity || p.purchasedUnit !== p.unit) && (
                          <div className="text-[11px] text-[#6E675F] font-sans">
                            {formatNumber(p.purchasedQuantity)} {p.purchasedUnit}
                            {p.contentPerUnit
                              ? ` × ${formatNumber(p.contentPerUnit)} ${p.unit}`
                              : ''}
                          </div>
                        )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#5A5550] whitespace-nowrap">
                      {formatCOP(p.unitCost)}/{p.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums text-[#1F1C19] whitespace-nowrap">
                      {formatCOP(p.totalPrice)}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#5A5550]">
                      {p.supplier || '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailPurchase(p)}
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${p.code}`}
                          className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#1F1C19] hover:bg-[#F3F0EB]"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          title="Editar compra"
                          aria-label={`Editar ${p.code}`}
                          className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#7C3A52] hover:bg-[#F3F0EB]"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          title="Eliminar compra"
                          aria-label={`Eliminar ${p.code}`}
                          className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nueva / editar compra */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingPurchase ? `Editar compra ${editingPurchase.code}` : 'Registrar compra'}
        subtitle="El inventario se actualizará automáticamente usando el costo unitario más alto."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#B91C1C]">
              {formError}
            </div>
          )}

          {!editingPurchase && (
            <div className="flex items-center gap-2 p-1 bg-[#F3F0EB] rounded-lg w-fit">
              <button
                type="button"
                onClick={() => {
                  setModeMaterial('nuevo');
                  setExistingItemId('');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  modeMaterial === 'nuevo'
                    ? 'bg-white text-[#1F1C19] shadow-sm'
                    : 'text-[#6E675F] hover:text-[#1F1C19]'
                }`}
              >
                Material nuevo
              </button>
              <button
                type="button"
                onClick={() => setModeMaterial('existente')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  modeMaterial === 'existente'
                    ? 'bg-white text-[#1F1C19] shadow-sm'
                    : 'text-[#6E675F] hover:text-[#1F1C19]'
                }`}
              >
                Material ya existente en inventario
              </button>
            </div>
          )}

          {modeMaterial === 'existente' && !editingPurchase ? (
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Seleccionar elemento del inventario *
              </label>
              <select
                value={existingItemId}
                onChange={(e) => handleSelectExistingItem(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              >
                <option value="">-- Selecciona un material o herramienta --</option>
                {data.inventory.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} ({formatNumber(inv.quantity)} {inv.unit} · Costo actual: {formatCOP(inv.unitCost)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Nombre del material o herramienta *
                </label>
                <input
                  type="text"
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  placeholder="Ej. Hilo algodón coral 100g, Aguja crochet 4.0mm..."
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Categoría *
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value as MaterialCategory;
                    setCategory(cat);
                    if (cat === 'Herramientas') {
                      setItemType('herramienta');
                      setUnit('unidades');
                      setMinStock('1');
                    } else if (itemType === 'herramienta') {
                      setItemType('consumible');
                    }
                  }}
                  disabled={Boolean(editingPurchase)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52] disabled:bg-[#F3F0EB]"
                >
                  {MATERIAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Tipo en inventario *
                </label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as InventoryItemType)}
                  disabled={Boolean(editingPurchase)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52] disabled:bg-[#F3F0EB]"
                >
                  <option value="consumible">Material / elemento consumible</option>
                  <option value="herramienta">Herramienta / recurso reutilizable</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Cantidad comprada *
              </label>
              <NumberInput
                allowDecimal
                value={quantity}
                onChangeText={handlePurchasedQtyChange}
                placeholder="Ej. 3"
                required
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                {hasRealContentConversion ? 'Presentación comprada *' : 'Unidad de medida *'}
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={modeMaterial === 'existente' && !hasRealContentConversion}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52] disabled:bg-[#F3F0EB]"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Precio total compra (COP) *
              </label>
              <NumberInput
                allowDecimal={false}
                value={totalPrice}
                onChangeText={setTotalPrice}
                placeholder="Ej. 35000"
                required
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>
          </div>

          {/* Opción adicional: registrar material real contenido cuando se compra por rollos, paquetes o unidades */}
          <div className="p-3.5 rounded-xl bg-[#FAF6F2] border border-[#E7DDD4] space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#3B281E]">
              <input
                type="checkbox"
                checked={hasRealContentConversion}
                onChange={(e) => handleToggleRealConversion(e.target.checked)}
                className="mt-0.5 rounded border-[#B8A79A] text-[#7C3A52] focus:ring-[#7C3A52]"
              />
              <div>
                <span className="font-semibold block">
                  Especificar material real en unidades de inventario (ej. 3 rollos × 50 g = 150 g)
                </span>
                <span className="text-[11px] text-[#7D6659]">
                  Activa esta opción si compras por rollos, ovillos o paquetes pero controlas tu inventario en gramos, metros u otra unidad.
                </span>
              </div>
            </label>

            {hasRealContentConversion && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E7DDD4]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F1C19] mb-1">
                    Contenido por cada {unit}
                  </label>
                  <NumberInput
                    allowDecimal
                    value={contentPerUnit}
                    onChangeText={handleContentPerUnitChange}
                    placeholder="Ej. 50"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#1F1C19] mb-1">
                    Unidad real en inventario *
                  </label>
                  <select
                    value={effectiveRealUnit}
                    onChange={(e) => setRealUnit(e.target.value)}
                    disabled={modeMaterial === 'existente' || Boolean(editingPurchase)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52] disabled:bg-[#F3F0EB]"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#1F1C19] mb-1">
                    Total material real ({effectiveRealUnit}) *
                  </label>
                  <NumberInput
                    allowDecimal
                    value={realTotalQty}
                    onChangeText={handleRealTotalQtyChange}
                    placeholder="Ej. 150"
                    required
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Vista previa de costo unitario calculado y valoración al costo más alto */}
          <div className="p-3.5 rounded-lg bg-[#FAF9F7] border border-[#E7E3DC] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {hasRealContentConversion &&
                Number.isFinite(effectiveInventoryQty) &&
                effectiveInventoryQty > 0 && (
                  <span className="text-[#3B281E]">
                    Entra al inventario:{' '}
                    <strong className="font-mono tabular-nums">
                      {formatNumber(effectiveInventoryQty)} {effectiveRealUnit}
                    </strong>
                    {Number.isFinite(parsedPurchasedQty) && parsedPurchasedQty > 0
                      ? ` (${formatNumber(parsedPurchasedQty)} ${unit})`
                      : ''}
                  </span>
                )}
              <span className="text-[#5A5550]">
                Costo unitario calculado:{' '}
                <strong className="font-mono tabular-nums text-[#1F1C19]">
                  {calculatedUnitCost > 0
                    ? `${formatCOP(calculatedUnitCost)} / ${effectiveRealUnit}`
                    : '—'}
                </strong>
              </span>
            </div>
            {selectedInvItem && calculatedUnitCost > 0 && (
              <span className="text-[#7C3A52] font-medium tabular-nums">
                Valoración inventario (costo más alto):{' '}
                <strong>
                  {formatCOP(Math.max(selectedInvItem.unitCost, calculatedUnitCost))}/
                  {effectiveRealUnit}
                </strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Fecha de compra *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Proveedor (opcional)
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nombre del proveedor"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Comprobante / factura (opcional)
              </label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="Ej. FAC-1055"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>
          </div>

          {modeMaterial === 'nuevo' && !editingPurchase && (
            <div className="sm:w-1/3">
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Nivel mínimo de existencias
              </label>
              <NumberInput
                allowDecimal
                value={minStock}
                onChangeText={setMinStock}
                placeholder="Ej. 100"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Observaciones
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Color, lote, detalles del empaque o calibre..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E7E3DC]">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#1F1C19] bg-white border border-[#D9D3CA] rounded-lg hover:bg-[#F3F0EB]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg"
            >
              {editingPurchase ? 'Guardar cambios' : 'Registrar compra'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal detalle de compra */}
      <Modal
        isOpen={detailPurchase !== null}
        onClose={() => setDetailPurchase(null)}
        title={detailPurchase ? `Detalle de compra ${detailPurchase.code}` : ''}
        maxWidthClass="max-w-lg"
      >
        {detailPurchase && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC]">
              <div>
                <span className="text-xs text-[#6E675F] block">Material</span>
                <span className="font-semibold text-[#1F1C19]">{detailPurchase.materialName}</span>
              </div>
              <div>
                <span className="text-xs text-[#6E675F] block">Categoría</span>
                <span className="font-medium text-[#1F1C19]">{detailPurchase.category}</span>
              </div>
              <div>
                <span className="text-xs text-[#6E675F] block">Material ingresado</span>
                <span className="font-mono tabular-nums font-medium text-[#1F1C19] block">
                  {formatNumber(detailPurchase.quantity)} {detailPurchase.unit}
                </span>
                {detailPurchase.purchasedQuantity &&
                  detailPurchase.purchasedUnit &&
                  (detailPurchase.purchasedQuantity !== detailPurchase.quantity ||
                    detailPurchase.purchasedUnit !== detailPurchase.unit) && (
                    <span className="text-[11px] text-[#6E675F]">
                      Comprado: {formatNumber(detailPurchase.purchasedQuantity)}{' '}
                      {detailPurchase.purchasedUnit}
                      {detailPurchase.contentPerUnit
                        ? ` (${formatNumber(detailPurchase.contentPerUnit)} ${detailPurchase.unit} c/u)`
                        : ''}
                    </span>
                  )}
              </div>
              <div>
                <span className="text-xs text-[#6E675F] block">Costo unitario</span>
                <span className="font-mono tabular-nums font-medium text-[#1F1C19]">
                  {formatCOP(detailPurchase.unitCost)} / {detailPurchase.unit}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#6E675F] block">Valor total</span>
                <span className="font-mono tabular-nums font-bold text-[#7C3A52]">
                  {formatCOP(detailPurchase.totalPrice)}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#6E675F] block">Fecha</span>
                <span className="font-mono tabular-nums text-[#1F1C19]">
                  {formatDate(detailPurchase.date)}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#6E675F] block">Proveedor</span>
                <span className="text-[#1F1C19]">{detailPurchase.supplier || 'No registrado'}</span>
              </div>
              <div>
                <span className="text-xs text-[#6E675F] block">Comprobante / factura</span>
                <span className="text-[#1F1C19]">{detailPurchase.invoiceRef || 'No registrado'}</span>
              </div>
            </div>
            {detailPurchase.observations && (
              <div>
                <span className="text-xs font-semibold text-[#6E675F] block mb-1">
                  Observaciones
                </span>
                <p className="text-sm text-[#4A453F] bg-[#FAF9F7] p-3 rounded-lg border border-[#E7E3DC]">
                  {detailPurchase.observations}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            const res = deletePurchase(deleteTarget.id);
            if (!res.ok && res.error) {
              addToast('error', 'No se pudo eliminar', res.error);
            }
          }
        }}
        title="¿Eliminar registro de compra?"
        message={
          deleteTarget
            ? `Se eliminará la compra ${deleteTarget.code} (${deleteTarget.materialName}) y se descontará ${deleteTarget.quantity} ${deleteTarget.unit} del inventario actual.`
            : ''
        }
        confirmLabel="Eliminar compra"
      />
    </div>
  );
};
