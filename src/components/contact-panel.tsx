'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, ChevronDown } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';

type ContactPanelProps = {
  conversationId: string;
  phoneNumber: string;
  contactName?: string;
  onClose: () => void;
  conversationHistory: { id: string; contactName?: string; convStatus?: string; lastActiveAt?: string }[];
};

type Contact = {
  phone_number: string;
  display_name: string | null;
  email: string | null;
  notes: string | null;
  whatsapp_name: string | null;
};

type Note = {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
};

const STATUS_DOT: Record<string, string> = {
  abierto: 'bg-green-500',
  pendiente: 'bg-amber-500',
  resuelto: 'bg-gray-400',
};

type EditableFieldProps = {
  label: string;
  value: string | null;
  placeholder: string;
  onSave: (value: string) => void;
  type?: string;
};

function EditableField({ label, value, placeholder, onSave, type = 'text' }: EditableFieldProps) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  const handleBlur = async () => {
    const trimmed = localValue.trim();
    const original = (value ?? '').trim();
    if (trimmed !== original) {
      setSaving(true);
      try {
        await onSave(trimmed);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="mb-3">
      <label className="block text-[10px] uppercase font-semibold text-[#667781] mb-1 tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={saving}
        className={cn(
          'w-full text-sm text-[#111b21] bg-transparent border-0 border-b border-transparent',
          'hover:border-[#d1d7db] focus:border-[#00a884] focus:outline-none transition-colors py-1',
          'placeholder:text-[#667781]',
          saving && 'opacity-50'
        )}
      />
    </div>
  );
}

export function ContactPanel({
  conversationId,
  phoneNumber,
  contactName,
  onClose,
  conversationHistory,
}: ContactPanelProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteInput, setNoteInput] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);

  // Fetch contact on phone number change
  useEffect(() => {
    if (!phoneNumber) return;
    setLoading(true);
    const params = contactName ? `?name=${encodeURIComponent(contactName)}` : '';
    fetch(`/api/contacts/${encodeURIComponent(phoneNumber)}${params}`)
      .then((r) => r.json())
      .then((data) => {
        setContact(data.data ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [phoneNumber, contactName]);

  // Fetch notes on conversation change
  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/conversations/${conversationId}/notes`)
      .then((r) => r.json())
      .then((data) => setNotes(data.data ?? []))
      .catch(console.error);
  }, [conversationId]);

  const handleSaveField = async (field: string, value: string) => {
    const res = await fetch(`/api/contacts/${encodeURIComponent(phoneNumber)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const data = await res.json();
      setContact(data.data ?? null);
    }
  };

  const handleAddNote = async () => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        setNoteInput('');
        // Re-fetch notes
        const r = await fetch(`/api/conversations/${conversationId}/notes`);
        const data = await r.json();
        setNotes(data.data ?? []);
      }
    } finally {
      setSubmittingNote(false);
    }
  };

  const displayName = contact?.display_name || contact?.whatsapp_name || phoneNumber;

  return (
    <div className="hidden md:flex flex-col w-80 flex-shrink-0 border-l border-[#d1d7db] bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#d1d7db]">
        <div className="min-w-0">
          <p className="font-semibold text-[#111b21] text-sm truncate">
            {loading ? 'Cargando...' : displayName}
          </p>
          <p className="text-xs text-[#667781] truncate">{phoneNumber}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 flex-shrink-0 text-[#667781] hover:text-[#111b21] transition-colors"
          title="Cerrar panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Contact info */}
      <div className="px-4 py-3 border-b border-[#d1d7db]">
        <p className="text-[10px] uppercase font-semibold text-[#667781] tracking-wide mb-2">
          Datos del contacto
        </p>
        <EditableField
          label="Nombre"
          value={contact?.display_name ?? null}
          placeholder="Agregar nombre..."
          onSave={(v) => handleSaveField('display_name', v)}
        />
        <EditableField
          label="Email"
          value={contact?.email ?? null}
          placeholder="Agregar email..."
          type="email"
          onSave={(v) => handleSaveField('email', v)}
        />
        <EditableField
          label="Notas de contacto"
          value={contact?.notes ?? null}
          placeholder="Agregar notas..."
          onSave={(v) => handleSaveField('notes', v)}
        />
      </div>

      {/* Conversation history */}
      <div className="px-4 py-3 border-b border-[#d1d7db]">
        <p className="text-[10px] uppercase font-semibold text-[#667781] tracking-wide mb-2">
          Historial ({conversationHistory.length})
        </p>
        {conversationHistory.length === 0 ? (
          <p className="text-xs text-[#667781]">Sin conversaciones previas</p>
        ) : (
          <ul className="space-y-1">
            {conversationHistory.map((conv) => {
              const statusKey = conv.convStatus ?? 'abierto';
              const dotColor = STATUS_DOT[statusKey] ?? 'bg-gray-400';
              let dateStr = '';
              if (conv.lastActiveAt) {
                try {
                  dateStr = format(new Date(conv.lastActiveAt), 'dd MMM yyyy');
                } catch {
                  dateStr = '';
                }
              }
              return (
                <li key={conv.id} className="flex items-center gap-2 text-xs text-[#111b21]">
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', dotColor)} />
                  <span className="flex-1 truncate">{dateStr || conv.id.slice(0, 8)}</span>
                  <span className="text-[#667781] capitalize">{statusKey}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Notes section (Radix Collapsible) */}
      <Collapsible.Root open={notesOpen} onOpenChange={setNotesOpen} className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase font-semibold text-[#667781] tracking-wide">
            Notas internas
          </p>
          <Collapsible.Trigger asChild>
            <button className="text-[#667781] hover:text-[#111b21] transition-colors">
              <ChevronDown
                className={cn('h-4 w-4 transition-transform duration-200', notesOpen && 'rotate-180')}
              />
            </button>
          </Collapsible.Trigger>
        </div>

        <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-none">
          {/* Add note */}
          <div className="mb-3">
            <textarea
              rows={3}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Escribe una nota interna..."
              className="w-full text-sm text-[#111b21] bg-[#fffde7] border border-[#d1d7db] rounded-md p-2 resize-none focus:outline-none focus:border-[#00a884] placeholder:text-[#667781]"
            />
            <button
              onClick={handleAddNote}
              disabled={submittingNote || !noteInput.trim()}
              className={cn(
                'mt-1 w-full text-xs font-medium py-1.5 rounded-md transition-colors',
                'bg-[#00a884] text-white hover:bg-[#008f71]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submittingNote ? 'Guardando...' : 'Guardar nota'}
            </button>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <p className="text-xs text-[#667781]">Sin notas aun</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => {
                let timeStr = '';
                try {
                  timeStr = format(new Date(note.createdAt), 'dd MMM, HH:mm');
                } catch {
                  timeStr = '';
                }
                return (
                  <li key={note.id} className="bg-[#fffde7] rounded-md p-2">
                    <p className="text-sm text-[#111b21] whitespace-pre-wrap">{note.content}</p>
                    <p className="text-[10px] text-[#667781] mt-1">
                      {note.authorName} · {timeStr}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}
