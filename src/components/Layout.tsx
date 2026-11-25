import React, { useState } from 'react';
import {
  BarChart3,
  Calculator,
  ClipboardList,
  Database,
  Download,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import { ActiveModule } from '../types';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  id: ActiveModule;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutGrid },
  { id: 'compras', label: 'Compras', icon: ShoppingCart },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'calculadora', label: 'Calculadora de Costos', icon: Calculator },
  { id: 'pedidos', label: 'Pedidos', icon: ClipboardList },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'ventas', label: 'Ventas', icon: Wallet },
  { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
];

const MODULE_TITLES: Record<ActiveModule, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Inicio',
    subtitle: 'Estado financiero, pedidos activos y alertas del taller',
  },
  compras: {
    title: 'Compras de insumos',
    subtitle: 'Registro de materiales, herramientas y valoración al costo más alto',
  },
  inventario: {
    title: 'Inventario del taller',
    subtitle: 'Materiales consumibles, herramientas reutilizables y movimientos',
  },
  calculadora: {
    title: 'Calculadora de Costos',
    subtitle: 'Cálculo flexible de producción y precio sugerido por margen sobre venta',
  },
  pedidos: {
    title: 'Gestión de pedidos',
    subtitle: 'Pedidos multiproducto, personalización y descuento al terminar',
  },
  clientes: {
    title: 'Directorio de clientes',
    subtitle: 'Historial de compras, totales acumulados y clientes frecuentes',
  },
  ventas: {
    title: 'Ventas',
    subtitle: 'Control de abonos, saldos pendientes y recaudos en COP',
  },
  estadisticas: {
    title: 'Estadísticas y reportes',
    subtitle: 'Productos más vendidos, clientes frecuentes y rotación de materiales',
  },
};

const DinemellyBarsMark: React.FC = () => (
  <svg
    viewBox="0 0 36 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-8 h-7 mx-auto"
    aria-hidden="true"
  >
    <rect x="2" y="13" width="7.5" height="13" rx="2.2" fill="#9E7358" />
    <rect x="13.5" y="7" width="7.5" height="19" rx="2.2" fill="#9E7358" />
    <rect x="25" y="2" width="7.5" height="24" rx="2.2" fill="#9E7358" />
  </svg>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    signOutUser,
    data,
    activeModule,
    setActiveModule,
    resetToSeedData,
    clearAllData,
    importJsonData,
    addToast,
  } = useDinemelly();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);
  const [importError, setImportError] = useState('');

  const currentHeader = MODULE_TITLES[activeModule];

  const handleSelectModule = (mod: ActiveModule) => {
    setActiveModule(mod);
    setMobileMenuOpen(false);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dinemelly-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Respaldo descargado', 'Se exportaron todos los datos en formato JSON.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const res = importJsonData(content);
      if (!res.ok) {
        setImportError(res.error || 'Archivo inválido.');
      } else {
        setBackupModalOpen(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const SidebarContent = (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Onda orgánica sutil en la base de la barra lateral */}
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#EAD5C6]/65"
        aria-hidden="true"
      />

      {/* Cabecera centrada estilo mockup */}
      <div className="px-5 pt-7 pb-5 text-center relative">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg text-[#7A6457] hover:text-[#3B281E] hover:bg-[#EAD5C6]/60"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>

        <DinemellyBarsMark />
        <span className="block mt-2 font-display text-[26px] leading-tight font-semibold tracking-tight text-[#3B281E]">
          Dinemelly
        </span>
        <span className="block mt-0.5 text-xs text-[#7D6659]">
          Tu negocio, en orden
        </span>
      </div>

      {/* Menú principal */}
      <nav
        className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto relative z-10"
        aria-label="Navegación principal"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectModule(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13.5px] font-medium transition-all text-left ${
                isActive
                  ? 'bg-[#AF8064] text-white shadow-[0_6px_14px_rgba(175,128,100,0.28)]'
                  : 'text-[#4D3A2F] hover:bg-[#EBD9CC]/70 hover:text-[#3B281E]'
              }`}
            >
              <Icon
                className={`w-[17px] h-[17px] shrink-0 ${
                  isActive ? 'text-white' : 'text-[#846858]'
                }`}
              />
              <span className="leading-snug">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tarjeta inferior del sidebar */}
      <div className="p-4 relative z-10 space-y-2">
        <div className="rounded-2xl bg-[#E8D6C9]/85 border border-[#DFC9BA] px-4 py-4 text-center">
          <TrendingUp className="w-4 h-4 mx-auto text-[#7C5944] mb-1.5" />
          <p className="text-[11.5px] leading-snug text-[#4D3A2F] font-medium">
            Gestiona tu negocio de forma simple y eficiente
          </p>
          <button
            type="button"
            onClick={() => setBackupModalOpen(true)}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#7C5944] hover:text-[#3B281E] transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Respaldo y datos</span>
          </button>
        </div>

        <div className="rounded-2xl bg-white/80 border border-[#DFC9BA] px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#3B281E] truncate">
              {user?.displayName || user?.email || 'Mi cuenta'}
            </p>
            {user?.email && user?.displayName && (
              <p className="text-[10px] text-[#7D6659] truncate">{user.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void signOutUser()}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="p-1.5 rounded-lg text-[#7C5944] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FAF6F2] text-[#3B281E] relative overflow-x-hidden">
      {/* Ondas orgánicas decorativas sutiles en el fondo del lienzo */}
      <div
        className="pointer-events-none fixed -bottom-32 right-[-8%] w-[520px] h-[360px] rounded-[50%] bg-[#F0DFD3]/65 blur-[1px] z-0"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed top-[32%] right-[-10%] w-[380px] h-[280px] rounded-[50%] bg-[#F3E6DC]/55 z-0"
        aria-hidden="true"
      />

      {/* Sidebar escritorio */}
      <aside className="hidden lg:block w-[240px] shrink-0 bg-[#F4E7DE] border-r border-[#E9D8CC] sticky top-0 h-screen z-20">
        {SidebarContent}
      </aside>

      {/* Drawer móvil */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#3B281E]/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[250px] max-w-[85vw] bg-[#F4E7DE] border-r border-[#E9D8CC] h-full z-10">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        {activeModule === 'dashboard' ? (
          <div className="lg:hidden sticky top-0 z-30 bg-[#FAF6F2]/95 backdrop-blur-sm border-b border-[#E9D8CC] px-4 h-14 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-lg text-[#4D3A2F] hover:bg-[#F4E7DE]"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-[#3B281E]">Dinemelly</span>
            <ThemeToggle compact />
          </div>
        ) : (
          <header className="sticky top-0 z-30 bg-[#FAF6F2]/95 backdrop-blur-sm border-b border-[#E9D8CC] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-lg text-[#4D3A2F] hover:bg-[#F4E7DE]"
                aria-label="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-[#3B281E] font-display truncate">
                  {currentHeader.title}
                </h1>
                <p className="hidden sm:block text-xs text-[#7D6659] truncate">
                  {currentHeader.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="hidden md:inline-block text-xs text-[#7D6659] font-mono whitespace-nowrap">
                Moneda: COP
              </span>
              <ThemeToggle compact />
              {activeModule !== 'pedidos' && (
                <button
                  type="button"
                  onClick={() => handleSelectModule('pedidos')}
                  className="px-3.5 py-2 text-xs sm:text-sm font-medium text-white bg-[#AF8064] hover:bg-[#976B51] rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Ir a pedidos
                </button>
              )}
            </div>
          </header>
        )}

        <main className="flex-1 px-4 sm:px-7 py-5 sm:py-6 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Modal de respaldo */}
      <Modal
        isOpen={backupModalOpen}
        onClose={() => {
          setBackupModalOpen(false);
          setImportError('');
        }}
        title="Respaldo y gestión de datos"
        subtitle="Todos los cambios se guardan automáticamente en tu cuenta en la nube."
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          {importError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
              {importError}
            </div>
          )}

          <div className="p-4 rounded-xl border border-[#E7E3DC] bg-[#FAF6F2] space-y-3">
            <h4 className="text-sm font-semibold text-[#3B281E]">Copia de seguridad</h4>
            <p className="text-xs text-[#7D6659] leading-relaxed">
              Descarga un archivo JSON con todas tus compras, inventario, cálculos, pedidos, clientes y pagos, o restaura una copia previa.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#AF8064] hover:bg-[#976B51] rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Exportar respaldo JSON</span>
              </button>
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#3B281E] bg-white border border-[#D9D3CA] hover:bg-[#F4E7DE] rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                <Upload className="w-4 h-4" />
                <span>Importar respaldo</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[#E7E3DC] bg-white space-y-3">
            <h4 className="text-sm font-semibold text-[#3B281E]">Opciones de reinicio</h4>
            <p className="text-xs text-[#7D6659] leading-relaxed">
              Puedes volver a cargar los datos iniciales de demostración o vaciar todos los módulos para comenzar con tu emprendimiento desde cero.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmAction('reset')}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#3B281E] bg-[#F4E7DE] hover:bg-[#EAD5C6] rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurar datos de ejemplo</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('clear')}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-lg transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                <span>Vaciar todos los datos</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === 'reset') {
            resetToSeedData();
          } else if (confirmAction === 'clear') {
            clearAllData();
          }
          setBackupModalOpen(false);
        }}
        title={
          confirmAction === 'reset'
            ? '¿Restaurar datos de ejemplo?'
            : '¿Vaciar todos los registros?'
        }
        message={
          confirmAction === 'reset'
            ? 'Esta acción reemplazará los datos actuales por los registros iniciales de demostración.'
            : 'Esta acción eliminará todas las compras, materiales, pedidos, clientes y pagos guardados. Te recomendamos exportar un respaldo antes si deseas conservarlos.'
        }
        confirmLabel={confirmAction === 'reset' ? 'Restaurar ejemplo' : 'Sí, vaciar todo'}
        tone={confirmAction === 'reset' ? 'warning' : 'danger'}
      />
    </div>
  );
};
