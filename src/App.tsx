import React from 'react';
import { DinemellyProvider, useDinemelly } from './store/useDinemellyStore';
import { ThemeProvider } from './store/useTheme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/ui/ToastContainer';
import { DashboardView } from './modules/DashboardView';
import { ComprasView } from './modules/ComprasView';
import { InventarioView } from './modules/InventarioView';
import { CalculadoraView } from './modules/CalculadoraView';
import { PedidosView } from './modules/PedidosView';
import { ClientesView } from './modules/ClientesView';
import { VentasPagosView } from './modules/VentasPagosView';
import { EstadisticasView } from './modules/EstadisticasView';

const ActiveModuleRenderer: React.FC = () => {
  const { activeModule } = useDinemelly();

  switch (activeModule) {
    case 'dashboard':
      return <DashboardView />;
    case 'compras':
      return <ComprasView />;
    case 'inventario':
      return <InventarioView />;
    case 'calculadora':
      return <CalculadoraView />;
    case 'pedidos':
      return <PedidosView />;
    case 'clientes':
      return <ClientesView />;
    case 'ventas':
      return <VentasPagosView />;
    case 'estadisticas':
      return <EstadisticasView />;
    default:
      return <DashboardView />;
  }
};

const AppShell: React.FC = () => {
  const { user, authReady, dataLoading } = useDinemelly();

  if (!authReady || (user && dataLoading)) {
    return (
      <div className="min-h-screen bg-[#FAF6F2] text-[#3B281E] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-4 border-[#EAD5C6] border-t-[#AF8064] animate-spin mb-4" />
        <p className="font-display text-lg font-semibold text-[#3B281E]">
          Dinemelly
        </p>
        <p className="text-xs text-[#7D6659] mt-1">
          {!authReady ? 'Verificando tu sesión...' : 'Cargando los datos de tu taller...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  return (
    <Layout>
      <ActiveModuleRenderer />
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <DinemellyProvider>
          <AppShell />
          <ToastContainer />
        </DinemellyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
