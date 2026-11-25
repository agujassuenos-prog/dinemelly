import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-[#FDFBFA] border border-[#EDE2D8] rounded-2xl shadow-[0_4px_20px_rgba(92,62,46,0.03)]">
      <div className="w-12 h-12 rounded-2xl bg-[#F4E7DE] text-[#9E7358] flex items-center justify-center mb-3.5">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="font-display text-lg font-semibold text-[#3B281E]">{title}</h4>
      {description && (
        <p className="mt-1.5 text-sm text-[#7D6659] max-w-md">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-5 py-2.5 text-sm font-semibold text-white bg-[#AF8064] hover:bg-[#976B51] rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-[0_6px_14px_rgba(175,128,100,0.22)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
