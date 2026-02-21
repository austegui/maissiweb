'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// The bot sends this message (or similar) when handing off to a human agent
const HANDOFF_PATTERNS = [
  'conectar con un asesor',
  'conectar con una persona',
  'transferir a un asesor',
  'transferir a una persona',
];

type ConversationData = {
  id: string;
  phoneNumber?: string;
  contactName?: string;
  lastMessage?: {
    content: string;
    direction: string;
  };
};

function isHandoffConversation(conv: ConversationData): boolean {
  if (!conv.lastMessage) return false;
  if (conv.lastMessage.direction !== 'outbound') return false;
  const content = conv.lastMessage.content.toLowerCase();
  return HANDOFF_PATTERNS.some((pattern) => content.includes(pattern));
}

// --- Audio ---

function createBeepSound(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;

  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const duration = 0.3;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 8);
      const tone1 = Math.sin(2 * Math.PI * 880 * t);
      const tone2 = Math.sin(2 * Math.PI * 1108.73 * t);
      channel[i] = (tone1 * 0.5 + tone2 * 0.5) * envelope * 0.4;
    }

    const wavBlob = audioBufferToWav(buffer);
    const url = URL.createObjectURL(wavBlob);
    const audio = new Audio(url);
    audio.volume = 0.7;
    return audio;
  } catch {
    return null;
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const data = buffer.getChannelData(0);
  const dataLength = data.length * bytesPerSample;
  const totalLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// --- Browser notifications ---

function requestNotificationPermission() {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;

  // Chrome requires a user gesture to show the permission prompt.
  // Request on the first click/keypress, then remove the listeners.
  const request = () => {
    Notification.requestPermission();
    document.removeEventListener('click', request);
    document.removeEventListener('keydown', request);
  };
  document.addEventListener('click', request, { once: true });
  document.addEventListener('keydown', request, { once: true });
}

async function showBrowserNotification(handoffs: ConversationData[]) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  // If permission is still 'default', try requesting (user may have just interacted)
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') return;

  for (const handoff of handoffs) {
    const name = handoff.contactName || handoff.phoneNumber || 'Cliente';
    const notification = new Notification(`${name} necesita ayuda de una persona`, {
      icon: '/favicon.ico',
      tag: `handoff-${handoff.id}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

// --- Hook ---

type UseHandoffAlertsReturn = {
  alertingIds: Set<string>;
  allHandoffIds: Set<string>;
  acknowledge: (conversationId: string) => void;
  /** Call this every time conversations are fetched */
  onConversationsUpdated: (conversations: ConversationData[]) => void;
};

export function useHandoffAlerts(): UseHandoffAlertsReturn {
  const [allHandoffIds, setAllHandoffIds] = useState<Set<string>>(new Set());
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevHandoffIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    audioRef.current = createBeepSound();
    requestNotificationPermission();
  }, []);

  const onConversationsUpdated = useCallback(
    (conversations: ConversationData[]) => {
      const handoffConvs = conversations.filter(isHandoffConversation);
      const newIds = new Set(handoffConvs.map((c) => c.id));

      // Detect brand-new handoffs
      const prevIds = prevHandoffIdsRef.current;
      const brandNew = handoffConvs.filter(
        (c) => !prevIds.has(c.id) && !acknowledgedIds.has(c.id)
      );

      if (brandNew.length > 0) {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        showBrowserNotification(brandNew);
      }

      prevHandoffIdsRef.current = newIds;
      setAllHandoffIds(newIds);
    },
    [acknowledgedIds]
  );

  const acknowledge = useCallback((conversationId: string) => {
    setAcknowledgedIds((prev) => new Set([...prev, conversationId]));
  }, []);

  const alertingIds = new Set(
    [...allHandoffIds].filter((id) => !acknowledgedIds.has(id))
  );

  return { alertingIds, allHandoffIds, acknowledge, onConversationsUpdated };
}
