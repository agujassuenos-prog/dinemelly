import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  ClipboardList,
  Eye,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import { Order, OrderItem, PAYMENT_METHODS, PaymentMethod } from '../types';
import { formatCOP, formatDate, formatNumber, generateId, getTodayISO } from '../utils/format';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PaymentStatusLabel } from '../components/ui/StatusText';
import { NumberInput } from '../components/ui/NumberInput';

interface DraftMaterialUsageRow {
  rowId: string;
  inventoryItemId: string;
  quantity: number;
}

interface DraftOrderItemForm {
  id: string;
  productName: string;
  description: string;
  quantity: number;
  unitSalePrice: number;
  estimatedProductionCost: number;
  laborAndExtrasPerUnit: number;
  suggestedMaterials?: OrderItem['suggestedMaterials'];
  materialsToDeduct: DraftMaterialUsageRow[];
  // Preservar estado si se edita un ítem existente
  existingItem?: OrderItem;
}

export const PedidosView: React.FC = () => {
  const {
    data,
    addOrder,
    updateOrder,
    deleteOrder,
    finishOrderItemWithMaterials,
    addPayment,
    addClient,
    getOrderTotal,
    getOrderPaid,
    getOrderPending,
    getOrderPaymentStatus,
    getOrderCost,
    getOrderProfit,
    pendingOrderDraftFromCalc,
    setPendingOrderDraftFromCalc,
    autoOpenCreateFor,
    setAutoOpenCreateFor,
    addToast,
  } = useDinemelly();

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'todos' | 'Pendiente' | 'Parcialmente pagado' | 'Pagado'>('todos');
  const [sortBy, setSortBy] = useState<'date_desc' | 'delivery_asc' | 'total_desc'>('date_desc');

  // Modales principales
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  // Modal de creación rápida de cliente dentro del pedido
  const [quickClientName, setQuickClientName] = useState('');
  const [showQuickClient, setShowQuickClient] = useState(false);

  // Formulario de pedido
  const [clientId, setClientId] = useState('');
  const [requestDate, setRequestDate] = useState(getTodayISO());
  const [deliveryDate, setDeliveryDate] = useState(getTodayISO());
  const [discount, setDiscount] = useState(0);
  const [observations, setObservations] = useState('');
  const [draftItems, setDraftItems] = useState<DraftOrderItemForm[]>([]);
  const [paymentMode, setPaymentMode] = useState<'ninguno' | 'abono' | 'total'>('ninguno');
  const [initialAbonoAmount, setInitialAbonoAmount] = useState('');
  const [initialPayMethod, setInitialPayMethod] = useState<PaymentMethod>('Transferencia');
  const [initialPayDate, setInitialPayDate] = useState(getTodayISO());
  const [initialPayObs, setInitialPayObs] = useState('');
  const [orderAuthorizeNegative, setOrderAuthorizeNegative] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal inline de calculadora rápida por ítem
  const [inlineCalcIndex, setInlineCalcIndex] = useState<number | null>(null);
  const [icMaterialCost, setIcMaterialCost] = useState(0);
  const [icLaborCost, setIcLaborCost] = useState(0);
  const [icWearAndExtras, setIcWearAndExtras] = useState(900);
  const [icMargin, setIcMargin] = useState(40);

  // Modal de terminar producto y descontar inventario
  const [finishTarget, setFinishTarget] = useState<{
    order: Order;
    item: OrderItem;
  } | null>(null);
  const [consumedRows, setConsumedRows] = useState<
    { rowId: string; inventoryItemId: string; quantity: number }[]
  >([]);
  const [finishLaborExtras, setFinishLaborExtras] = useState(0);
  const [finishAuthorizeNegative, setFinishAuthorizeNegative] = useState(false);
  const [finishError, setFinishError] = useState('');

  // Modal rápido de pago desde detalle de pedido
  const [quickPayOrder, setQuickPayOrder] = useState<Order | null>(null);
  const [qpAmount, setQpAmount] = useState('');
  const [qpDate, setQpDate] = useState(getTodayISO());
  const [qpMethod, setQpMethod] = useState<PaymentMethod>('Transferencia');
  const [qpObs, setQpObs] = useState('');
  const [qpError, setQpError] = useState('');

  const consumables = useMemo(
    () => data.inventory.filter((i) => i.status === 'activo' && i.itemType === 'consumible'),
    [data.inventory]
  );

  const detailOrder = useMemo(
    () => data.orders.find((o) => o.id === detailOrderId) || null,
    [data.orders, detailOrderId]
  );

  const buildSuggestedMaterialRows = (
    suggested: OrderItem['suggestedMaterials'],
    itemQty: number
  ): DraftMaterialUsageRow[] => {
    if (suggested && suggested.length > 0) {
      const mapped = suggested
        .filter(
          (sm) =>
            sm.inventoryItemId &&
            consumables.some((c) => c.id === sm.inventoryItemId)
        )
        .map((sm) => ({
          rowId: generateId('dm'),
          inventoryItemId: sm.inventoryItemId!,
          quantity: Math.round(sm.quantity * Math.max(1, itemQty) * 1000) / 1000,
        }));
      if (mapped.length > 0) return mapped;
    }
    return consumables.length > 0
      ? [{ rowId: generateId('dm'), inventoryItemId: '', quantity: 0 }]
      : [];
  };

  const openNewOrderModal = (preloadedFromCalc = false) => {
    setEditingOrder(null);
    setFormError('');
    setOrderAuthorizeNegative(false);
    setShowQuickClient(false);
    setQuickClientName('');
    setClientId(data.clients[0]?.id || '');
    setRequestDate(getTodayISO());
    setDeliveryDate(getTodayISO());
    setDiscount(0);
    setObservations('');
    setPaymentMode('ninguno');
    setInitialAbonoAmount('');
    setInitialPayMethod('Transferencia');
    setInitialPayDate(getTodayISO());
    setInitialPayObs('');
    if (!preloadedFromCalc) {
      setDraftItems([
        {
          id: generateId('di'),
          productName: '',
          description: '',
          quantity: 1,
          unitSalePrice: 0,
          estimatedProductionCost: 0,
          laborAndExtrasPerUnit: 0,
          materialsToDeduct:
            consumables.length > 0
              ? [{ rowId: generateId('dm'), inventoryItemId: '', quantity: 0 }]
              : [],
        },
      ]);
    }
    setFormOpen(true);
  };

  useEffect(() => {
    if (pendingOrderDraftFromCalc) {
      const calc = pendingOrderDraftFromCalc;
      setDraftItems([
        {
          id: generateId('di'),
          productName: calc.productName,
          description: calc.notes || '',
          quantity: 1,
          unitSalePrice: calc.finalSalePrice,
          estimatedProductionCost: calc.totalProductionCost,
          laborAndExtrasPerUnit:
            calc.laborCost + calc.toolsWearCost + calc.additionalCosts,
          suggestedMaterials: calc.materials,
          materialsToDeduct: buildSuggestedMaterialRows(calc.materials, 1),
        },
      ]);
      openNewOrderModal(true);
      setPendingOrderDraftFromCalc(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderDraftFromCalc]);

  useEffect(() => {
    if (autoOpenCreateFor === 'pedidos') {
      openNewOrderModal(false);
      setAutoOpenCreateFor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreateFor]);

  const openEditOrderModal = (order: Order) => {
    setEditingOrder(order);
    setFormError('');
    setOrderAuthorizeNegative(false);
    setShowQuickClient(false);
    setClientId(order.clientId);
    setRequestDate(order.requestDate);
    setDeliveryDate(order.deliveryDate);
    setDiscount(order.discount);
    setObservations(order.observations);
    setDraftItems(
      order.items.map((it) => ({
        id: it.id,
        productName: it.productName,
        description: it.description,
        quantity: it.quantity,
        unitSalePrice: it.unitSalePrice,
        estimatedProductionCost: it.estimatedProductionCost,
        laborAndExtrasPerUnit: it.laborAndExtrasPerUnit || 0,
        suggestedMaterials: it.suggestedMaterials,
        materialsToDeduct: it.materialsDeducted
          ? []
          : buildSuggestedMaterialRows(it.suggestedMaterials, it.quantity),
        existingItem: it,
      }))
    );
    setFormOpen(true);
  };

  const handleQuickCreateClient = () => {
    if (!quickClientName.trim()) return;
    const res = addClient({
      name: quickClientName.trim(),
      phone: '',
      email: '',
      address: '',
      observations: '',
    });
    if (res.ok && res.id) {
      setClientId(res.id);
      setQuickClientName('');
      setShowQuickClient(false);
    }
  };

  const applySavedCalcToItem = (idx: number, calcId: string) => {
    const calc = data.calculations.find((c) => c.id === calcId);
    if (!calc) return;
    setDraftItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              productName: calc.productName,
              description: it.description || calc.notes || '',
              unitSalePrice: calc.finalSalePrice,
              estimatedProductionCost: calc.totalProductionCost,
              laborAndExtrasPerUnit:
                calc.laborCost + calc.toolsWearCost + calc.additionalCosts,
              suggestedMaterials: calc.materials,
              materialsToDeduct: it.existingItem?.materialsDeducted
                ? it.materialsToDeduct
                : buildSuggestedMaterialRows(calc.materials, it.quantity),
            }
          : it
      )
    );
  };

  const openInlineCalcForItem = (idx: number) => {
    const item = draftItems[idx];
    setInlineCalcIndex(idx);
    setIcMaterialCost(Math.round((item.estimatedProductionCost || 0) * 0.4));
    setIcLaborCost(Math.round((item.estimatedProductionCost || 0) * 0.55));
    setIcWearAndExtras(900);
    setIcMargin(40);
  };

  const icTotalCost = Math.round(icMaterialCost + icLaborCost + icWearAndExtras);
  const icSuggestedPrice =
    icMargin >= 95 ? icTotalCost : Math.round(icTotalCost / (1 - icMargin / 100));

  const applyInlineCalc = () => {
    if (inlineCalcIndex === null) return;
    setDraftItems((prev) =>
      prev.map((it, i) =>
        i === inlineCalcIndex
          ? {
              ...it,
              estimatedProductionCost: icTotalCost,
              unitSalePrice: icSuggestedPrice,
              laborAndExtrasPerUnit: icLaborCost + icWearAndExtras,
            }
          : it
      )
    );
    setInlineCalcIndex(null);
  };

  const draftSubtotal = draftItems.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitSalePrice) || 0),
    0
  );
  const draftTotal = Math.max(0, draftSubtotal - (Number(discount) || 0));

  const draftDeductionTotals = useMemo(() => {
    const map = new Map<string, number>();
    let rowsWithQtyCount = 0;
    let totalCost = 0;
    for (const item of draftItems) {
      if (item.existingItem?.materialsDeducted) continue;
      for (const row of item.materialsToDeduct) {
        if (!row.inventoryItemId || !Number.isFinite(row.quantity) || row.quantity <= 0) continue;
        rowsWithQtyCount += 1;
        const inv = consumables.find((c) => c.id === row.inventoryItemId);
        if (inv) totalCost += row.quantity * inv.unitCost;
        map.set(
          row.inventoryItemId,
          Math.round(((map.get(row.inventoryItemId) || 0) + row.quantity) * 1000) / 1000
        );
      }
    }
    let hasShortage = false;
    for (const [invId, totalQty] of map.entries()) {
      const inv = consumables.find((c) => c.id === invId);
      if (inv && inv.quantity - totalQty < 0) {
        hasShortage = true;
        break;
      }
    }
    return {
      byInventoryId: map,
      rowsWithQtyCount,
      uniqueMaterialsCount: map.size,
      totalCost: Math.round(totalCost),
      hasShortage,
    };
  }, [draftItems, consumables]);

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!clientId) {
      setFormError('Selecciona o crea un cliente para el pedido.');
      return;
    }
    if (draftItems.length === 0) {
      setFormError('Agrega al menos un producto al pedido.');
      return;
    }

    for (const item of draftItems) {
      if (item.existingItem?.materialsDeducted) continue;
      for (const row of item.materialsToDeduct) {
        if (row.inventoryItemId && (!Number.isFinite(row.quantity) || row.quantity <= 0)) {
          const invName =
            consumables.find((c) => c.id === row.inventoryItemId)?.name || 'el material';
          setFormError(
            `Indica la cantidad gastada (mayor a cero) para "${invName}" o quita esa fila.`
          );
          return;
        }
      }
    }

    if (editingOrder) {
      const mergedItems: OrderItem[] = draftItems.map((d) =>
        d.existingItem
          ? {
              ...d.existingItem,
              productName: d.productName.trim(),
              description: d.description.trim(),
              quantity: d.quantity,
              unitSalePrice: d.unitSalePrice,
              estimatedProductionCost: d.estimatedProductionCost,
              laborAndExtrasPerUnit: d.laborAndExtrasPerUnit,
              suggestedMaterials: d.suggestedMaterials,
            }
          : {
              id: d.id,
              productName: d.productName.trim(),
              description: d.description.trim(),
              quantity: d.quantity,
              unitSalePrice: d.unitSalePrice,
              estimatedProductionCost: d.estimatedProductionCost,
              actualProductionCost: 0,
              status: 'pendiente',
              materialsDeducted: false,
              materialsReturned: false,
              consumedMaterials: [],
              laborAndExtrasPerUnit: d.laborAndExtrasPerUnit,
              suggestedMaterials: d.suggestedMaterials,
            }
      );

      const pendingDeductions = draftItems
        .filter((d) => !d.existingItem?.materialsDeducted)
        .map((d) => ({
          itemId: d.id,
          materials: d.materialsToDeduct
            .filter((r) => r.inventoryItemId && r.quantity > 0)
            .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity })),
        }))
        .filter((pd) => pd.materials.length > 0);

      const res = updateOrder(editingOrder.id, {
        clientId,
        requestDate,
        deliveryDate,
        discount,
        observations,
        items: mergedItems,
        status: editingOrder.status,
        pendingDeductions,
        authorizeNegativeStock: orderAuthorizeNegative,
      });
      if (!res.ok) {
        setFormError(res.error || 'Error al actualizar pedido.');
        return;
      }
    } else {
      const res = addOrder({
        clientId,
        requestDate,
        deliveryDate,
        discount,
        observations,
        items: draftItems.map((d) => ({
          productName: d.productName.trim(),
          description: d.description.trim(),
          quantity: d.quantity,
          unitSalePrice: d.unitSalePrice,
          estimatedProductionCost: d.estimatedProductionCost,
          laborAndExtrasPerUnit: d.laborAndExtrasPerUnit,
          suggestedMaterials: d.suggestedMaterials,
          materialsToDeduct: d.materialsToDeduct
            .filter((r) => r.inventoryItemId && r.quantity > 0)
            .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity })),
        })),
        initialPayment: {
          mode: paymentMode,
          amount: parseFloat(initialAbonoAmount) || 0,
          method: initialPayMethod,
          date: initialPayDate || requestDate,
          observations: initialPayObs,
        },
        authorizeNegativeStock: orderAuthorizeNegative,
      });
      if (!res.ok) {
        setFormError(res.error || 'Error al crear pedido.');
        return;
      }
    }
    setFormOpen(false);
  };

  // Abrir modal para terminar producto y descontar materiales reales
  const openFinishItemModal = (order: Order, item: OrderItem) => {
    setFinishTarget({ order, item });
    setFinishError('');
    setFinishAuthorizeNegative(false);
    setFinishLaborExtras(item.laborAndExtrasPerUnit || 0);

    if (item.suggestedMaterials && item.suggestedMaterials.length > 0) {
      const mapped = item.suggestedMaterials
        .filter((sm) => sm.inventoryItemId)
        .map((sm) => ({
          rowId: generateId('fin'),
          inventoryItemId: sm.inventoryItemId!,
          quantity: Math.round(sm.quantity * item.quantity * 100) / 100,
        }));
      setConsumedRows(
        mapped.length > 0
          ? mapped
          : [{ rowId: generateId('fin'), inventoryItemId: consumables[0]?.id || '', quantity: 0 }]
      );
    } else {
      setConsumedRows([
        {
          rowId: generateId('fin'),
          inventoryItemId: consumables[0]?.id || '',
          quantity: 0,
        },
      ]);
    }
  };

  const handleConfirmFinishItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finishTarget) return;
    setFinishError('');
    const validRows = consumedRows
      .filter((r) => r.inventoryItemId && r.quantity > 0)
      .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity }));

    const res = finishOrderItemWithMaterials(
      finishTarget.order.id,
      finishTarget.item.id,
      validRows,
      finishLaborExtras,
      finishAuthorizeNegative
    );
    if (!res.ok) {
      setFinishError(res.error || 'No se pudo descontar el inventario.');
      return;
    }
    setFinishTarget(null);
  };

  const handleQuickPaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayOrder) return;
    setQpError('');
    const res = addPayment({
      orderId: quickPayOrder.id,
      date: qpDate,
      amount: parseFloat(qpAmount),
      method: qpMethod,
      observations: qpObs,
    });
    if (!res.ok) {
      setQpError(res.error || 'No se pudo registrar el abono.');
      return;
    }
    setQuickPayOrder(null);
  };

  const clientNameById = (id: string) =>
    data.clients.find((c) => c.id === id)?.name || 'Cliente';

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.orders
      .filter((ord) => {
        if (ord.status === 'cancelado') return false;
        const pStatus = getOrderPaymentStatus(ord);
        if (paymentFilter !== 'todos' && pStatus !== paymentFilter) return false;
        if (!q) return true;
        const cName = clientNameById(ord.clientId).toLowerCase();
        const productsMatch = ord.items.some((it) =>
          it.productName.toLowerCase().includes(q)
        );
        return (
          ord.orderNumber.toLowerCase().includes(q) ||
          cName.includes(q) ||
          productsMatch ||
          ord.observations.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'delivery_asc')
          return (a.deliveryDate || '9999').localeCompare(b.deliveryDate || '9999');
        if (sortBy === 'total_desc') return getOrderTotal(b) - getOrderTotal(a);
        return b.requestDate.localeCompare(a.requestDate) || b.orderNumber.localeCompare(a.orderNumber);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.orders, data.clients, search, paymentFilter, sortBy, getOrderTotal, getOrderPaymentStatus]);

  const finishEstimatedMaterialsCost = useMemo(() => {
    return consumedRows.reduce((s, r) => {
      const inv = consumables.find((c) => c.id === r.inventoryItemId);
      return s + (inv ? inv.unitCost * (r.quantity || 0) : 0);
    }, 0);
  }, [consumedRows, consumables]);

  const totalFilteredValue = filteredOrders.reduce((s, o) => s + getOrderTotal(o), 0);

  return (
    <div className="space-y-6">
      {/* Barra superior */}
      <div className="bg-white border border-[#E7E3DC] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="block text-xs text-[#6E675F]">Pedidos mostrados</span>
              <span className="text-lg font-bold font-mono tabular-nums text-[#1F1C19]">
                {filteredOrders.length}
              </span>
            </div>
            <div className="h-8 w-px bg-[#E7E3DC]" />
            <div>
              <span className="block text-xs text-[#6E675F]">Total en pedidos</span>
              <span className="text-lg font-bold font-mono tabular-nums text-[#3B281E]">
                {formatCOP(totalFilteredValue)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openNewOrderModal(false)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#AF8064] hover:bg-[#976B51] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo pedido</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E7E3DC]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pedido, cliente o producto..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#AF8064]"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
            aria-label="Filtrar por pago"
            className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg"
          >
            <option value="todos">Todos los estados de pago</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Parcialmente pagado">Parcialmente pagado</option>
            <option value="Pagado">Pagado</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Ordenar pedidos"
            className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg"
          >
            <option value="date_desc">Más recientes primero</option>
            <option value="delivery_asc">Entrega más próxima</option>
            <option value="total_desc">Mayor valor de pedido</option>
          </select>
        </div>
      </div>

      {/* Tabla de pedidos */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            data.orders.length === 0
              ? 'Aún no hay pedidos este mes'
              : 'No hay pedidos que coincidan'
          }
          description={
            data.orders.length === 0
              ? 'Registrar nuevo pedido'
              : 'Ajusta la búsqueda o el filtro para consultar otros pedidos.'
          }
          actionLabel="Nuevo pedido"
          onAction={() => openNewOrderModal(false)}
        />
      ) : (
        <div className="bg-white border border-[#E7E3DC] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                  <th className="py-3 px-4">Pedido</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Productos</th>
                  <th className="py-3 px-4">Entrega</th>
                  <th className="py-3 px-4">Estado pago</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Saldo</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E3DC] text-sm">
                {filteredOrders.map((ord) => {
                  const total = getOrderTotal(ord);
                  const pending = getOrderPending(ord);
                  const payStatus = getOrderPaymentStatus(ord);
                  return (
                    <tr key={ord.id} className="hover:bg-[#FAF9F7]">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDetailOrderId(ord.id)}
                          className="font-mono text-xs font-bold text-[#7C3A52] hover:underline"
                        >
                          {ord.orderNumber}
                        </button>
                        <span className="block text-[11px] text-[#6E675F] font-mono">
                          {formatDate(ord.requestDate)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#1F1C19]">
                        {clientNameById(ord.clientId)}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#4A453F] max-w-[240px]">
                        <p className="truncate font-medium text-[#1F1C19]">
                          {ord.items.map((it) => `${it.quantity}× ${it.productName}`).join(', ')}
                        </p>
                        <p className="text-[11px] text-[#6E675F] mt-0.5 tabular-nums">
                          {ord.items.length} {ord.items.length === 1 ? 'producto' : 'productos'} ·{' '}
                          {ord.items.every((it) => it.materialsDeducted)
                            ? 'Inventario descontado'
                            : ord.items.some((it) => it.materialsDeducted)
                            ? 'Descuento parcial'
                            : 'Sin descontar inventario'}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#6E675F] whitespace-nowrap">
                        {formatDate(ord.deliveryDate)}
                      </td>
                      <td className="py-3 px-4">
                        <PaymentStatusLabel status={payStatus} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-[#1F1C19] whitespace-nowrap">
                        {formatCOP(total)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                          pending > 0 ? 'text-[#B45309]' : 'text-[#15803D]'
                        }`}
                      >
                        {formatCOP(pending)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailOrderId(ord.id)}
                            title="Gestionar productos y ver detalle"
                            className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#1F1C19] hover:bg-[#F3F0EB]"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditOrderModal(ord)}
                            title="Editar pedido"
                            className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#7C3A52] hover:bg-[#F3F0EB]"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(ord)}
                            title="Eliminar pedido"
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

      {/* Modal detalle y gestión de pedido */}
      <Modal
        isOpen={detailOrder !== null}
        onClose={() => setDetailOrderId(null)}
        title={detailOrder ? `Pedido ${detailOrder.orderNumber}` : ''}
        subtitle={
          detailOrder
            ? `${clientNameById(detailOrder.clientId)} · Solicitud ${formatDate(detailOrder.requestDate)} · Entrega ${formatDate(detailOrder.deliveryDate)}`
            : ''
        }
        maxWidthClass="max-w-3xl"
      >
        {detailOrder && (() => {
          const total = getOrderTotal(detailOrder);
          const paid = getOrderPaid(detailOrder.id);
          const pending = getOrderPending(detailOrder);
          const totalCost = getOrderCost(detailOrder);
          const profit = getOrderProfit(detailOrder);

          return (
            <div className="space-y-5">
              {/* Barra de pago y acciones rápidas */}
              <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC] flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <span className="text-[11px] text-[#6E675F] block">Estado del pago</span>
                    <PaymentStatusLabel status={getOrderPaymentStatus(detailOrder)} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {pending > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickPayOrder(detailOrder);
                        setQpAmount(String(pending));
                        setQpDate(getTodayISO());
                        setQpMethod('Transferencia');
                        setQpObs('');
                        setQpError('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#AF8064] hover:bg-[#976B51] rounded-lg whitespace-nowrap"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Registrar abono</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Productos del pedido */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#1F1C19]">
                    Productos incluidos ({detailOrder.items.length})
                  </h4>
                  <span className="text-xs text-[#6E675F]">
                    Puedes descontar los materiales usados en inventario por cada producto.
                  </span>
                </div>

                {detailOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-[#E7E3DC] bg-white space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-semibold text-[#1F1C19]">
                            {item.quantity} × {item.productName}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-[#5A5550] mt-1">{item.description}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold tabular-nums text-[#1F1C19]">
                          {formatCOP(item.quantity * item.unitSalePrice)}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-[#6E675F]">
                          {formatCOP(item.unitSalePrice)} c/u
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E7E3DC] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="text-[#6E675F] tabular-nums">
                        Costo unitario:{' '}
                        <strong className="font-mono text-[#1F1C19]">
                          {formatCOP(
                            item.materialsDeducted && item.actualProductionCost > 0
                              ? item.actualProductionCost
                              : item.estimatedProductionCost
                          )}
                        </strong>
                        {item.materialsDeducted ? ' (real)' : ' (estimado)'}
                      </div>

                      {!item.materialsDeducted && (
                        <button
                          type="button"
                          onClick={() => openFinishItemModal(detailOrder, item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#AF8064] hover:bg-[#976B51] rounded-lg whitespace-nowrap"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Descontar materiales</span>
                        </button>
                      )}

                      {item.materialsDeducted && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803D]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {item.materialsReturned
                              ? 'Materiales devueltos por cancelación'
                              : 'Materiales descontados del inventario'}
                          </span>
                        </span>
                      )}
                    </div>

                    {item.consumedMaterials.length > 0 && (
                      <div className="pt-2 text-[11px] text-[#5A5550]">
                        <span className="font-semibold">Consumo registrado: </span>
                        {item.consumedMaterials
                          .map((c) => `${c.name} (${formatNumber(c.quantity)} ${c.unit})`)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {detailOrder.observations && (
                <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC] text-xs">
                  <span className="font-semibold text-[#1F1C19] block mb-1">
                    Personalización y observaciones del pedido
                  </span>
                  <p className="text-[#4A453F]">{detailOrder.observations}</p>
                </div>
              )}

              {/* Resumen financiero del pedido */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC] text-xs">
                <div>
                  <span className="text-[#6E675F] block">Descuento</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCOP(detailOrder.discount)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6E675F] block">Total pedido</span>
                  <span className="font-mono font-bold tabular-nums text-[#1F1C19]">
                    {formatCOP(total)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6E675F] block">Costo producción</span>
                  <span className="font-mono font-semibold tabular-nums text-[#5A5550]">
                    {formatCOP(totalCost)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6E675F] block">Ganancia estimada</span>
                  <span className="font-mono font-semibold tabular-nums text-[#15803D]">
                    {formatCOP(profit)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6E675F] block">Abonado / Saldo</span>
                  <span className="font-mono font-bold tabular-nums text-[#B45309]">
                    {formatCOP(paid)} / {formatCOP(pending)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal Nuevo / Editar Pedido */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingOrder ? `Editar pedido ${editingOrder.orderNumber}` : 'Nuevo pedido'}
        subtitle="Incluye uno o varios productos con personalización y precios independientes."
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSaveOrder} className="space-y-5">
          {formError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
              {formError}
            </div>
          )}

          {/* Selección o creación rápida de cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#1F1C19]">Cliente *</label>
                <button
                  type="button"
                  onClick={() => setShowQuickClient((v) => !v)}
                  className="text-xs font-medium text-[#7C3A52] hover:underline"
                >
                  {showQuickClient ? 'Cancelar cliente nuevo' : '+ Crear cliente rápido'}
                </button>
              </div>
              {showQuickClient ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickClientName}
                    onChange={(e) => setQuickClientName(e.target.value)}
                    placeholder="Nombre del cliente nuevo..."
                    className="flex-1 px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateClient}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-[#7C3A52] rounded-lg"
                  >
                    Agregar
                  </button>
                </div>
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
                >
                  <option value="">-- Selecciona un cliente --</option>
                  {data.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Fecha de solicitud *
              </label>
              <input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Fecha de entrega estimada *
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Descuento total (COP)
              </label>
              <NumberInput
                allowDecimal={false}
                value={discount}
                onChangeValue={setDiscount}
                placeholder="0"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
              />
            </div>
          </div>

          {/* Productos del pedido */}
          <div className="space-y-3 pt-2 border-t border-[#E7E3DC]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1F1C19]">
                Productos incluidos en el pedido
              </span>
              <button
                type="button"
                onClick={() =>
                  setDraftItems((prev) => [
                    ...prev,
                    {
                      id: generateId('di'),
                      productName: '',
                      description: '',
                      quantity: 1,
                      unitSalePrice: 0,
                      estimatedProductionCost: 0,
                      laborAndExtrasPerUnit: 0,
                      materialsToDeduct:
                        consumables.length > 0
                          ? [{ rowId: generateId('dm'), inventoryItemId: '', quantity: 0 }]
                          : [],
                    },
                  ])
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#7C3A52] bg-[#FAF9F7] border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar otro producto</span>
              </button>
            </div>

            {draftItems.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-[#E7E3DC] bg-[#FAF9F7] space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#1F1C19]">
                    Producto #{idx + 1}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {data.calculations.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) applySavedCalcToItem(idx, e.target.value);
                        }}
                        aria-label="Importar cálculo guardado"
                        className="px-2 py-1 text-xs bg-white border border-[#D9D3CA] rounded-md"
                      >
                        <option value="">Importar cálculo guardado...</option>
                        {data.calculations.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.productName} ({formatCOP(c.finalSalePrice)})
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => openInlineCalcForItem(idx)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#7C3A52] bg-white border border-[#D9D3CA] rounded-md hover:bg-[#F3F0EB]"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Calcular costo y precio</span>
                    </button>
                    {draftItems.length > 1 && !item.existingItem?.materialsDeducted && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraftItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-[#6E675F] hover:text-[#B91C1C]"
                        aria-label="Quitar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-0.5">
                      Nombre del producto *
                    </label>
                    <input
                      type="text"
                      value={item.productName}
                      onChange={(e) =>
                        setDraftItems((prev) =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, productName: e.target.value } : it
                          )
                        )
                      }
                      placeholder="Ej. Osito tejido, llavero personalizado..."
                      required
                      className="w-full px-3 py-1.5 text-sm bg-white border border-[#D9D3CA] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-0.5">
                      Personalización (colores, tamaño, hilo...)
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        setDraftItems((prev) =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, description: e.target.value } : it
                          )
                        )
                      }
                      placeholder="Ej. Hilo algodón azul cielo, 18 cm..."
                      className="w-full px-3 py-1.5 text-sm bg-white border border-[#D9D3CA] rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-0.5">
                      Cantidad *
                    </label>
                    <NumberInput
                      allowDecimal={false}
                      value={item.quantity}
                      onChangeValue={(val) =>
                        setDraftItems((prev) =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, quantity: val } : it
                          )
                        )
                      }
                      placeholder="1"
                      disabled={Boolean(item.existingItem?.materialsDeducted)}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-md disabled:bg-[#F3F0EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-0.5">
                      Costo prod. unit. (COP)
                    </label>
                    <NumberInput
                      allowDecimal={false}
                      value={item.estimatedProductionCost}
                      onChangeValue={(val) =>
                        setDraftItems((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? { ...it, estimatedProductionCost: val }
                              : it
                          )
                        )
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-0.5">
                      Precio venta unit. (COP) *
                    </label>
                    <NumberInput
                      allowDecimal={false}
                      value={item.unitSalePrice}
                      onChangeValue={(val) =>
                        setDraftItems((prev) =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, unitSalePrice: val } : it
                          )
                        )
                      }
                      placeholder="Ej. 35000"
                      required
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-md"
                    />
                  </div>
                  <div className="text-right">
                    <span className="block text-[11px] text-[#6E675F]">Subtotal</span>
                    <span className="font-mono text-sm font-bold tabular-nums text-[#1F1C19]">
                      {formatCOP((item.quantity || 0) * (item.unitSalePrice || 0))}
                    </span>
                  </div>
                </div>

                {/* Selección de elementos gastados del inventario para descontarlos al confirmar */}
                <div className="pt-3 border-t border-[#E7E3DC] space-y-2.5">
                  {item.existingItem?.materialsDeducted ? (
                    <div className="p-2.5 rounded-lg bg-[#E6F0E4]/60 border border-[#C5DEC1] text-xs text-[#2D5033]">
                      <span className="font-semibold">Materiales ya descontados del inventario: </span>
                      {item.existingItem.consumedMaterials.length > 0
                        ? item.existingItem.consumedMaterials
                            .map((c) => `${c.name} (${formatNumber(c.quantity)} ${c.unit})`)
                            .join(' · ')
                        : 'Descuento aplicado'}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold text-[#3B281E] block">
                            Elementos del inventario gastados (se descuentan al confirmar)
                          </span>
                          <span className="text-[11px] text-[#7D6659]">
                            Selecciona qué materiales y qué cantidad se usó en este producto para descontarlos automáticamente.
                          </span>
                        </div>
                        {consumables.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        materialsToDeduct: [
                                          ...it.materialsToDeduct,
                                          {
                                            rowId: generateId('dm'),
                                            inventoryItemId: '',
                                            quantity: 0,
                                          },
                                        ],
                                      }
                                    : it
                                )
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#7C3A52] bg-white border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-md whitespace-nowrap"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Agregar elemento</span>
                          </button>
                        )}
                      </div>

                      {consumables.length === 0 ? (
                        <p className="text-[11px] text-[#7D6659] bg-white px-3 py-2 rounded-lg border border-[#E7E3DC]">
                          {data.inventory.length === 0
                            ? 'No hay elementos en el inventario aún. Regístralos en Compras o Inventario para poder descontarlos.'
                            : 'Solo se descuentan materiales consumibles (las herramientas reutilizables no se descuentan del inventario).'}
                        </p>
                      ) : item.materialsToDeduct.length === 0 ? (
                        <p className="text-[11px] text-[#7D6659]">
                          No se seleccionaron elementos del inventario para este producto.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {item.materialsToDeduct.map((row) => {
                            const inv = consumables.find((c) => c.id === row.inventoryItemId);
                            const totalSelectedForInv = row.inventoryItemId
                              ? draftDeductionTotals.byInventoryId.get(row.inventoryItemId) || 0
                              : 0;
                            const remaining = inv
                              ? Math.round((inv.quantity - totalSelectedForInv) * 1000) / 1000
                              : 0;

                            return (
                              <div key={row.rowId} className="space-y-1">
                                <div className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-7">
                                    <select
                                      value={row.inventoryItemId}
                                      onChange={(e) => {
                                        const nextId = e.target.value;
                                        setDraftItems((prev) =>
                                          prev.map((it, i) =>
                                            i === idx
                                              ? {
                                                  ...it,
                                                  materialsToDeduct: it.materialsToDeduct.map((r) =>
                                                    r.rowId === row.rowId
                                                      ? { ...r, inventoryItemId: nextId }
                                                      : r
                                                  ),
                                                }
                                              : it
                                          )
                                        );
                                      }}
                                      aria-label="Elemento gastado del inventario"
                                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D9D3CA] rounded-md"
                                    >
                                      <option value="">
                                        -- Seleccionar elemento del inventario (opcional) --
                                      </option>
                                      {consumables.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name} (Disp: {formatNumber(c.quantity)} {c.unit})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="col-span-4 flex items-center gap-1.5">
                                    <NumberInput
                                      allowDecimal
                                      emptyWhenZero
                                      value={row.quantity}
                                      onChangeValue={(val) =>
                                        setDraftItems((prev) =>
                                          prev.map((it, i) =>
                                            i === idx
                                              ? {
                                                  ...it,
                                                  materialsToDeduct: it.materialsToDeduct.map((r) =>
                                                    r.rowId === row.rowId
                                                      ? { ...r, quantity: val }
                                                      : r
                                                  ),
                                                }
                                              : it
                                          )
                                        )
                                      }
                                      placeholder="Cant."
                                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-md"
                                    />
                                    <span className="text-[11px] text-[#6E675F] shrink-0 min-w-[24px]">
                                      {inv?.unit || ''}
                                    </span>
                                  </div>

                                  <div className="col-span-1 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraftItems((prev) =>
                                          prev.map((it, i) =>
                                            i === idx
                                              ? {
                                                  ...it,
                                                  materialsToDeduct:
                                                    it.materialsToDeduct.filter(
                                                      (r) => r.rowId !== row.rowId
                                                    ),
                                                }
                                              : it
                                          )
                                        )
                                      }
                                      title="Quitar elemento"
                                      aria-label="Quitar elemento"
                                      className="p-1 text-[#6E675F] hover:text-[#B91C1C]"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {inv && row.quantity > 0 && (
                                  <p
                                    className={`text-[11px] tabular-nums pl-0.5 ${
                                      remaining < 0 ? 'text-[#B91C1C]' : 'text-[#436B49]'
                                    }`}
                                  >
                                    {remaining < 0
                                      ? `Supera existencias disponibles (${formatNumber(inv.quantity)} ${inv.unit}). Quedaría en ${formatNumber(remaining)} ${inv.unit}.`
                                      : `Quedará en inventario: ${formatNumber(remaining)} ${inv.unit} · Costo material: ${formatCOP(row.quantity * inv.unitCost)}`}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Observaciones generales, referencias o instrucciones especiales
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Referencias enviadas por el cliente, dedicatorias, empaque especial..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
            />
          </div>

          {!editingOrder && (
            <div className="p-4 rounded-xl border border-[#EDE2D8] bg-[#FAF6F2] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#3B281E]">
                  ¿El cliente realizó un abono o pago total?
                </span>
                <span className="text-[11px] text-[#7D6659]">
                  Se registrará automáticamente en Ventas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('ninguno')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                    paymentMode === 'ninguno'
                      ? 'bg-[#AF8064] text-white border-[#AF8064]'
                      : 'bg-white text-[#3B281E] border-[#D9D3CA] hover:bg-[#F4E7DE]/50'
                  }`}
                >
                  <span className="block font-semibold">Sin pago inicial</span>
                  <span
                    className={`block text-[11px] ${
                      paymentMode === 'ninguno' ? 'text-white/85' : 'text-[#7D6659]'
                    }`}
                  >
                    Queda pendiente por cobrar
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('abono')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                    paymentMode === 'abono'
                      ? 'bg-[#AF8064] text-white border-[#AF8064]'
                      : 'bg-white text-[#3B281E] border-[#D9D3CA] hover:bg-[#F4E7DE]/50'
                  }`}
                >
                  <span className="block font-semibold">Hizo un abono</span>
                  <span
                    className={`block text-[11px] ${
                      paymentMode === 'abono' ? 'text-white/85' : 'text-[#7D6659]'
                    }`}
                  >
                    Pago parcial / anticipo
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('total')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                    paymentMode === 'total'
                      ? 'bg-[#AF8064] text-white border-[#AF8064]'
                      : 'bg-white text-[#3B281E] border-[#D9D3CA] hover:bg-[#F4E7DE]/50'
                  }`}
                >
                  <span className="block font-semibold">Pago total</span>
                  <span
                    className={`block text-[11px] ${
                      paymentMode === 'total' ? 'text-white/85' : 'text-[#7D6659]'
                    }`}
                  >
                    Cancela el 100% del pedido
                  </span>
                </button>
              </div>

              {paymentMode !== 'ninguno' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {paymentMode === 'abono' ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#3B281E] mb-1">
                        Valor del abono (COP) *
                      </label>
                      <NumberInput
                        allowDecimal={false}
                        value={initialAbonoAmount}
                        onChangeText={setInitialAbonoAmount}
                        placeholder="Ej. 35000"
                        required
                        className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
                      />
                      {draftTotal > 0 && (
                        <span className="block text-[11px] text-[#7D6659] mt-1 tabular-nums">
                          Saldo pendiente:{' '}
                          <strong className="text-[#3B281E]">
                            {formatCOP(
                              Math.max(0, draftTotal - (parseFloat(initialAbonoAmount) || 0))
                            )}
                          </strong>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="block text-[11px] font-semibold text-[#3B281E] mb-1">
                        Valor a registrar (100%)
                      </span>
                      <div className="px-3 py-1.5 text-sm font-mono font-bold tabular-nums bg-white border border-[#EDE2D8] rounded-lg text-[#15803D]">
                        {formatCOP(draftTotal)}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-[#3B281E] mb-1">
                      Método de pago *
                    </label>
                    <select
                      value={initialPayMethod}
                      onChange={(e) => setInitialPayMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-[#D9D3CA] rounded-lg"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#3B281E] mb-1">
                      Fecha del pago *
                    </label>
                    <input
                      type="date"
                      value={initialPayDate}
                      onChange={(e) => setInitialPayDate(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-sm bg-white border border-[#D9D3CA] rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={initialPayObs}
                      onChange={(e) => setInitialPayObs(e.target.value)}
                      placeholder="Nota del pago (opcional, ej. Transferencia Nequi)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-[#D9D3CA] rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {(draftDeductionTotals.hasShortage || orderAuthorizeNegative) && (
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#78350F] cursor-pointer">
              <input
                type="checkbox"
                checked={orderAuthorizeNegative}
                onChange={(e) => setOrderAuthorizeNegative(e.target.checked)}
                className="mt-0.5 rounded border-[#D97706] text-[#7C3A52]"
              />
              <span>
                Autorizar el descuento aunque algún elemento quede temporalmente con saldo negativo en el inventario.
              </span>
            </label>
          )}

          <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC] flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="block text-xs text-[#6E675F]">
                Subtotal: <strong className="font-mono tabular-nums">{formatCOP(draftSubtotal)}</strong> · Descuento:{' '}
                <strong className="font-mono tabular-nums">{formatCOP(discount)}</strong>
              </span>
              {draftDeductionTotals.uniqueMaterialsCount > 0 && (
                <span className="block text-[11px] text-[#436B49] font-medium tabular-nums">
                  Se descontarán {draftDeductionTotals.uniqueMaterialsCount}{' '}
                  {draftDeductionTotals.uniqueMaterialsCount === 1 ? 'elemento' : 'elementos'} del
                  inventario al confirmar ({formatCOP(draftDeductionTotals.totalCost)} en materiales).
                </span>
              )}
            </div>
            <span className="text-base font-bold font-mono tabular-nums text-[#3B281E]">
              Total pedido: {formatCOP(draftTotal)}
            </span>
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
              className="px-4 py-2 text-sm font-medium text-white bg-[#AF8064] hover:bg-[#976B51] rounded-lg"
            >
              {editingOrder ? 'Guardar cambios' : 'Confirmar pedido'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal calculadora rápida por ítem */}
      <Modal
        isOpen={inlineCalcIndex !== null}
        onClose={() => setInlineCalcIndex(null)}
        title="Calculadora rápida para el producto"
        subtitle="Calcula costo unitario y precio sugerido usando el margen sobre precio de venta."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Costo estimado materiales y empaques (COP)
            </label>
            <NumberInput
              allowDecimal={false}
              value={icMaterialCost}
              onChangeValue={setIcMaterialCost}
              placeholder="0"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Mano de obra por unidad (COP)
            </label>
            <NumberInput
              allowDecimal={false}
              value={icLaborCost}
              onChangeValue={setIcLaborCost}
              placeholder="0"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Desgaste herramientas y adicionales (COP)
            </label>
            <NumberInput
              allowDecimal={false}
              value={icWearAndExtras}
              onChangeValue={setIcWearAndExtras}
              placeholder="0"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Margen deseado sobre venta (%)
            </label>
            <NumberInput
              allowDecimal
              value={icMargin}
              onChangeValue={setIcMargin}
              placeholder="0"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
            />
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC] space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6E675F]">Costo total unitario</span>
              <strong className="font-mono tabular-nums">{formatCOP(icTotalCost)}</strong>
            </div>
            <div className="flex justify-between text-sm text-[#7C3A52]">
              <span className="font-semibold">Precio de venta sugerido</span>
              <strong className="font-mono tabular-nums">{formatCOP(icSuggestedPrice)}</strong>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setInlineCalcIndex(null)}
              className="px-4 py-2 text-sm font-medium text-[#1F1C19] bg-white border border-[#D9D3CA] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={applyInlineCalc}
              className="px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] rounded-lg"
            >
              Aplicar al producto
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Terminar producto y descontar materiales reales del inventario */}
      <Modal
        isOpen={finishTarget !== null}
        onClose={() => setFinishTarget(null)}
        title="Terminar producto y descontar inventario"
        subtitle={
          finishTarget
            ? `${finishTarget.order.orderNumber} · ${finishTarget.item.quantity} × ${finishTarget.item.productName}`
            : ''
        }
        maxWidthClass="max-w-2xl"
      >
        {finishTarget && (
          <form onSubmit={handleConfirmFinishItem} className="space-y-4">
            {finishError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                {finishError}
              </div>
            )}

            <p className="text-xs text-[#5A5550] leading-relaxed">
              Registra las cantidades <strong>totales realmente utilizadas</strong> para elaborar{' '}
              <strong>
                {finishTarget.item.quantity}{' '}
                {finishTarget.item.quantity === 1 ? 'unidad' : 'unidades'}
              </strong>{' '}
              de este producto. Solo se descuentan materiales consumibles (las herramientas no se descuentan).
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1F1C19]">
                  Materiales consumibles utilizados
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setConsumedRows((prev) => [
                      ...prev,
                      {
                        rowId: generateId('fin'),
                        inventoryItemId: consumables[0]?.id || '',
                        quantity: 0,
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#7C3A52] bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar material</span>
                </button>
              </div>

              {consumedRows.map((row) => {
                const inv = consumables.find((c) => c.id === row.inventoryItemId);
                return (
                  <div
                    key={row.rowId}
                    className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-lg bg-[#FAF9F7] border border-[#E7E3DC]"
                  >
                    <div className="col-span-7">
                      <select
                        value={row.inventoryItemId}
                        onChange={(e) =>
                          setConsumedRows((prev) =>
                            prev.map((r) =>
                              r.rowId === row.rowId
                                ? { ...r, inventoryItemId: e.target.value }
                                : r
                            )
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D9D3CA] rounded-md"
                      >
                        <option value="">-- Seleccionar material --</option>
                        {consumables.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (Disp: {formatNumber(c.quantity)} {c.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 flex items-center gap-1.5">
                      <NumberInput
                        allowDecimal
                        value={row.quantity}
                        onChangeValue={(val) =>
                          setConsumedRows((prev) =>
                            prev.map((r) =>
                              r.rowId === row.rowId ? { ...r, quantity: val } : r
                            )
                          )
                        }
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-md"
                      />
                      <span className="text-xs text-[#6E675F] shrink-0">
                        {inv?.unit || ''}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setConsumedRows((prev) =>
                            prev.filter((r) => r.rowId !== row.rowId)
                          )
                        }
                        className="p-1 text-[#6E675F] hover:text-[#B91C1C]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E7E3DC]">
              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Mano de obra + desgaste por unidad (COP)
                </label>
                <NumberInput
                  allowDecimal={false}
                  value={finishLaborExtras}
                  onChangeValue={setFinishLaborExtras}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
                />
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E7E3DC] text-xs flex flex-col justify-center">
                <span className="text-[#6E675F]">Costo real materiales (total):</span>
                <strong className="font-mono text-sm tabular-nums text-[#1F1C19]">
                  {formatCOP(finishEstimatedMaterialsCost)}
                </strong>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-[#5A5550] cursor-pointer">
              <input
                type="checkbox"
                checked={finishAuthorizeNegative}
                onChange={(e) => setFinishAuthorizeNegative(e.target.checked)}
                className="mt-0.5 rounded border-[#D9D3CA] text-[#7C3A52]"
              />
              <span>
                Autorizar descuento excepcional aunque algún material quede con saldo negativo temporalmente
              </span>
            </label>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#E7E3DC]">
              <button
                type="button"
                onClick={() => setFinishTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#1F1C19] bg-white border border-[#D9D3CA] rounded-lg hover:bg-[#F3F0EB]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg"
              >
                Confirmar producto terminado
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal rápido de abono desde detalle de pedido */}
      <Modal
        isOpen={quickPayOrder !== null}
        onClose={() => setQuickPayOrder(null)}
        title={
          quickPayOrder ? `Registrar abono a ${quickPayOrder.orderNumber}` : ''
        }
        maxWidthClass="max-w-md"
      >
        {quickPayOrder && (
          <form onSubmit={handleQuickPaySubmit} className="space-y-4">
            {qpError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                {qpError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Valor recibido (COP) *
                </label>
                <NumberInput
                  allowDecimal={false}
                  value={qpAmount}
                  onChangeText={setQpAmount}
                  placeholder="Ej. 25000"
                  required
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={qpDate}
                  onChange={(e) => setQpDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Tipo de pago *
              </label>
              <select
                value={qpMethod}
                onChange={(e) => setQpMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Observaciones
              </label>
              <input
                type="text"
                value={qpObs}
                onChange={(e) => setQpObs(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E7E3DC]">
              <button
                type="button"
                onClick={() => setQuickPayOrder(null)}
                className="px-4 py-2 text-sm font-medium text-[#1F1C19] bg-white border border-[#D9D3CA] rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] rounded-lg"
              >
                Guardar abono
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
            const res = deleteOrder(deleteTarget.id);
            if (!res.ok && res.error) {
              addToast('error', 'No se pudo eliminar', res.error);
            }
          }
        }}
        title="¿Eliminar pedido?"
        message={
          deleteTarget
            ? `Se eliminará el pedido ${deleteTarget.orderNumber} de forma permanente.`
            : ''
        }
        confirmLabel="Eliminar pedido"
      />
    </div>
  );
};
