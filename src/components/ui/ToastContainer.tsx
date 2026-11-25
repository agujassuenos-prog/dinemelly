import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useDinemelly } from '../../store/useDinemellyStore';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useDinemelly();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border bg-white shadow-lg transition-all duration-150 ${
              isSuccess
                ? 'border-[#BBF7D0]'
                : isError
                ? 'border-[#FECACA]'
                : 'border-[#E7E3DC]'
            }`}
          >
            <div
              className={`mt-0.5 shrink-0 ${
                isSuccess
                  ? 'text-[#15803D]'
                  : isError
                  ? 'text-[#B91C1C]'
                  : 'text-[#7C3A52]'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : isError ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1F1C19]">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-[#6E675F] mt-0.5">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Cerrar aviso"
              className="p-1 text-[#6E675F] hover:text-[#1F1C19] rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
