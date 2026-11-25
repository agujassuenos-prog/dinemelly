import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMsg = 'Ocurrió un inconveniente inesperado al procesar tus datos.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        if (parsed.error.toLowerCase().includes('permission')) {
          displayMsg =
            'No tienes permisos para realizar esta acción o tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.';
        } else {
          displayMsg = parsed.error;
        }
      }
    } catch {
      if (error?.message) {
        displayMsg = error.message;
      }
    }
    return { hasError: true, message: displayMsg };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF6F2] text-[#3B281E] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#FDFBFA] border border-[#EDE2D8] rounded-2xl p-6 shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="font-display text-xl font-bold text-[#3B281E]">
              Algo salió mal
            </h1>
            <p className="text-sm text-[#7D6659] leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#AF8064] hover:bg-[#976B51] rounded-xl transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              <span>Recargar aplicación</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
