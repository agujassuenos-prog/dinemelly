import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../store/useTheme';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  compact = false,
  className = '',
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Tema oscuro activo (clic para modo claro)' : 'Tema claro activo (clic para modo oscuro)'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E5D7CD] bg-white/85 hover:bg-[#F4E7DE] text-[#3B281E] transition-colors shrink-0 ${
        compact ? 'w-9 h-9 p-0' : 'px-3 py-2 text-xs font-medium'
      } ${className}`}
    >
      {isDark ? (
        <Moon className="w-4 h-4 text-[#AF8064]" aria-hidden="true" />
      ) : (
        <Sun className="w-4 h-4 text-[#B45309]" aria-hidden="true" />
      )}
      {!compact && (
        <span className="whitespace-nowrap">
          {isDark ? 'Modo oscuro' : 'Modo claro'}
        </span>
      )}
    </button>
  );
};
