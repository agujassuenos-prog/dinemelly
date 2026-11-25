import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hammer,
  PackageCheck,
  XCircle,
} from 'lucide-react';
import { OrderItemStatus, OrderStatus, PaymentStatus } from '../../types';

export const OrderStatusLabel: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const map: Record<
    OrderStatus,
    { label: string; colorClass: string; Icon: React.ElementType }
  > = {
    pendiente: {
      label: 'Pendiente',
      colorClass: 'text-[#B45309]',
      Icon: Clock,
    },
    en_proceso: {
      label: 'En proceso',
      colorClass: 'text-[#7C3A52]',
      Icon: Hammer,
    },
    terminado: {
      label: 'Terminado',
      colorClass: 'text-[#0F766E]',
      Icon: PackageCheck,
    },
    entregado: {
      label: 'Entregado',
      colorClass: 'text-[#15803D]',
      Icon: CheckCircle2,
    },
    cancelado: {
      label: 'Cancelado',
      colorClass: 'text-[#B91C1C]',
      Icon: XCircle,
    },
  };

  const cfg = map[status];
  const Icon = cfg.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${cfg.colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{cfg.label}</span>
    </span>
  );
};

export const OrderItemStatusLabel: React.FC<{ status: OrderItemStatus }> = ({ status }) => {
  if (status === 'terminado') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Terminado</span>
      </span>
    );
  }
  if (status === 'en_proceso') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7C3A52] whitespace-nowrap">
        <Hammer className="w-3.5 h-3.5 shrink-0" />
        <span>En proceso</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>Pendiente</span>
    </span>
  );
};

export const PaymentStatusLabel: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  if (status === 'Pagado') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Pagado</span>
      </span>
    );
  }
  if (status === 'Parcialmente pagado') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309] whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>Parcialmente pagado</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B91C1C] whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>Pendiente</span>
    </span>
  );
};
