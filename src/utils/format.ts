export function formatCOP(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const absFormatted = Math.abs(safe).toLocaleString('es-CO');
  return safe < 0 ? `-$${absFormatted} COP` : `$${absFormatted} COP`;
}

export function formatCOPShort(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return `$${safe.toLocaleString('es-CO')}`;
}

export function formatNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthPrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getMonthLabel(monthPrefix: string): string {
  const [y, m] = monthPrefix.split('-');
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return monthPrefix;
  return `${months[idx]} de ${y}`;
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeProductKey(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
