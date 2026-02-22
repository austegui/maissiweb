'use client';

import { Bell, BellOff } from 'lucide-react';

type Props = {
  enabled: boolean;
  onToggle: (value: boolean) => void;
};

export function NotificationToggle({ enabled, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      title={enabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
      className="flex items-center justify-center p-1.5 rounded-md hover:bg-gray-100 transition-colors"
      aria-label={enabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}
    >
      {enabled ? (
        <Bell className="h-4 w-4 text-green-500" />
      ) : (
        <BellOff className="h-4 w-4 text-gray-400" />
      )}
    </button>
  );
}
