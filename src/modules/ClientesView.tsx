import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import { Client, Order } from '../types';
import { formatCOP, formatDate } from '../utils/format';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PaymentStatusLabel } from '../components/ui/StatusText';

export const ClientesView: React.FC = () => {
  const {
    data,
    addClient,
    updateClient,
    deleteClient,
    getOrderTotal,
    getOrderPaid,
    getOrderPending,
    getOrderPaymentStatus,
    autoOpenCreateFor,
    setAutoOpenCreateFor,
    addToast,
  } = useDinemelly();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'total_desc' | 'orders_desc' | 'name_asc'>('orders_desc');
  const [onlyFrequent, setOnlyFrequent] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  // Campos formulario
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [observations, setObservations] = useState('');
  const [formError, setFormError] = useState('');

  const openNewModal = () => {
    setEditingClient(null);
    setFormError('');
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setObservations('');
    setFormOpen(true);
  };

  useEffect(() => {
    if (autoOpenCreateFor === 'clientes') {
      openNewModal();
      setAutoOpenCreateFor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreateFor]);

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormError('');
    setName(client.name);
    setPhone(client.phone);
    setEmail(client.email);
    setAddress(client.address);
    setObservations(client.observations);
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      observations: observations.trim(),
    };
    const res = editingClient
      ? updateClient(editingClient.id, payload)
      : addClient(payload);

    if (!res.ok) {
      setFormError(res.error || 'Error al guardar.');
      return;
    }
    setFormOpen(false);
  };

  const enrichedClients = useMemo(() => {
    return data.clients.map((client) => {
      const clientOrders = data.orders
        .filter((o) => o.clientId === client.id)
        .sort((a, b) => b.requestDate.localeCompare(a.requestDate));
      const activeOrders = clientOrders.filter((o) => o.status !== 'cancelado');
      const totalBought = activeOrders.reduce((s, o) => s + getOrderTotal(o), 0);
      const totalPaid = activeOrders.reduce((s, o) => s + getOrderPaid(o.id), 0);
      const totalPending = activeOrders.reduce((s, o) => s + getOrderPending(o), 0);
      const isFrequent = activeOrders.length >= 2;
      return {
        client,
        clientOrders,
        activeCount: activeOrders.length,
        totalBought,
        totalPaid,
        totalPending,
        isFrequent,
      };
    });
  }, [data.clients, data.orders, getOrderTotal, getOrderPaid, getOrderPending]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedClients
      .filter((entry) => {
        if (onlyFrequent && !entry.isFrequent) return false;
        if (!q) return true;
        return (
          entry.client.name.toLowerCase().includes(q) ||
          entry.client.observations.toLowerCase().includes(q) ||
          entry.client.phone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'total_desc') return b.totalBought - a.totalBought;
        if (sortBy === 'name_asc') return a.client.name.localeCompare(b.client.name);
        return b.activeCount - a.activeCount || b.totalBought - a.totalBought;
      });
  }, [enrichedClients, search, sortBy, onlyFrequent]);

  const selectedClientStats = useMemo(() => {
    if (!selectedClient) return null;
    return enrichedClients.find((e) => e.client.id === selectedClient.id) || null;
  }, [selectedClient, enrichedClients]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E7E3DC] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="block text-xs text-[#6E675F]">Total clientes</span>
              <span className="text-lg font-bold font-mono tabular-nums text-[#1F1C19]">
                {data.clients.length}
              </span>
            </div>
            <div className="h-8 w-px bg-[#E7E3DC]" />
            <div>
              <span className="block text-xs text-[#6E675F]">Clientes frecuentes (2+ pedidos)</span>
              <span className="text-lg font-bold font-mono tabular-nums text-[#7C3A52]">
                {enrichedClients.filter((e) => e.isFrequent).length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar cliente</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E7E3DC] items-center">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre u observación..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Ordenar clientes"
            className="w-full px-3 py-2 text-sm bg-[#FAF9F7] border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
          >
            <option value="orders_desc">Más pedidos realizados</option>
            <option value="total_desc">Mayor total histórico comprado</option>
            <option value="name_asc">Orden alfabético (A–Z)</option>
          </select>

          <label className="flex items-center gap-2 text-xs font-medium text-[#1F1C19] cursor-pointer px-2">
            <input
              type="checkbox"
              checked={onlyFrequent}
              onChange={(e) => setOnlyFrequent(e.target.checked)}
              className="rounded border-[#D9D3CA] text-[#7C3A52]"
            />
            <span>Mostrar solo clientes frecuentes</span>
          </label>
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes para mostrar"
          description="Registra tus clientes solo con su nombre y observaciones (teléfono, dirección y correo son opcionales)."
          actionLabel="Registrar cliente"
          onAction={openNewModal}
        />
      ) : (
        <div className="bg-white border border-[#E7E3DC] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4 text-right">Pedidos</th>
                  <th className="py-3 px-4 text-right">Total comprado</th>
                  <th className="py-3 px-4 text-right">Saldo pendiente</th>
                  <th className="py-3 px-4">Observaciones</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E3DC] text-sm">
                {filteredClients.map((entry) => (
                  <tr key={entry.client.id} className="hover:bg-[#FAF9F7]">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedClient(entry.client)}
                          className="font-semibold text-[#1F1C19] hover:text-[#7C3A52] text-left"
                        >
                          {entry.client.name}
                        </button>
                        {entry.isFrequent && (
                          <span
                            title="Cliente frecuente"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3A52]"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Frecuente</span>
                          </span>
                        )}
                      </div>
                      {entry.client.phone && (
                        <p className="text-xs text-[#6E675F] font-mono">{entry.client.phone}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums text-[#1F1C19]">
                      {entry.activeCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums text-[#1F1C19] whitespace-nowrap">
                      {formatCOP(entry.totalBought)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                        entry.totalPending > 0 ? 'text-[#B45309]' : 'text-[#15803D]'
                      }`}
                    >
                      {formatCOP(entry.totalPending)}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#5A5550] max-w-[260px] truncate">
                      {entry.client.observations || '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedClient(entry.client)}
                          title="Ver historial de compras"
                          className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#1F1C19] hover:bg-[#F3F0EB]"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(entry.client)}
                          title="Editar cliente"
                          className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#7C3A52] hover:bg-[#F3F0EB]"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(entry.client)}
                          title="Eliminar cliente"
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

      {/* Modal agregar / editar cliente */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingClient ? 'Editar cliente' : 'Registrar cliente'}
        subtitle="Solo el nombre es obligatorio; los datos de contacto son opcionales."
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Nombre del cliente *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ej. Laura Vanessa Ríos"
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Teléfono (opcional)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Correo electrónico (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Dirección de entrega (opcional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
              Observaciones
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Preferencias de colores, estilo de empaque o notas..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
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
              Guardar cliente
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal vista detallada de cliente e historial de compras */}
      <Modal
        isOpen={selectedClient !== null}
        onClose={() => setSelectedClient(null)}
        title={selectedClient ? selectedClient.name : ''}
        subtitle="Historial de compras y pedidos asociados"
        maxWidthClass="max-w-3xl"
      >
        {selectedClientStats && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC]">
                <span className="text-xs text-[#6E675F]">Pedidos realizados</span>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-[#1F1C19]">
                  {selectedClientStats.activeCount}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC]">
                <span className="text-xs text-[#6E675F]">Total histórico de compras</span>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-[#1F1C19]">
                  {formatCOP(selectedClientStats.totalBought)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC]">
                <span className="text-xs text-[#6E675F]">Saldo pendiente</span>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-[#B45309]">
                  {formatCOP(selectedClientStats.totalPending)}
                </p>
              </div>
            </div>

            {selectedClientStats.client.observations && (
              <p className="text-xs text-[#4A453F] bg-[#FAF9F7] p-3 rounded-lg border border-[#E7E3DC]">
                <strong>Observaciones:</strong> {selectedClientStats.client.observations}
              </p>
            )}

            <div>
              <h4 className="text-sm font-semibold text-[#1F1C19] mb-2">
                Historial de pedidos
              </h4>
              {selectedClientStats.clientOrders.length === 0 ? (
                <p className="text-sm text-[#6E675F] py-6 text-center border border-[#E7E3DC] rounded-lg">
                  Este cliente aún no tiene pedidos registrados.
                </p>
              ) : (
                <div className="border border-[#E7E3DC] rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8F6F2] border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                        <th className="py-2.5 px-3">Pedido</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Productos y cantidades</th>
                        <th className="py-2.5 px-3">Pago</th>
                        <th className="py-2.5 px-3 text-right">Valor cobrado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E3DC] text-xs">
                      {selectedClientStats.clientOrders.map((ord) => (
                        <tr
                          key={ord.id}
                          onClick={() => setSelectedOrderDetail(ord)}
                          className="hover:bg-[#FAF9F7] cursor-pointer"
                        >
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#7C3A52] underline-offset-2 hover:underline whitespace-nowrap">
                            {ord.orderNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-[#6E675F] whitespace-nowrap">
                            {formatDate(ord.requestDate)}
                          </td>
                          <td className="py-2.5 px-3 text-[#1F1C19]">
                            {ord.items.map((it) => `${it.quantity}× ${it.productName}`).join(', ')}
                          </td>
                          <td className="py-2.5 px-3">
                            <PaymentStatusLabel status={getOrderPaymentStatus(ord)} />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-[#1F1C19] whitespace-nowrap">
                            {formatCOP(getOrderTotal(ord))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-[#6E675F] mt-2">
                Haz clic sobre cualquier pedido del historial para consultar su detalle completo.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal detalle rápido de pedido desde historial del cliente */}
      <Modal
        isOpen={selectedOrderDetail !== null}
        onClose={() => setSelectedOrderDetail(null)}
        title={selectedOrderDetail ? `Detalle de pedido ${selectedOrderDetail.orderNumber}` : ''}
        maxWidthClass="max-w-xl"
      >
        {selectedOrderDetail && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E7E3DC]">
              <div className="space-y-0.5">
                <span className="text-xs text-[#6E675F]">
                  Solicitud: {formatDate(selectedOrderDetail.requestDate)} · Entrega:{' '}
                  {formatDate(selectedOrderDetail.deliveryDate)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <PaymentStatusLabel status={getOrderPaymentStatus(selectedOrderDetail)} />
              </div>
            </div>

            <div className="space-y-2">
              {selectedOrderDetail.items.map((it) => (
                <div
                  key={it.id}
                  className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E7E3DC] flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-[#1F1C19]">
                      {it.quantity} × {it.productName}
                    </p>
                    {it.description && (
                      <p className="text-xs text-[#6E675F] mt-0.5">{it.description}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#1F1C19] whitespace-nowrap">
                    {formatCOP(it.quantity * it.unitSalePrice)}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF9F7] border border-[#E7E3DC] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6E675F]">Descuento</span>
                <span className="font-mono tabular-nums">{formatCOP(selectedOrderDetail.discount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-sm text-[#1F1C19]">
                <span>Total pedido</span>
                <span className="font-mono tabular-nums">{formatCOP(getOrderTotal(selectedOrderDetail))}</span>
              </div>
              <div className="flex justify-between text-[#15803D]">
                <span>Total abonado</span>
                <span className="font-mono tabular-nums">{formatCOP(getOrderPaid(selectedOrderDetail.id))}</span>
              </div>
              <div className="flex justify-between text-[#B45309] font-semibold">
                <span>Saldo pendiente</span>
                <span className="font-mono tabular-nums">{formatCOP(getOrderPending(selectedOrderDetail))}</span>
              </div>
            </div>

            {selectedOrderDetail.observations && (
              <p className="text-xs text-[#4A453F]">
                <strong>Observaciones:</strong> {selectedOrderDetail.observations}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            const res = deleteClient(deleteTarget.id);
            if (!res.ok && res.error) {
              addToast('error', 'No se pudo eliminar', res.error);
            }
          }
        }}
        title="¿Eliminar cliente?"
        message={
          deleteTarget
            ? `Se eliminará a "${deleteTarget.name}" del directorio de clientes.`
            : ''
        }
        confirmLabel="Eliminar"
      />
    </div>
  );
};
