import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArchiveX,
  ArrowDownUp,
  CheckCircle2,
  History,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import {
  COMMON_UNITS,
  InventoryItem,
  InventoryItemType,
  MATERIAL_CATEGORIES,
  MaterialCategory,
  MovementType,
} from '../types';
import { formatCOP, formatDate, formatNumber, getTodayISO } from '../utils/format';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { NumberInput } from '../components/ui/NumberInput';

const MOVEMENT_LABELS: Record<MovementType, { label: string; colorClass: string }> = {
  entrada_compra: { label: 'Entrada por compra', colorClass: 'text-[#15803D]' },
  salida_pedido: { label: 'Salida por pedido', colorClass: 'text-[#B91C1C]' },
  ajuste_manual: { label: 'Ajuste manual', colorClass: 'text-[#7C3A52]' },
  devolucion_material: { label: 'Devolución de material', colorClass: 'text-[#0F766E]' },
  baja_herramienta: { label: 'Baja de herramienta', colorClass: 'text-[#B45309]' },
};

export const InventarioView: React.FC = () => {
  const {
    data,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    adjustInventoryStock,
    retireTool,
    autoOpenCreateFor,
    setAutoOpenCreateFor,
    addToast,
  } = useDinemelly();

  const [activeTab, setActiveTab] = useState<'existencias' | 'movimientos'>('existencias');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'consumible' | 'herramienta' | 'bajo_stock' | 'baja'>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [search, setSearch] = useState('');
  const [movFilterType, setMovFilterType] = useState<string>('todos');

  // Modales
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [retireItem, setRetireItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  // Estado formulario ítem
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('Hilos y lanas');
  const [itemType, setItemType] = useState<InventoryItemType>('consumible');
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState('g');
  const [unitCost, setUnitCost] = useState('0');
  const [minStock, setMinStock] = useState('100');
  const [estimatedWearCost, setEstimatedWearCost] = useState('300');
  const [observations, setObservations] = useState('');
  const [itemError, setItemError] = useState('');

  // Estado formulario ajuste manual
  const [adjustMode, setAdjustMode] = useState<'sumar' | 'restar'>('sumar');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustDate, setAdjustDate] = useState(getTodayISO());
  const [authorizeNegative, setAuthorizeNegative] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Estado formulario baja de herramienta
  const [retireDate, setRetireDate] = useState(getTodayISO());
  const [retireReason, setRetireReason] = useState('');
  const [retireNotes, setRetireNotes] = useState('');
  const [retireError, setRetireError] = useState('');

  const openNewItem = () => {
    setEditingItem(null);
    setItemError('');
    setName('');
    setCategory('Hilos y lanas');
    setItemType('consumible');
    setQuantity('0');
    setUnit('g');
    setUnitCost('0');
    setMinStock('100');
    setEstimatedWearCost('300');
    setObservations('');
    setItemModalOpen(true);
  };

  useEffect(() => {
    if (autoOpenCreateFor === 'inventario') {
      openNewItem();
      setAutoOpenCreateFor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreateFor]);

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemError('');
    setName(item.name);
    setCategory(item.category);
    setItemType(item.itemType);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setUnitCost(String(item.unitCost));
    setMinStock(String(item.minStock));
    setEstimatedWearCost(String(item.estimatedWearCost || 0));
    setObservations(item.observations);
    setItemModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    setItemError('');
    const parsedQty = parseFloat(quantity);
    const parsedCost = parseFloat(unitCost);
    const parsedMin = parseFloat(minStock);
    const parsedWear = parseFloat(estimatedWearCost);

    if (!name.trim()) {
      setItemError('El nombre es obligatorio.');
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty < 0) {
      setItemError('La cantidad no puede ser negativa.');
      return;
    }
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setItemError('El costo unitario no puede ser negativo.');
      return;
    }

    if (editingItem) {
      const res = updateInventoryItem(editingItem.id, {
        name: name.trim(),
        category,
        itemType,
        unit,
        unitCost: parsedCost,
        minStock: Number.isFinite(parsedMin) ? Math.max(0, parsedMin) : 0,
        estimatedWearCost:
          itemType === 'herramienta' && Number.isFinite(parsedWear)
            ? Math.max(0, parsedWear)
            : 0,
        observations: observations.trim(),
      });
      if (!res.ok) {
        setItemError(res.error || 'Error al guardar.');
        return;
      }
    } else {
      const res = addInventoryItem({
        name: name.trim(),
        category,
        itemType,
        quantity: parsedQty,
        unit,
        unitCost: parsedCost,
        minStock: Number.isFinite(parsedMin) ? Math.max(0, parsedMin) : 0,
        estimatedWearCost:
          itemType === 'herramienta' && Number.isFinite(parsedWear)
            ? Math.max(0, parsedWear)
            : 0,
        observations: observations.trim(),
      });
      if (!res.ok) {
        setItemError(res.error || 'Error al crear.');
        return;
      }
    }
    setItemModalOpen(false);
  };

  const openAdjustModal = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustMode('sumar');
    setAdjustQty('');
    setAdjustReason('');
    setAdjustDate(getTodayISO());
    setAuthorizeNegative(false);
    setAdjustError('');
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    setAdjustError('');
    const qtyVal = parseFloat(adjustQty);
    if (!Number.isFinite(qtyVal) || qtyVal <= 0) {
      setAdjustError('Ingresa una cantidad mayor a cero.');
      return;
    }
    const delta = adjustMode === 'sumar' ? qtyVal : -qtyVal;
    const res = adjustInventoryStock(
      adjustItem.id,
      delta,
      adjustReason,
      adjustDate,
      authorizeNegative
    );
    if (!res.ok) {
      setAdjustError(res.error || 'No se pudo aplicar el ajuste.');
      return;
    }
    setAdjustItem(null);
  };

  const openRetireModal = (item: InventoryItem) => {
    setRetireItem(item);
    setRetireDate(getTodayISO());
    setRetireReason('');
    setRetireNotes('');
    setRetireError('');
  };

  const handleRetireSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!retireItem) return;
    setRetireError('');
    const res = retireTool(retireItem.id, retireDate, retireReason, retireNotes);
    if (!res.ok) {
      setRetireError(res.error || 'Error al dar de baja.');
      return;
    }
    setRetireItem(null);
  };

  const summary = useMemo(() => {
    const activeConsumables = data.inventory.filter(
      (i) => i.status === 'activo' && i.itemType === 'consumible'
    );
    const activeTools = data.inventory.filter(
      (i) => i.status === 'activo' && i.itemType === 'herramienta'
    );
    const consumablesValue = activeConsumables.reduce(
      (s, i) => s + i.quantity * i.unitCost,
      0
    );
    const toolsValue = activeTools.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const lowStockCount = activeConsumables.filter((i) => i.quantity < i.minStock).length;
    return {
      consumablesValue,
      toolsValue,
      totalValue: consumablesValue + toolsValue,
      lowStockCount,
      activeToolsCount: activeTools.length,
    };
  }, [data.inventory]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.inventory.filter((item) => {
      if (typeFilter === 'consumible' && (item.itemType !== 'consumible' || item.status !== 'activo'))
        return false;
      if (typeFilter === 'herramienta' && (item.itemType !== 'herramienta' || item.status !== 'activo'))
        return false;
      if (
        typeFilter === 'bajo_stock' &&
        (item.status !== 'activo' || item.itemType !== 'consumible' || item.quantity >= item.minStock)
      )
        return false;
      if (typeFilter === 'baja' && item.status !== 'baja') return false;
      if (categoryFilter !== 'todas' && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.observations.toLowerCase().includes(q)
      );
    });
  }, [data.inventory, typeFilter, categoryFilter, search]);

  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.movements.filter((m) => {
      if (movFilterType !== 'todos' && m.type !== movFilterType) return false;
      if (!q) return true;
      return (
        m.itemName.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        (m.referenceLabel || '').toLowerCase().includes(q)
      );
    });
  }, [data.movements, movFilterType, search]);

  return (
    <div className="space-y-6">
      {/* Resumen de valoración de inventario */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7E3DC] rounded-xl p-4">
          <span className="text-xs text-[#6E675F]">Valor total estimado</span>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#1F1C19]">
            {formatCOP(summary.totalValue)}
          </p>
        </div>
        <div className="bg-white border border-[#E7E3DC] rounded-xl p-4">
          <span className="text-xs text-[#6E675F]">Materiales consumibles</span>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#1F1C19]">
            {formatCOP(summary.consumablesValue)}
          </p>
        </div>
        <div className="bg-white border border-[#E7E3DC] rounded-xl p-4">
          <span className="text-xs text-[#6E675F]">Herramientas activas ({summary.activeToolsCount})</span>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#1F1C19]">
            {formatCOP(summary.toolsValue)}
          </p>
        </div>
        <div className="bg-white border border-[#E7E3DC] rounded-xl p-4">
          <span className="text-xs text-[#6E675F]">Alertas de existencias bajas</span>
          <p
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              summary.lowStockCount > 0 ? 'text-[#B45309]' : 'text-[#15803D]'
            }`}
          >
            {summary.lowStockCount}
          </p>
        </div>
      </div>

      {/* Barra de pestañas y controles */}
      <div className="bg-white border border-[#E7E3DC] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-[#F3F0EB] rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('existencias')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'existencias'
                  ? 'bg-white text-[#1F1C19] shadow-sm'
                  : 'text-[#6E675F] hover:text-[#1F1C19]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Existencias actuales</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('movimientos')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'movimientos'
                  ? 'bg-white text-[#1F1C19] shadow-sm'
                  : 'text-[#6E675F] hover:text-[#1F1C19]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historial de movimientos ({data.movements.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={openNewItem}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar elemento</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E7E3DC]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === 'existencias'
                  ? 'Buscar material, herramienta u observación...'
                  : 'Buscar movimiento, motivo o referencia...'
              }
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            />
          </div>

          {activeTab === 'existencias' ? (
            <>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                aria-label="Filtrar por tipo"
                className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              >
                <option value="todos">Todos los elementos</option>
                <option value="consumible">Materiales y consumibles</option>
                <option value="herramienta">Herramientas reutilizables</option>
                <option value="bajo_stock">Solo existencias bajas</option>
                <option value="baja">Herramientas dadas de baja</option>
              </select>

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
            </>
          ) : (
            <select
              value={movFilterType}
              onChange={(e) => setMovFilterType(e.target.value)}
              aria-label="Filtrar tipo de movimiento"
              className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            >
              <option value="todos">Todos los movimientos</option>
              <option value="entrada_compra">Entradas por compras</option>
              <option value="salida_pedido">Salidas por pedidos</option>
              <option value="ajuste_manual">Ajustes manuales</option>
              <option value="devolucion_material">Devoluciones de materiales</option>
              <option value="baja_herramienta">Bajas de herramientas</option>
            </select>
          )}
        </div>
      </div>

      {/* Vista Existencias */}
      {activeTab === 'existencias' && (
        <>
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title={
                data.inventory.length === 0
                  ? 'Aquí puedes ver tu inventario'
                  : 'No hay elementos para mostrar'
              }
              description={
                data.inventory.length === 0
                  ? 'Agrega tus materiales consumibles o herramientas, o registra una compra para que aparezcan aquí.'
                  : 'Ajusta los filtros o registra un nuevo material o herramienta en el inventario.'
              }
              actionLabel="Agregar elemento"
              onAction={openNewItem}
            />
          ) : (
            <div className="bg-white border border-[#E7E3DC] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8F6F2] border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                      <th className="py-3 px-4">Elemento</th>
                      <th className="py-3 px-4">Tipo y categoría</th>
                      <th className="py-3 px-4 text-right">Disponible</th>
                      <th className="py-3 px-4 text-right">Mínimo</th>
                      <th className="py-3 px-4 text-right">Costo unit.</th>
                      <th className="py-3 px-4 text-right">Valor total</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E3DC] text-sm">
                    {filteredItems.map((item) => {
                      const isLow =
                        item.status === 'activo' &&
                        item.itemType === 'consumible' &&
                        item.quantity < item.minStock;
                      const isRetired = item.status === 'baja';
                      return (
                        <tr key={item.id} className="hover:bg-[#FAF9F7] transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-[#1F1C19]">{item.name}</p>
                            {item.observations && (
                              <p className="text-xs text-[#6E675F] truncate max-w-[260px]">
                                {item.observations}
                              </p>
                            )}
                            {item.itemType === 'herramienta' && item.status === 'activo' && (
                              <p className="text-xs text-[#7C3A52] mt-0.5 tabular-nums">
                                Desgaste estimado: {formatCOP(item.estimatedWearCost)} / uso
                              </p>
                            )}
                            {isRetired && item.retireReason && (
                              <p className="text-xs text-[#B45309] mt-0.5">
                                Baja ({formatDate(item.retiredAt || '')}): {item.retireReason}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#5A5550]">
                            <span className="inline-flex items-center gap-1 font-medium text-[#1F1C19]">
                              {item.itemType === 'herramienta' ? (
                                <Wrench className="w-3.5 h-3.5 text-[#7C3A52]" />
                              ) : (
                                <Package className="w-3.5 h-3.5 text-[#6E675F]" />
                              )}
                              <span>
                                {item.itemType === 'herramienta' ? 'Herramienta' : 'Consumible'}
                              </span>
                            </span>
                            <span className="block text-[#6E675F] mt-0.5">{item.category}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap">
                            <span className={isLow ? 'text-[#B91C1C]' : 'text-[#1F1C19]'}>
                              {formatNumber(item.quantity)} {item.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#6E675F] whitespace-nowrap">
                            {formatNumber(item.minStock)} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#5A5550] whitespace-nowrap">
                            {formatCOP(item.unitCost)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums text-[#1F1C19] whitespace-nowrap">
                            {formatCOP(item.quantity * item.unitCost)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isRetired ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E675F]">
                                <ArchiveX className="w-3.5 h-3.5" />
                                <span>De baja</span>
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309]">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Existencia baja</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Disponible</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {item.status === 'activo' && (
                                <button
                                  type="button"
                                  onClick={() => openAdjustModal(item)}
                                  title="Ajuste manual de existencias"
                                  className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#7C3A52] hover:bg-[#F3F0EB]"
                                >
                                  <SlidersHorizontal className="w-4 h-4" />
                                </button>
                              )}
                              {item.itemType === 'herramienta' && item.status === 'activo' && (
                                <button
                                  type="button"
                                  onClick={() => openRetireModal(item)}
                                  title="Dar de baja herramienta"
                                  className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#B45309] hover:bg-[#FFFBEB]"
                                >
                                  <ArchiveX className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditItem(item)}
                                title="Editar elemento"
                                className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#1F1C19] hover:bg-[#F3F0EB]"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                title="Eliminar elemento"
                                className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Vista Historial de Movimientos */}
      {activeTab === 'movimientos' && (
        <>
          {filteredMovements.length === 0 ? (
            <EmptyState
              icon={ArrowDownUp}
              title="Sin movimientos registrados"
              description="Aquí aparecerán automáticamente todas las entradas por compras, salidas por pedidos terminados, devoluciones, ajustes manuales y bajas de herramientas."
            />
          ) : (
            <div className="bg-white border border-[#E7E3DC] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8F6F2] border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Tipo de movimiento</th>
                      <th className="py-3 px-4">Material / Herramienta</th>
                      <th className="py-3 px-4 text-right">Cantidad</th>
                      <th className="py-3 px-4">Motivo</th>
                      <th className="py-3 px-4">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E3DC] text-sm">
                    {filteredMovements.map((m) => {
                      const meta = MOVEMENT_LABELS[m.type];
                      const isPositive = m.quantity > 0;
                      return (
                        <tr key={m.id} className="hover:bg-[#FAF9F7]">
                          <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#6E675F] whitespace-nowrap">
                            {formatDate(m.date)}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                            <span className={meta.colorClass}>{meta.label}</span>
                          </td>
                          <td className="py-3 px-4 font-medium text-[#1F1C19]">
                            {m.itemName}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                              isPositive ? 'text-[#15803D]' : 'text-[#B91C1C]'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {formatNumber(m.quantity)} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#4A453F]">{m.reason}</td>
                          <td className="py-3 px-4 font-mono text-xs text-[#7C3A52] whitespace-nowrap">
                            {m.referenceLabel || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Agregar / Editar elemento */}
      <Modal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={editingItem ? 'Editar elemento de inventario' : 'Nuevo elemento en inventario'}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          {itemError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
              {itemError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Nombre del elemento *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Tipo de elemento *
              </label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as InventoryItemType)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              >
                <option value="consumible">Material / elemento consumible</option>
                <option value="herramienta">Herramienta reutilizable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              >
                {MATERIAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {!editingItem && (
              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Cantidad inicial
                </label>
                <NumberInput
                  allowDecimal
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="Ej. 500"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Unidad
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
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
                Costo unit. (COP)
              </label>
              <NumberInput
                allowDecimal
                value={unitCost}
                onChangeText={setUnitCost}
                placeholder="Ej. 1000"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Nivel mínimo
              </label>
              <NumberInput
                allowDecimal
                value={minStock}
                onChangeText={setMinStock}
                placeholder="Ej. 100"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>
          </div>

          {itemType === 'herramienta' && (
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Costo estimado de desgaste por producto (COP)
              </label>
              <NumberInput
                allowDecimal={false}
                value={estimatedWearCost}
                onChangeText={setEstimatedWearCost}
                placeholder="Ej. 300"
                className="w-full sm:w-1/2 px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
              <p className="text-xs text-[#6E675F] mt-1">
                Se suma proporcionalmente en la calculadora de costos sin descontar físicamente la herramienta.
              </p>
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
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E7E3DC]">
            <button
              type="button"
              onClick={() => setItemModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#1F1C19] bg-white border border-[#D9D3CA] rounded-lg hover:bg-[#F3F0EB]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg"
            >
              Guardar elemento
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Ajuste manual */}
      <Modal
        isOpen={adjustItem !== null}
        onClose={() => setAdjustItem(null)}
        title="Ajuste manual de inventario"
        subtitle={
          adjustItem
            ? `${adjustItem.name} · Existencia actual: ${formatNumber(adjustItem.quantity)} ${adjustItem.unit}`
            : ''
        }
        maxWidthClass="max-w-md"
      >
        {adjustItem && (
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            {adjustError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                {adjustError}
              </div>
            )}

            <div className="flex gap-2 p-1 bg-[#F3F0EB] rounded-lg">
              <button
                type="button"
                onClick={() => setAdjustMode('sumar')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  adjustMode === 'sumar'
                    ? 'bg-white text-[#15803D] shadow-sm'
                    : 'text-[#6E675F]'
                }`}
              >
                + Aumentar existencias
              </button>
              <button
                type="button"
                onClick={() => setAdjustMode('restar')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  adjustMode === 'restar'
                    ? 'bg-white text-[#B91C1C] shadow-sm'
                    : 'text-[#6E675F]'
                }`}
              >
                - Reducir existencias
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Cantidad ({adjustItem.unit}) *
                </label>
                <NumberInput
                  allowDecimal
                  value={adjustQty}
                  onChangeText={setAdjustQty}
                  placeholder="Ej. 100"
                  required
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={adjustDate}
                  onChange={(e) => setAdjustDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Justificación del ajuste *
              </label>
              <textarea
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Ej. Conteo físico del mes, merma por hilo enredado, sobrante recuperado..."
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>

            {adjustMode === 'restar' && (
              <label className="flex items-start gap-2 text-xs text-[#5A5550] cursor-pointer">
                <input
                  type="checkbox"
                  checked={authorizeNegative}
                  onChange={(e) => setAuthorizeNegative(e.target.checked)}
                  className="mt-0.5 rounded border-[#D9D3CA] text-[#7C3A52]"
                />
                <span>Autorizar saldo negativo excepcional si el descuento supera las existencias actuales</span>
              </label>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-[#E7E3DC]">
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="px-4 py-2 text-sm font-medium text-[#1F1C19] bg-white border border-[#D9D3CA] rounded-lg hover:bg-[#F3F0EB]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg"
              >
                Registrar ajuste
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Dar de baja herramienta */}
      <Modal
        isOpen={retireItem !== null}
        onClose={() => setRetireItem(null)}
        title="Dar de baja herramienta"
        subtitle={retireItem ? retireItem.name : ''}
        maxWidthClass="max-w-md"
      >
        {retireItem && (
          <form onSubmit={handleRetireSubmit} className="space-y-4">
            {retireError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                {retireError}
              </div>
            )}
            <p className="text-xs text-[#6E675F] leading-relaxed">
              Esta acción retirará la herramienta de los recursos activos del taller y dejará constancia en el historial de movimientos.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Fecha de baja *
              </label>
              <input
                type="date"
                value={retireDate}
                onChange={(e) => setRetireDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Motivo de la baja *
              </label>
              <input
                type="text"
                value={retireReason}
                onChange={(e) => setRetireReason(e.target.value)}
                placeholder="Ej. Punta doblada, desgaste natural, reemplazada por nueva..."
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Observaciones adicionales
              </label>
              <textarea
                rows={2}
                value={retireNotes}
                onChange={(e) => setRetireNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-[#E7E3DC]">
              <button
                type="button"
                onClick={() => setRetireItem(null)}
                className="px-4 py-2 text-sm font-medium text-[#1F1C19] bg-white border border-[#D9D3CA] rounded-lg hover:bg-[#F3F0EB]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#B45309] hover:bg-[#92400E] rounded-lg"
              >
                Confirmar baja
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            const res = deleteInventoryItem(deleteTarget.id);
            if (!res.ok && res.error) {
              addToast('error', 'No se pudo eliminar', res.error);
            }
          }
        }}
        title="¿Eliminar elemento del inventario?"
        message={
          deleteTarget
            ? `Se eliminará "${deleteTarget.name}" del catálogo de inventario.`
            : ''
        }
        confirmLabel="Eliminar"
      />
    </div>
  );
};
