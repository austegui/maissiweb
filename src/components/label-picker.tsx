'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

type Label = { id: string; name: string; color: string };

type Props = {
  allLabels: Label[];
  selectedLabels: Label[];
  onToggle: (label: Label, selected: boolean) => void;
  onClose: () => void;
};

export function LabelPicker({ allLabels, selectedLabels, onToggle, onClose }: Props) {
  const selectedIds = new Set(selectedLabels.map((l) => l.id));
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#d1d7db] rounded-lg shadow-lg z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-[#e9edef] flex items-center justify-between">
        <span className="text-xs font-medium text-[#111b21]">Etiquetas</span>
        <button
          onClick={onClose}
          className="text-[#667781] hover:text-[#111b21] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {allLabels.length === 0 ? (
          <p className="text-xs text-[#667781] px-3 py-2">No hay etiquetas disponibles</p>
        ) : (
          allLabels.map((label) => {
            const isSelected = selectedIds.has(label.id);
            return (
              <button
                key={label.id}
                onClick={() => onToggle(label, !isSelected)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f0f2f5] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="h-3.5 w-3.5 rounded border-gray-300 text-[#00a884] focus:ring-[#00a884]"
                />
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="text-sm text-[#111b21] truncate">{label.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
