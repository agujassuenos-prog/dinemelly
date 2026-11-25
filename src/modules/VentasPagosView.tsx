import React, { useMemo, useState } from 'react';
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import { Order, PAYMENT_METHODS, Payment, PaymentMethod } from '../types';
import { formatCOP, formatDate, getTodayISO } from '../utils/format';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PaymentStatusLabel } from '../components/ui/StatusText';
import { NumberInput } from '../components/ui/NumberInput';

export const VentasPagosView: React.FC = () => {
  const {
    data,
    addPayment,
    updatePayment,
    deletePayment,
    getOrderTotal,
    getOrderPaid,
    getOrderPending,
    getOrderPaymentStatus,
  } = useDinemelly();

  const [tab, setTab] = useState<'saldos' | 'historial'>('saldos');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'Pendiente' | 'Parcialmente pagado' | 'Pagado'>('todos');
  const [methodFilter, setMethodFilter] = useState<string>('todos');

  // Modales
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [orderPaymentsModal, setOrderPaymentsModal] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  // Formulario pago
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Transferencia');
  const [payObs, setPayObs] = useState('');
  const [formError, setFormError] = useState('');

  const activeOrders = useMemo(
    () =>
      data.orders
        .filter((o) => o.status !== 'cancelado')
        .sort((a, b) => b.requestDate.localeCompare(a.requestDate)),
    [data.orders]
  );

  const clientNameById = (id: string) =>
    data.clients.find((c) => c.id === id)?.name || 'Cliente';

  const summary = useMemo(() => {
    const totalSales = activeOrders.reduce((s, o) => s + getOrderTotal(o), 0);
    const totalCollected = data.payments.reduce((s, p) => s + p.amount, 0);
    const totalPending = activeOrders.reduce((s, o) => s + getOrderPending(o), 0);
    return { totalSales, totalCollected, totalPending };
  }, [activeOrders, data.payments, getOrderTotal, getOrderPending]);

  const openNewPayment = (preselectOrderId?: string) => {
    setEditingPayment(null);
    setFormError('');
    const targetId =
      preselectOrderId ||
      activeOrders.find((o) => getOrderPending(o) > 0)?.id ||
      '';
    setSelectedOrderId(targetId);
    setPayDate(getTodayISO());
    const ord = activeOrders.find((o) => o.id === targetId);
    setPayAmount(ord ? String(getOrderPending(ord)) : '');
    setPayMethod('Transferencia');
    setPayObs('');
    setPaymentModalOpen(true);
  };

  const openEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setFormError('');
    setSelectedOrderId(payment.orderId);
    setPayDate(payment.date);
    setPayAmount(String(payment.amount));
    setPayMethod(payment.method);
    setPayObs(payment.observations);
    setPaymentModalOpen(true);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amountNum = parseFloat(payAmount);
    if (editingPayment) {
      const res = updatePayment(editingPayment.id, {
        date: payDate,
        amount: amountNum,
        method: payMethod,
        observations: payObs,
      });
      if (!res.ok) {
        setFormError(res.error || 'Error al actualizar pago.');
        return;
      }
    } else {
      const res = addPayment({
        orderId: selectedOrderId,
        date: payDate,
        amount: amountNum,
        method: payMethod,
        observations: payObs,
      });
      if (!res.ok) {
        setFormError(res.error || 'Error al registrar pago.');
        return;
      }
    }
    setPaymentModalOpen(false);
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeOrders.filter((ord) => {
      const pStatus = getOrderPaymentStatus(ord);
      if (statusFilter !== 'todos' && pStatus !== statusFilter) return false;
      if (!q) return true;
      const cName = clientNameById(ord.clientId).toLowerCase();
      return (
        ord.orderNumber.toLowerCase().includes(q) ||
        cName.includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders, search, statusFilter, getOrderPaymentStatus, data.clients]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.payments
      .filter((p) => {
        if (methodFilter !== 'todos' && p.method !== methodFilter) return false;
        if (!q) return true;
        return (
          p.orderNumber.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          p.observations.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.payments, methodFilter, search]);

  const selectedOrderForForm = activeOrders.find((o) => o.id === selectedOrderId);

  return (
    <div className="space-y-6">
      {/* Indicadores financieros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E7E3DC] rounded-xl p-5">
          <span className="text-xs text-[#6E675F]">Total ventas activas</span>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#1F1C19]">
            {formatCOP(summary.totalSales)}
          </p>
        </div>
        <div className="bg-white border border-[#E7E3DC] rounded-xl p-5">
          <span className="text-xs text-[#6E675F]">Total dinero recibido</span>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#15803D]">
            {formatCOP(summary.totalCollected)}
          </p>
        </div>
        <div className="bg-white border border-[#E7E3DC] rounded-xl p-5">
          <span className="text-xs text-[#6E675F]">Saldo total pendiente por cobrar</span>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#B45309]">
            {formatCOP(summary.totalPending)}
          </p>
        </div>
      </div>

      {/* Pestañas y filtros */}
      <div className="bg-white border border-[#E7E3DC] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-[#F3F0EB] rounded-lg">
            <button
              type="button"
              onClick={() => setTab('saldos')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'saldos'
                  ? 'bg-white text-[#1F1C19] shadow-sm'
                  : 'text-[#6E675F] hover:text-[#1F1C19]'
              }`}
            >
              Saldos por pedido ({activeOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('historial')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'historial'
                  ? 'bg-white text-[#1F1C19] shadow-sm'
                  : 'text-[#6E675F] hover:text-[#1F1C19]'
              }`}
            >
              Historial de pagos ({data.payments.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => openNewPayment()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar pago / abono</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E7E3DC]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por pedido o cliente..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            />
          </div>

          {tab === 'saldos' ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Filtrar estado de pago"
              className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg"
            >
              <option value="todos">Todos los estados de pago</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Parcialmente pagado">Parcialmente pagado</option>
              <option value="Pagado">Pagado</option>
            </select>
          ) : (
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              aria-label="Filtrar método de pago"
              className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg"
            >
              <option value="todos">Todos los tipos de pago</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabla de saldos por pedido */}
      {tab === 'saldos' && (
        <>
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No hay pedidos en esta vista"
              description="Los pedidos activos aparecerán aquí con su total, abonos recibidos y saldo pendiente."
            />
          ) : (
            <div className="bg-white border border-[#E7E3DC] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8F6F2] border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                      <th className="py-3 px-4">Pedido</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4 text-right">Total pedido</th>
                      <th className="py-3 px-4 text-right">Total abonado</th>
                      <th className="py-3 px-4 text-right">Saldo pendiente</th>
                      <th className="py-3 px-4">Estado del pago</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E3DC] text-sm">
                    {filteredOrders.map((ord) => {
                      const total = getOrderTotal(ord);
                      const paid = getOrderPaid(ord.id);
                      const pending = getOrderPending(ord);
                      const payStatus = getOrderPaymentStatus(ord);
                      return (
                        <tr key={ord.id} className="hover:bg-[#FAF9F7]">
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1F1C19] whitespace-nowrap">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3 px-4 font-medium text-[#1F1C19]">
                            {clientNameById(ord.clientId)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#1F1C19] whitespace-nowrap">
                            {formatCOP(total)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#15803D] whitespace-nowrap">
                            {formatCOP(paid)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                              pending > 0 ? 'text-[#B45309]' : 'text-[#15803D]'
                            }`}
                          >
                            {formatCOP(pending)}
                          </td>
                          <td className="py-3 px-4">
                            <PaymentStatusLabel status={payStatus} />
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOrderPaymentsModal(ord)}
                                className="px-2.5 py-1 text-xs font-medium text-[#1F1C19] bg-[#FAF9F7] border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-md"
                              >
                                Ver abonos
                              </button>
                              {pending > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openNewPayment(ord.id)}
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-md"
                                >
                                  Abonar
                                </button>
                              )}
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

      {/* Tabla historial de pagos */}
      {tab === 'historial' && (
        <>
          {filteredPayments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sin pagos registrados"
              description="Registra el primer abono o pago completo de un pedido."
              actionLabel="Registrar pago"
              onAction={() => openNewPayment()}
            />
          ) : (
            <div className="bg-white border border-[#E7E3DC] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8F6F2] border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Pedido</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Tipo de pago</th>
                      <th className="py-3 px-4 text-right">Valor recibido</th>
                      <th className="py-3 px-4">Observaciones</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E3DC] text-sm">
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-[#FAF9F7]">
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#6E675F] whitespace-nowrap">
                          {formatDate(p.date)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-[#7C3A52] whitespace-nowrap">
                          {p.orderNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#1F1C19]">
                          {p.clientName}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#5A5550] whitespace-nowrap">
                          {p.method}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums text-[#15803D] whitespace-nowrap">
                          {formatCOP(p.amount)}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#5A5550]">
                          {p.observations || '—'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditPayment(p)}
                              title="Editar pago"
                              className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#7C3A52] hover:bg-[#F3F0EB]"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              title="Eliminar pago"
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
        </>
      )}

      {/* Modal registrar / editar pago */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={editingPayment ? 'Editar pago registrado' : 'Registrar pago o abono'}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmitPayment} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Pedido asociado *
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedOrderId(nextId);
                const ord = activeOrders.find((o) => o.id === nextId);
                if (ord) setPayAmount(String(getOrderPending(ord)));
              }}
              disabled={Boolean(editingPayment)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg disabled:bg-[#F3F0EB]"
            >
              <option value="">-- Selecciona un pedido --</option>
              {activeOrders.map((o) => {
                const pending = getOrderPending(o);
                return (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} · {clientNameById(o.clientId)} (Saldo: {formatCOP(pending)})
                  </option>
                );
              })}
            </select>
          </div>

          {selectedOrderForForm && (
            <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E7E3DC] grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[#6E675F] block">Total pedido</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatCOP(getOrderTotal(selectedOrderForForm))}
                </span>
              </div>
              <div>
                <span className="text-[#6E675F] block">Abonado</span>
                <span className="font-mono font-semibold tabular-nums text-[#15803D]">
                  {formatCOP(getOrderPaid(selectedOrderForForm.id))}
                </span>
              </div>
              <div>
                <span className="text-[#6E675F] block">Saldo pendiente</span>
                <span className="font-mono font-semibold tabular-nums text-[#B45309]">
                  {formatCOP(getOrderPending(selectedOrderForForm))}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Valor recibido (COP) *
              </label>
              <NumberInput
                allowDecimal={false}
                value={payAmount}
                onChangeText={setPayAmount}
                placeholder="Ej. 35000"
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
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Tipo de pago *
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Observaciones
            </label>
            <textarea
              rows={2}
              value={payObs}
              onChange={(e) => setPayObs(e.target.value)}
              placeholder="Ej. Transferencia Nequi / Daviplata, abono inicial, pago contra entrega..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E7E3DC]">
            <button
              type="button"
              onClick={() => setPaymentModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#1F1C19] bg-white border border-[#D9D3CA] rounded-lg hover:bg-[#F3F0EB]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg"
            >
              {editingPayment ? 'Guardar cambios' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal pagos de un pedido */}
      <Modal
        isOpen={orderPaymentsModal !== null}
        onClose={() => setOrderPaymentsModal(null)}
        title={
          orderPaymentsModal
            ? `Pagos asociados a ${orderPaymentsModal.orderNumber}`
            : ''
        }
        subtitle={
          orderPaymentsModal ? clientNameById(orderPaymentsModal.clientId) : ''
        }
        maxWidthClass="max-w-lg"
      >
        {orderPaymentsModal && (() => {
          const ordPayments = data.payments.filter(
            (p) => p.orderId === orderPaymentsModal.id
          );
          const pending = getOrderPending(orderPaymentsModal);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC] text-xs">
                <div>
                  <span className="text-[#6E675F] block">Total</span>
                  <span className="font-mono font-bold tabular-nums text-[#1F1C19]">
                    {formatCOP(getOrderTotal(orderPaymentsModal))}
                  </span>
                </div>
                <div>
                  <span className="text-[#6E675F] block">Abonado</span>
                  <span className="font-mono font-bold tabular-nums text-[#15803D]">
                    {formatCOP(getOrderPaid(orderPaymentsModal.id))}
                  </span>
                </div>
                <div>
                  <span className="text-[#6E675F] block">Pendiente</span>
                  <span className="font-mono font-bold tabular-nums text-[#B45309]">
                    {formatCOP(pending)}
                  </span>
                </div>
              </div>

              {ordPayments.length === 0 ? (
                <p className="text-sm text-[#6E675F] py-6 text-center">
                  Este pedido aún no tiene abonos registrados.
                </p>
              ) : (
                <div className="divide-y divide-[#E7E3DC] border border-[#E7E3DC] rounded-xl">
                  {ordPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#1F1C19]">
                          {p.method} · {formatDate(p.date)}
                        </p>
                        {p.observations && (
                          <p className="text-[#6E675F] mt-0.5">{p.observations}</p>
                        )}
                      </div>
                      <span className="font-mono font-bold tabular-nums text-[#15803D]">
                        {formatCOP(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {pending > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const id = orderPaymentsModal.id;
                      setOrderPaymentsModal(null);
                      openNewPayment(id);
                    }}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg"
                  >
                    Registrar nuevo abono
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePayment(deleteTarget.id);
        }}
        title="¿Eliminar pago?"
        message={
          deleteTarget
            ? `Se eliminará el pago de ${formatCOP(deleteTarget.amount)} asociado al pedido ${deleteTarget.orderNumber}. El saldo pendiente volverá a aumentar.`
            : ''
        }
        confirmLabel="Eliminar pago"
      />
    </div>
  );
};
