import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import {
  formatCOP,
  formatNumber,
  getCurrentMonthPrefix,
  normalizeProductKey,
} from '../utils/format';

export const EstadisticasView: React.FC = () => {
  const {
    data,
    setActiveModule,
    setPreselectedPurchaseMaterialId,
    getOrderTotal,
    getOrderCost,
    getOrderProfit,
  } = useDinemelly();

  const [period, setPeriod] = useState<'mes_actual' | 'todo'>('todo');
  const currentMonth = getCurrentMonthPrefix();

  const stats = useMemo(() => {
    const activeOrders = data.orders.filter((o) => {
      if (o.status === 'cancelado') return false;
      if (period === 'mes_actual') return o.requestDate.startsWith(currentMonth);
      return true;
    });

    const totalSales = activeOrders.reduce((s, o) => s + getOrderTotal(o), 0);
    const totalProductionCost = activeOrders.reduce((s, o) => s + getOrderCost(o), 0);
    const totalEstimatedProfit = activeOrders.reduce((s, o) => s + getOrderProfit(o), 0);

    const periodPayments = data.payments
      .filter((p) => (period === 'mes_actual' ? p.date.startsWith(currentMonth) : true))
      .reduce((s, p) => s + p.amount, 0);

    // Productos más vendidos (mismo nombre agrupado en un solo ítem sin importar pedido o cliente)
    const productMap = new Map<
      string,
      { key: string; name: string; units: number; revenue: number; ordersCount: number }
    >();
    for (const ord of activeOrders) {
      for (const item of ord.items) {
        const key = normalizeProductKey(item.productName);
        if (!key) continue;
        const cleanName = item.productName.trim().replace(/\s+/g, ' ');
        const curr = productMap.get(key) || {
          key,
          name: cleanName,
          units: 0,
          revenue: 0,
          ordersCount: 0,
        };
        curr.units += item.quantity;
        curr.revenue += item.quantity * item.unitSalePrice;
        curr.ordersCount += 1;
        productMap.set(key, curr);
      }
    }
    const topProducts = Array.from(productMap.values()).sort(
      (a, b) => b.units - a.units || b.revenue - a.revenue
    );

    // Clientes frecuentes (en el periodo o histórico)
    const frequentClients = data.clients
      .map((client) => {
        const cOrders = activeOrders.filter((o) => o.clientId === client.id);
        const totalBought = cOrders.reduce((s, o) => s + getOrderTotal(o), 0);
        const avgTicket = cOrders.length > 0 ? totalBought / cOrders.length : 0;
        return {
          client,
          ordersCount: cOrders.length,
          totalBought,
          avgTicket,
        };
      })
      .filter((c) => c.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount || b.totalBought - a.totalBought);

    // Materiales con existencias bajas
    const lowStock = data.inventory
      .filter(
        (i) => i.status === 'activo' && i.itemType === 'consumible' && i.quantity < i.minStock
      )
      .sort((a, b) => a.quantity / Math.max(1, a.minStock) - b.quantity / Math.max(1, b.minStock));

    return {
      activeOrdersCount: activeOrders.length,
      totalSales,
      totalProductionCost,
      totalEstimatedProfit,
      periodPayments,
      topProducts,
      frequentClients,
      lowStock,
    };
  }, [
    data.orders,
    data.payments,
    data.clients,
    data.inventory,
    period,
    currentMonth,
    getOrderTotal,
    getOrderCost,
    getOrderProfit,
  ]);

  const maxUnits = Math.max(1, ...stats.topProducts.map((p) => p.units));
  const maxFinBar = Math.max(
    1,
    stats.totalSales,
    stats.periodPayments,
    stats.totalProductionCost,
    stats.totalEstimatedProfit
  );

  return (
    <div className="space-y-6">
      {/* Selector de periodo */}
      <div className="bg-white border border-[#E7E3DC] rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-5 h-5 text-[#7C3A52]" />
          <div>
            <h2 className="text-base font-semibold text-[#1F1C19]">
              Reportes del emprendimiento
            </h2>
            <p className="text-xs text-[#6E675F]">
              Indicadores calculados automáticamente desde pedidos, entregas, pagos e inventario.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F3F0EB] rounded-lg">
          <button
            type="button"
            onClick={() => setPeriod('mes_actual')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              period === 'mes_actual'
                ? 'bg-white text-[#1F1C19] shadow-sm'
                : 'text-[#6E675F] hover:text-[#1F1C19]'
            }`}
          >
            Mes actual
          </button>
          <button
            type="button"
            onClick={() => setPeriod('todo')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              period === 'todo'
                ? 'bg-white text-[#1F1C19] shadow-sm'
                : 'text-[#6E675F] hover:text-[#1F1C19]'
            }`}
          >
            Todo el historial
          </button>
        </div>
      </div>

      {/* Balance financiero visual */}
      <section className="bg-white border border-[#E7E3DC] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7E3DC] pb-3">
          <div>
            <h3 className="text-base font-semibold text-[#1F1C19]">
              Desempeño financiero ({stats.activeOrdersCount} pedidos)
            </h3>
          </div>
          <TrendingUp className="w-4 h-4 text-[#7C3A52]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-3.5">
            {[
              { label: 'Ventas totales (pedidos)', value: stats.totalSales, color: 'bg-[#7C3A52]' },
              { label: 'Dinero efectivamente recibido', value: stats.periodPayments, color: 'bg-[#15803D]' },
              { label: 'Costo de producción acumulado', value: stats.totalProductionCost, color: 'bg-[#8C6D62]' },
              { label: 'Ganancia estimada neta', value: stats.totalEstimatedProfit, color: 'bg-[#0F766E]' },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[#4A453F]">{row.label}</span>
                  <span className="font-mono font-bold tabular-nums text-[#1F1C19]">
                    {formatCOP(row.value)}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#F3F0EB] rounded-sm overflow-hidden">
                  <div
                    className={`h-full ${row.color} rounded-sm`}
                    style={{
                      width: `${Math.max(4, Math.round((Math.max(0, row.value) / maxFinBar) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC]">
              <span className="text-xs text-[#6E675F]">Margen promedio real</span>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#1F1C19]">
                {stats.totalSales > 0
                  ? `${formatNumber((stats.totalEstimatedProfit / stats.totalSales) * 100, 1)}%`
                  : '0%'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC]">
              <span className="text-xs text-[#6E675F]">Porcentaje recaudado</span>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#15803D]">
                {stats.totalSales > 0
                  ? `${formatNumber(Math.min(100, (stats.periodPayments / stats.totalSales) * 100), 1)}%`
                  : '0%'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Productos más vendidos + Clientes frecuentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white border border-[#E7E3DC] rounded-xl p-6">
          <div className="pb-3 border-b border-[#E7E3DC]">
            <h3 className="text-base font-semibold text-[#1F1C19]">
              Productos más vendidos
            </h3>
            <p className="text-xs text-[#6E675F]">
              Cantidades registradas en los pedidos del periodo
            </p>
          </div>

          {stats.topProducts.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6E675F]">
              No hay pedidos registrados en este periodo.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {stats.topProducts.map((p, idx) => (
                <div key={p.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-semibold text-[#1F1C19] truncate">
                      {idx + 1}. {p.name}
                    </span>
                    <span className="font-mono tabular-nums text-[#5A5550] whitespace-nowrap">
                      {p.units} {p.units === 1 ? 'ud' : 'uds'} · {formatCOP(p.revenue)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-[#F3F0EB] rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#7C3A52] rounded-sm"
                      style={{
                        width: `${Math.max(8, Math.round((p.units / maxUnits) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-6 bg-white border border-[#E7E3DC] rounded-xl p-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7E3DC]">
            <div>
              <h3 className="text-base font-semibold text-[#1F1C19]">
                Clientes frecuentes
              </h3>
              <p className="text-xs text-[#6E675F]">
                Ranking por número de pedidos y monto histórico
              </p>
            </div>
            <Award className="w-4 h-4 text-[#7C3A52]" />
          </div>

          {stats.frequentClients.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6E675F]">
              No hay compras de clientes en este periodo.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E7E3DC] text-[11px] font-semibold text-[#6E675F]">
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3 text-right">Pedidos</th>
                    <th className="py-2 pr-3 text-right">Promedio</th>
                    <th className="py-2 text-right">Total comprado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E3DC] text-xs">
                  {stats.frequentClients.map((row) => (
                    <tr key={row.client.id}>
                      <td className="py-2.5 pr-3 font-medium text-[#1F1C19]">
                        {row.client.name}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-semibold">
                        {row.ordersCount}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#6E675F] whitespace-nowrap">
                        {formatCOP(row.avgTicket)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-bold text-[#1F1C19] whitespace-nowrap">
                        {formatCOP(row.totalBought)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Materiales con existencias bajas */}
      <section className="bg-white border border-[#E7E3DC] rounded-xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E3DC]">
          <div>
            <h3 className="text-base font-semibold text-[#1F1C19]">
              Materiales con existencias bajas
            </h3>
            <p className="text-xs text-[#6E675F]">
              Elementos consumibles por debajo de su mínimo
            </p>
          </div>
          <AlertTriangle className="w-4 h-4 text-[#B45309]" />
        </div>

        {stats.lowStock.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#15803D]">
            Todos los materiales están por encima del nivel mínimo.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-[#E7E3DC]">
            {stats.lowStock.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#1F1C19]">{item.name}</p>
                  <p className="text-[#6E675F] mt-0.5 tabular-nums">
                    Actual: <strong className="text-[#B91C1C]">{formatNumber(item.quantity)} {item.unit}</strong> · Mínimo: {formatNumber(item.minStock)} {item.unit}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreselectedPurchaseMaterialId(item.id);
                    setActiveModule('compras');
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#7C3A52] bg-[#FAF9F7] border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-lg whitespace-nowrap"
                >
                  Registrar compra
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
