import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Calculator,
  Calendar,
  ClipboardList,
  Clock,
  Coins,
  Gift,
  Heart,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import {
  formatCOP,
  formatDate,
  formatNumber,
  getCurrentMonthPrefix,
  getMonthLabel,
  normalizeProductKey,
} from '../utils/format';
import { Modal } from '../components/ui/Modal';
import { PaymentStatusLabel } from '../components/ui/StatusText';
import { NumberInput } from '../components/ui/NumberInput';
import { ThemeToggle } from '../components/ThemeToggle';

const BAR_COLORS = ['#AF8064', '#DFBBAE', '#EED5C7', '#F3E1D6', '#9D7860'];

function formatShortDateES(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = [
    'Ene.',
    'Feb.',
    'Mar.',
    'Abr.',
    'May.',
    'Jun.',
    'Jul.',
    'Ago.',
    'Sep.',
    'Oct.',
    'Nov.',
    'Dic.',
  ];
  const mIdx = parseInt(m, 10) - 1;
  if (!y || mIdx < 0 || mIdx > 11) return dateStr;
  return `${parseInt(d, 10)} ${months[mIdx]} ${y}`;
}

function splitCOPNumber(value: number): { main: string; suffix: string } {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const formatted = Math.abs(safe).toLocaleString('es-CO');
  return {
    main: safe < 0 ? `-$${formatted}` : `$${formatted}`,
    suffix: 'COP',
  };
}

export const DashboardView: React.FC = () => {
  const {
    data,
    monthlyBudget: customBudget,
    updateMonthlyBudget,
    setActiveModule,
    setPreselectedPurchaseMaterialId,
    setAutoOpenCreateFor,
    getOrderTotal,
    getOrderPending,
    getOrderPaymentStatus,
  } = useDinemelly();

  const [searchQuery, setSearchQuery] = useState('');
  const [firstRegisterOpen, setFirstRegisterOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');

  const hasAnyRecord =
    data.purchases.length > 0 ||
    data.orders.length > 0 ||
    data.clients.length > 0 ||
    data.inventory.length > 0 ||
    data.calculations.length > 0 ||
    data.payments.length > 0;

  const currentMonth = getCurrentMonthPrefix();
  const monthLabel = getMonthLabel(currentMonth);

  const prevMonthPrefix = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [currentMonth]);

  const metrics = useMemo(() => {
    const activeOrders = data.orders.filter((o) => o.status !== 'cancelado');
    const monthOrders = activeOrders.filter((o) => o.requestDate.startsWith(currentMonth));
    const prevOrders = activeOrders.filter((o) => o.requestDate.startsWith(prevMonthPrefix));

    const monthOrdersCount = monthOrders.length;
    const prevOrdersCount = prevOrders.length;
    const monthSalesTotal = monthOrders.reduce((s, o) => s + getOrderTotal(o), 0);
    const prevSalesTotal = prevOrders.reduce((s, o) => s + getOrderTotal(o), 0);

    const monthPaymentsReceived = data.payments
      .filter((p) => p.date.startsWith(currentMonth))
      .reduce((s, p) => s + p.amount, 0);
    const prevPaymentsReceived = data.payments
      .filter((p) => p.date.startsWith(prevMonthPrefix))
      .reduce((s, p) => s + p.amount, 0);

    const pendingReceivable = activeOrders.reduce((s, o) => s + getOrderPending(o), 0);

    const monthPurchasesSpent = data.purchases
      .filter((p) => p.date.startsWith(currentMonth))
      .reduce((s, p) => s + p.totalPrice, 0);

    const calcDelta = (curr: number, prev: number): number | null => {
      if (prev <= 0 || curr <= 0) return null;
      return Math.round(((curr - prev) / prev) * 100);
    };

    // Productos más vendidos (mismo nombre agrupado en un solo ítem sin importar pedido o cliente)
    const productSalesMap = new Map<
      string,
      { key: string; name: string; quantity: number; revenue: number }
    >();
    for (const order of activeOrders) {
      for (const item of order.items) {
        const key = normalizeProductKey(item.productName);
        if (!key) continue;
        const cleanName = item.productName.trim().replace(/\s+/g, ' ');
        const current = productSalesMap.get(key) || {
          key,
          name: cleanName,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += item.quantity;
        current.revenue += item.quantity * item.unitSalePrice;
        productSalesMap.set(key, current);
      }
    }
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5);

    const q = searchQuery.trim().toLowerCase();

    const clientStatsMap = new Map<string, { ordersCount: number; totalSpent: number }>();
    for (const ord of activeOrders) {
      const curr = clientStatsMap.get(ord.clientId) || { ordersCount: 0, totalSpent: 0 };
      curr.ordersCount += 1;
      curr.totalSpent += getOrderTotal(ord);
      clientStatsMap.set(ord.clientId, curr);
    }

    type RecentActivityItem = {
      id: string;
      title: string;
      subtitle: string;
      date: string;
      tag: 'Venta' | 'Compra';
      iconKind: 'yarn' | 'eye' | 'gift';
      targetModule: 'pedidos' | 'compras';
    };

    const orderActivities: RecentActivityItem[] = activeOrders.map((ord, idx) => {
      const clientName =
        data.clients.find((c) => c.id === ord.clientId)?.name || 'Cliente';
      const cStat = clientStatsMap.get(ord.clientId);
      const icons: ('yarn' | 'eye' | 'gift')[] = ['yarn', 'eye', 'gift'];
      return {
        id: `act_ord_${ord.id}`,
        title: clientName,
        subtitle: `${cStat?.ordersCount || 1} ${
          (cStat?.ordersCount || 1) === 1 ? 'pedido' : 'pedidos'
        } · ${formatCOP(getOrderTotal(ord))}`,
        date: ord.requestDate,
        tag: 'Venta',
        iconKind: icons[idx % icons.length],
        targetModule: 'pedidos',
      };
    });

    const purchaseActivities: RecentActivityItem[] = data.purchases.map((pur) => ({
      id: `act_pur_${pur.id}`,
      title: pur.materialName,
      subtitle: `${formatNumber(pur.quantity)} ${pur.unit} · ${formatCOP(pur.totalPrice)}`,
      date: pur.date,
      tag: 'Compra',
      iconKind: 'gift',
      targetModule: 'compras',
    }));

    const recentMovements = [...orderActivities, ...purchaseActivities]
      .filter((item) => {
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.tag.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);

    // Materiales con existencias bajas
    const lowStockItems = data.inventory
      .filter(
        (item) =>
          item.status === 'activo' &&
          item.itemType === 'consumible' &&
          item.quantity < item.minStock &&
          (!q || item.name.toLowerCase().includes(q))
      )
      .sort((a, b) => a.quantity / Math.max(1, a.minStock) - b.quantity / Math.max(1, b.minStock));

    // Pedidos recientes
    const recentOrders = activeOrders
      .filter((o) => {
        if (!q) return true;
        const cName =
          data.clients.find((c) => c.id === o.clientId)?.name.toLowerCase() || '';
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          cName.includes(q) ||
          o.items.some((it) => it.productName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.requestDate.localeCompare(a.requestDate));

    return {
      monthOrdersCount,
      ordersDelta: calcDelta(monthOrdersCount, prevOrdersCount),
      monthSalesTotal,
      salesDelta: calcDelta(monthSalesTotal, prevSalesTotal),
      monthPaymentsReceived,
      paymentsDelta: calcDelta(monthPaymentsReceived, prevPaymentsReceived),
      pendingReceivable,
      monthPurchasesSpent,
      topProducts,
      recentMovements,
      lowStockItems,
      recentOrders,
    };
  }, [
    data.orders,
    data.payments,
    data.clients,
    data.inventory,
    data.purchases,
    currentMonth,
    prevMonthPrefix,
    searchQuery,
    getOrderTotal,
    getOrderPending,
  ]);

  const handleSaveBudget = () => {
    const trimmed = budgetDraft.trim();
    if (!trimmed) {
      updateMonthlyBudget(null);
      setEditingBudget(false);
      return;
    }
    const val = parseFloat(trimmed);
    if (Number.isFinite(val) && val > 0) {
      updateMonthlyBudget(Math.round(val));
    }
    setEditingBudget(false);
  };

  const handleResetAutoBudget = () => {
    updateMonthlyBudget(null);
    setBudgetDraft('');
    setEditingBudget(false);
  };

  // Cálculos automáticos de Donut "Resumen financiero del mes"
  const isAutoFinancial = customBudget === null;
  const financialReference = isAutoFinancial
    ? metrics.monthPaymentsReceived
    : customBudget;
  const budgetPct =
    financialReference > 0
      ? Math.min(100, Math.round((metrics.monthPurchasesSpent / financialReference) * 100))
      : metrics.monthPurchasesSpent > 0
        ? 100
        : 0;
  const budgetRemaining = financialReference - metrics.monthPurchasesSpent;
  const donutRadius = 46;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutStrokeDashoffset =
    donutCircumference - (budgetPct / 100) * donutCircumference;

  const maxProductQty = Math.max(1, ...metrics.topProducts.map((p) => p.quantity));

  const salesFmt = splitCOPNumber(metrics.monthSalesTotal);
  const receivedFmt = splitCOPNumber(metrics.monthPaymentsReceived);
  const pendingFmt = splitCOPNumber(metrics.pendingReceivable);

  const clientNameById = (id: string) =>
    data.clients.find((c) => c.id === id)?.name || 'Cliente';

  return (
    <div className="space-y-5">
      {/* Cabecera saludo estilo mockup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#3B281E] tracking-tight">
            ¡Hola!
          </h1>
          <span className="font-display text-lg sm:text-[21px] text-[#4D3A2F] font-normal">
            Aquí tienes el resumen de tu negocio
          </span>
          <Heart className="w-4 h-4 text-[#8C634C] shrink-0" />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-[#8D7668] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              aria-label="Buscar en inicio"
              className="w-full pl-9 pr-4 py-2 text-xs bg-white/80 border border-[#E5D7CD] rounded-full text-[#3B281E] placeholder-[#9B8578] focus:outline-none focus:border-[#AF8064]"
            />
          </div>
          <ThemeToggle compact className="hidden lg:inline-flex rounded-full" />
          <button
            type="button"
            onClick={() => setActiveModule('pedidos')}
            className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#AF8064] hover:bg-[#976B51] rounded-full transition-colors whitespace-nowrap shrink-0"
          >
            <span>Nuevo pedido</span>
          </button>
        </div>
      </div>

      {/* Grilla de KPIs (4 tarjetas en fila superior) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Pedidos del mes */}
        <div className="bg-[#FBF6F1] border border-[#EDE2D8] rounded-2xl px-4 py-4 shadow-[0_4px_18px_rgba(92,62,46,0.03)] flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#F1DFD3] text-[#9E7358] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#6B5447]">Pedidos del mes</p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold tabular-nums text-[#3B281E]">
                {metrics.monthOrdersCount}
              </span>
              {metrics.ordersDelta !== null && (
                <span className="text-[11px] font-semibold text-[#436B49] bg-[#E6F0E4] px-1.5 py-0.5 rounded-md tabular-nums">
                  {metrics.ordersDelta >= 0 ? '↑ +' : '↓ '}
                  {metrics.ordersDelta}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Ventas del mes */}
        <div className="bg-[#FBF6F1] border border-[#EDE2D8] rounded-2xl px-4 py-4 shadow-[0_4px_18px_rgba(92,62,46,0.03)] flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#F1DFD3] text-[#9E7358] flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#6B5447]">Ventas del mes</p>
            <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
              <span className="font-display text-[21px] font-bold tabular-nums text-[#3B281E] leading-none">
                {salesFmt.main}
              </span>
              <span className="text-[11px] font-semibold text-[#6B5447]">
                {salesFmt.suffix}
              </span>
              {metrics.salesDelta !== null && (
                <span className="text-[11px] font-semibold text-[#436B49] bg-[#E6F0E4] px-1.5 py-0.5 rounded-md tabular-nums">
                  {metrics.salesDelta >= 0 ? '↑ +' : '↓ '}
                  {metrics.salesDelta}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Dinero recibido */}
        <div className="bg-[#FBF6F1] border border-[#EDE2D8] rounded-2xl px-4 py-4 shadow-[0_4px_18px_rgba(92,62,46,0.03)] flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#F1DFD3] text-[#9E7358] flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#6B5447]">Dinero recibido</p>
            <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
              <span className="font-display text-[21px] font-bold tabular-nums text-[#3B281E] leading-none">
                {receivedFmt.main}
              </span>
              <span className="text-[11px] font-semibold text-[#6B5447]">
                {receivedFmt.suffix}
              </span>
              {metrics.paymentsDelta !== null && (
                <span className="text-[11px] font-semibold text-[#436B49] bg-[#E6F0E4] px-1.5 py-0.5 rounded-md tabular-nums">
                  {metrics.paymentsDelta >= 0 ? '↑ +' : '↓ '}
                  {metrics.paymentsDelta}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Pendiente por cobrar */}
        <div className="bg-[#FBF6F1] border border-[#EDE2D8] rounded-2xl px-4 py-4 shadow-[0_4px_18px_rgba(92,62,46,0.03)] flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#F1DFD3] text-[#9E7358] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#6B5447]">Pendiente por cobrar</p>
            <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
              <span className="font-display text-[21px] font-bold tabular-nums text-[#3B281E] leading-none">
                {pendingFmt.main}
              </span>
              <span className="text-[11px] font-semibold text-[#6B5447]">
                {pendingFmt.suffix}
              </span>
            </div>
          </div>
        </div>
      </section>

      {!hasAnyRecord ? (
        <section className="bg-[#FDFBFA] border border-[#EDE2D8] rounded-2xl px-6 py-14 sm:py-16 shadow-[0_4px_20px_rgba(92,62,46,0.03)] flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F4E7DE] text-[#9E7358] flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#3B281E]">
            Aún no hay registros este mes
          </h2>
          <p className="mt-2 text-sm text-[#7D6659] max-w-md">
            Registra el primero y empieza a ver como se mueve el negocio
          </p>
          <button
            type="button"
            onClick={() => setFirstRegisterOpen(true)}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#AF8064] hover:bg-[#976B51] rounded-xl transition-colors shadow-[0_6px_14px_rgba(175,128,100,0.25)]"
          >
            <Plus className="w-4 h-4" />
            <span>Haz tu primer registro</span>
          </button>
        </section>
      ) : (
        <>
          {/* Fila media: Resumen financiero del mes + Productos más vendidos */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Resumen financiero del mes */}
        <div className="lg:col-span-6 bg-[#FDFBFA] border border-[#EDE2D8] rounded-2xl p-5 shadow-[0_4px_20px_rgba(92,62,46,0.03)]">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#9E7358]" />
              <h2 className="font-display text-base font-semibold text-[#3B281E]">
                Resumen financiero del mes
              </h2>
            </div>
            <span className="text-[11px] text-[#7D6659] capitalize">{monthLabel}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
            <div className="sm:col-span-7 flex items-center gap-5">
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                  <circle
                    cx="56"
                    cy="56"
                    r={donutRadius}
                    fill="none"
                    stroke="#EAD7C9"
                    strokeWidth="15"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={donutRadius}
                    fill="none"
                    stroke="#AF8064"
                    strokeWidth="15"
                    strokeLinecap="round"
                    strokeDasharray={donutCircumference}
                    strokeDashoffset={donutStrokeDashoffset}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-display text-xl font-bold tabular-nums text-[#3B281E] leading-none">
                    {budgetPct}%
                  </span>
                  <span className="text-[11px] text-[#6B5447] mt-0.5">Gastado</span>
                </div>
              </div>

              <div className="space-y-3 text-xs min-w-0">
                <div>
                  <div className="flex items-center gap-1.5 text-[#5D473A] font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#AF8064] shrink-0" />
                    <span>Gastado en compras</span>
                  </div>
                  <p className="font-mono font-bold tabular-nums text-[#3B281E] pl-3.5 mt-0.5">
                    {formatCOP(metrics.monthPurchasesSpent)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[#5D473A] font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#DFBBAE] shrink-0" />
                    <span>{isAutoFinancial ? 'Balance disponible' : 'Disponible'}</span>
                  </div>
                  <p
                    className={`font-mono font-bold tabular-nums pl-3.5 mt-0.5 ${
                      budgetRemaining < 0 ? 'text-[#B91C1C]' : 'text-[#3B281E]'
                    }`}
                  >
                    {formatCOP(budgetRemaining)}
                  </p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-5 sm:border-l sm:border-[#EDE2D8] sm:pl-5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#6B5447]">
                  {isAutoFinancial ? 'Ingresos recibidos (mes)' : 'Presupuesto mensual'}
                </span>
                <div className="flex items-center gap-1">
                  {!isAutoFinancial && (
                    <button
                      type="button"
                      onClick={handleResetAutoBudget}
                      title="Volver al cálculo automático"
                      className="px-1.5 py-0.5 text-[10px] font-medium text-[#7C5944] bg-[#F4E7DE] hover:bg-[#EAD5C6] rounded"
                    >
                      Auto
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetDraft(
                        customBudget !== null
                          ? String(customBudget)
                          : metrics.monthPaymentsReceived > 0
                            ? String(Math.round(metrics.monthPaymentsReceived))
                            : ''
                      );
                      setEditingBudget((v) => !v);
                    }}
                    title="Configurar presupuesto manual o automático"
                    className="p-1 rounded text-[#8C634C] hover:bg-[#F1DFD3]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {editingBudget ? (
                <div className="flex items-center gap-1.5">
                  <NumberInput
                    allowDecimal={false}
                    value={budgetDraft}
                    onChangeText={setBudgetDraft}
                    placeholder="Vacío = automático"
                    className="w-full px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-[#D7C3B5] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleSaveBudget}
                    className="px-2.5 py-1 text-xs font-medium text-white bg-[#AF8064] rounded-lg"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <p className="font-display text-lg font-bold tabular-nums text-[#3B281E]">
                  {formatCOP(financialReference)}
                </p>
              )}

              <div className="w-full h-3.5 bg-[#EAD7C9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#AF8064] rounded-full transition-all duration-300"
                  style={{ width: `${budgetPct}%` }}
                />
              </div>

              <p className="text-[11px] text-[#7D6659] tabular-nums">
                {isAutoFinancial
                  ? `Ventas del mes: ${formatCOP(metrics.monthSalesTotal)}`
                  : `Ingresos recibidos del mes: ${formatCOP(metrics.monthPaymentsReceived)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Productos más vendidos */}
        <div className="lg:col-span-6 bg-[#FDFBFA] border border-[#EDE2D8] rounded-2xl p-5 shadow-[0_4px_20px_rgba(92,62,46,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[#AF8064] fill-[#AF8064]" />
              <h2 className="font-display text-base font-semibold text-[#3B281E]">
                Productos más vendidos
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('estadisticas')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#9E7358] hover:text-[#3B281E] transition-colors whitespace-nowrap"
            >
              <span>Ver más</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {metrics.topProducts.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#7D6659]">
              Registra tus primeros pedidos para visualizar el ranking de productos más vendidos.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3 items-end pt-4 min-h-[148px]">
              {metrics.topProducts.map((prod, idx) => {
                const heightPct = Math.max(
                  20,
                  Math.round((prod.quantity / maxProductQty) * 100)
                );
                const color = BAR_COLORS[idx % BAR_COLORS.length];
                return (
                  <div
                    key={prod.key}
                    className="flex flex-col items-center justify-end h-full group"
                    title={`${prod.name}: ${prod.quantity} uds (${formatCOP(prod.revenue)})`}
                  >
                    <span className="text-xs font-bold font-mono tabular-nums text-[#3B281E] mb-1.5">
                      {prod.quantity}
                    </span>
                    <div className="w-full max-w-[64px] h-[88px] flex items-end justify-center">
                      <div
                        className="w-full rounded-t-xl transition-all duration-300"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="mt-2 text-[11px] font-medium text-[#5D473A] text-center leading-tight line-clamp-2">
                      {prod.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Fila inferior: Últimos movimientos + Materiales con existencias bajas */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Últimos movimientos */}
        <div className="lg:col-span-6 bg-[#FDFBFA] border border-[#EDE2D8] rounded-2xl p-5 shadow-[0_4px_20px_rgba(92,62,46,0.03)]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9E7358]" />
              <h2 className="font-display text-base font-semibold text-[#3B281E]">
                Últimos movimientos
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('ventas')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#9E7358] hover:text-[#3B281E] transition-colors whitespace-nowrap"
            >
              <span>Ver más</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {metrics.recentMovements.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#7D6659]">
              No hay movimientos recientes que coincidan con tu búsqueda.
            </p>
          ) : (
            <div className="divide-y divide-[#EDE2D8]">
              {metrics.recentMovements.map((mov) => (
                <div
                  key={mov.id}
                  onClick={() => setActiveModule(mov.targetModule)}
                  className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#F7EFE8]/60 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#EFE0D4] text-[#8C634C] flex items-center justify-center shrink-0">
                      {mov.iconKind === 'yarn' ? (
                        <Sparkles className="w-4 h-4" />
                      ) : mov.iconKind === 'eye' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <Gift className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#3B281E] truncate">
                        {mov.title}
                      </p>
                      <p className="text-xs text-[#7D6659] tabular-nums truncate">
                        {mov.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:inline-block text-xs text-[#7D6659] whitespace-nowrap">
                      {formatShortDateES(mov.date)}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-xl whitespace-nowrap ${
                        mov.tag === 'Venta'
                          ? 'bg-[#E6F0E4] text-[#436B49]'
                          : 'bg-[#F3E1D6] text-[#8C5B42]'
                      }`}
                    >
                      {mov.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Materiales con existencias bajas */}
        <div className="lg:col-span-6 bg-[#FDFBFA] border border-[#EDE2D8] rounded-2xl p-5 shadow-[0_4px_20px_rgba(92,62,46,0.03)]">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EDE2D8]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B45309]" />
              <h2 className="font-display text-base font-semibold text-[#3B281E]">
                Materiales con existencias bajas
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('inventario')}
              className="text-xs font-medium text-[#9E7358] hover:text-[#3B281E]"
            >
              Ver inventario
            </button>
          </div>

          {metrics.lowStockItems.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#436B49] font-medium">
              Todos los materiales consumibles están sobre su nivel mínimo.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-[#EDE2D8]">
              {metrics.lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#3B281E] truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-[#7D6659] tabular-nums">
                      Disponible:{' '}
                      <strong className="text-[#B91C1C]">
                        {formatNumber(item.quantity)} {item.unit}
                      </strong>{' '}
                      · Mínimo: {formatNumber(item.minStock)} {item.unit}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreselectedPurchaseMaterialId(item.id);
                      setActiveModule('compras');
                    }}
                    className="px-3 py-1 text-xs font-medium text-[#7C5944] bg-[#F4E7DE] hover:bg-[#EAD5C6] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Reponer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Pedidos recientes */}
      <section className="bg-[#FDFBFA] border border-[#EDE2D8] rounded-2xl p-5 shadow-[0_4px_20px_rgba(92,62,46,0.03)]">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EDE2D8]">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#9E7358]" />
            <h2 className="font-display text-base font-semibold text-[#3B281E]">
              Pedidos recientes
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('pedidos')}
            className="text-xs font-medium text-[#9E7358] hover:text-[#3B281E]"
          >
            Gestionar pedidos
          </button>
        </div>

        {metrics.recentOrders.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#7D6659]">
            Aún no hay pedidos registrados que coincidan con tu búsqueda.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EDE2D8] text-[11px] font-semibold text-[#7D6659]">
                  <th className="py-2 pr-3">Pedido</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Entrega</th>
                  <th className="py-2 pr-3">Pago</th>
                  <th className="py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE2D8] text-xs">
                {metrics.recentOrders.slice(0, 5).map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => setActiveModule('pedidos')}
                    className="hover:bg-[#F7EFE8]/60 cursor-pointer"
                  >
                    <td className="py-2.5 pr-3 font-mono font-semibold text-[#3B281E] whitespace-nowrap">
                      {ord.orderNumber}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-[#3B281E] truncate max-w-[160px]">
                      {clientNameById(ord.clientId)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-[#7D6659] whitespace-nowrap">
                      {formatDate(ord.deliveryDate)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <PaymentStatusLabel status={getOrderPaymentStatus(ord)} />
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[#3B281E] whitespace-nowrap">
                      {formatCOP(getOrderPending(ord))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </>
      )}

      <Modal
        isOpen={firstRegisterOpen}
        onClose={() => setFirstRegisterOpen(false)}
        title="Haz tu primer registro"
        subtitle="Elige qué deseas registrar primero para empezar a ver el movimiento de Dinemelly."
        maxWidthClass="max-w-lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setFirstRegisterOpen(false);
              setAutoOpenCreateFor('compras');
              setActiveModule('compras');
            }}
            className="flex items-start gap-3 p-3.5 text-left rounded-xl border border-[#EDE2D8] bg-[#FAF6F2] hover:bg-[#F4E7DE] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[#AF8064] text-white flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3B281E]">Registrar compra</p>
              <p className="text-xs text-[#7D6659] mt-0.5">Hilos, lanas, accesorios o herramientas</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFirstRegisterOpen(false);
              setAutoOpenCreateFor('pedidos');
              setActiveModule('pedidos');
            }}
            className="flex items-start gap-3 p-3.5 text-left rounded-xl border border-[#EDE2D8] bg-[#FAF6F2] hover:bg-[#F4E7DE] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[#AF8064] text-white flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3B281E]">Registrar pedido</p>
              <p className="text-xs text-[#7D6659] mt-0.5">Crea el primer pedido de un cliente</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFirstRegisterOpen(false);
              setAutoOpenCreateFor('inventario');
              setActiveModule('inventario');
            }}
            className="flex items-start gap-3 p-3.5 text-left rounded-xl border border-[#EDE2D8] bg-[#FAF6F2] hover:bg-[#F4E7DE] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[#9E7358] text-white flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3B281E]">Agregar al inventario</p>
              <p className="text-xs text-[#7D6659] mt-0.5">Materiales disponibles o herramientas</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFirstRegisterOpen(false);
              setAutoOpenCreateFor('clientes');
              setActiveModule('clientes');
            }}
            className="flex items-start gap-3 p-3.5 text-left rounded-xl border border-[#EDE2D8] bg-[#FAF6F2] hover:bg-[#F4E7DE] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[#9E7358] text-white flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3B281E]">Registrar cliente</p>
              <p className="text-xs text-[#7D6659] mt-0.5">Guarda tu primer contacto o comprador</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFirstRegisterOpen(false);
              setActiveModule('calculadora');
            }}
            className="sm:col-span-2 flex items-start gap-3 p-3.5 text-left rounded-xl border border-[#EDE2D8] bg-white hover:bg-[#FAF6F2] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[#F4E7DE] text-[#9E7358] flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3B281E]">Calcular costo y precio de venta</p>
              <p className="text-xs text-[#7D6659] mt-0.5">Estima cuánto cobrar por un producto tejido antes de venderlo</p>
            </div>
          </button>
        </div>
      </Modal>
    </div>
  );
};
