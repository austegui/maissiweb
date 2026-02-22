'use client';

import { useEffect, useRef, useCallback } from 'react';

type ConversationData = {
  id: string;
  phoneNumber?: string;
  contactName?: string;
  lastMessage?: {
    content: string;
    direction: string;
  };
  assignedAgentId?: string | null;
  lastActiveAt?: string;
};

type UseMessageAlertsOptions = {
  notificationsEnabled: boolean;
  currentUserId?: string;
};

type UseMessageAlertsReturn = {
  onConversationsUpdated: (conversations: ConversationData[]) => void;
  markSentMessage: () => void;
};

// Lazily created AudioContext to avoid issues before user gesture
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  ctx.resume().then(() => {
    const now = ctx.currentTime;

    // Two-note ascending chime: C6 (1046.50 Hz) then E6 (1318.51 Hz)
    const notes = [
      { freq: 1046.5, startOffset: 0 },
      { freq: 1318.51, startOffset: 0.15 },
    ];

    for (const note of notes) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.freq, now + note.startOffset);

      gainNode.gain.setValueAtTime(0.4, now + note.startOffset);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + note.startOffset + 0.5);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(now + note.startOffset);
      oscillator.stop(now + note.startOffset + 0.5);
    }
  }).catch(() => {});
}

function showBrowserNotification(conv: ConversationData): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;

  const contactName = conv.contactName || conv.phoneNumber || 'Cliente';
  const content = conv.lastMessage?.content ?? '';
  const preview = content.slice(0, 60);
  const title = `${contactName}: ${preview}`;

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      tag: `message-${conv.id}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Notification creation can fail in some browsers
  }
}

function requestNotificationPermission(): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;

  const request = () => {
    Notification.requestPermission();
    document.removeEventListener('click', request);
    document.removeEventListener('keydown', request);
  };
  document.addEventListener('click', request, { once: true });
  document.addEventListener('keydown', request, { once: true });
}

export function useMessageAlerts({
  notificationsEnabled,
  currentUserId,
}: UseMessageAlertsOptions): UseMessageAlertsReturn {
  // Map of conversationId -> lastActiveAt timestamp string
  const prevLastActiveMapRef = useRef<Map<string, string>>(new Map());
  // Timestamp of last chime (for 3-second cooldown)
  const lastChimeAtRef = useRef<number>(0);
  // Timestamp of last sent message (for 5-second own-sent suppression)
  const lastSentAtRef = useRef<number>(0);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const markSentMessage = useCallback(() => {
    lastSentAtRef.current = Date.now();
  }, []);

  const onConversationsUpdated = useCallback(
    (conversations: ConversationData[]) => {
      const now = Date.now();
      const prevMap = prevLastActiveMapRef.current;
      const newMap = new Map<string, string>();

      let shouldChime = false;
      const newConvsToNotify: ConversationData[] = [];

      for (const conv of conversations) {
        const lastActiveAt = conv.lastActiveAt ?? '';
        newMap.set(conv.id, lastActiveAt);

        // Only look at inbound messages
        if (conv.lastMessage?.direction !== 'inbound') continue;

        // Only alert for unassigned or assigned-to-me conversations
        const isUnassigned = conv.assignedAgentId == null;
        const isAssignedToMe = currentUserId != null && conv.assignedAgentId === currentUserId;
        if (!isUnassigned && !isAssignedToMe) continue;

        // Suppress if agent just sent a message (within 5 seconds)
        if (now - lastSentAtRef.current < 5000) continue;

        // Check if this is a NEW inbound message (lastActiveAt changed)
        const prevLastActiveAt = prevMap.get(conv.id);
        const isNew = prevLastActiveAt !== undefined && lastActiveAt !== prevLastActiveAt;
        // Also alert for brand new conversations not seen before
        const isBrandNew = prevLastActiveAt === undefined && lastActiveAt !== '';

        if (!isNew && !isBrandNew) continue;

        if (!notificationsEnabled) continue;

        shouldChime = true;
        newConvsToNotify.push(conv);
      }

      // Update the map for next comparison
      prevLastActiveMapRef.current = newMap;

      if (!notificationsEnabled) return;
      if (newConvsToNotify.length === 0) return;

      // Chime with 3-second cooldown
      if (shouldChime && now - lastChimeAtRef.current >= 3000) {
        playChime();
        lastChimeAtRef.current = now;
      }

      // Browser notifications (no cooldown — one per conversation via tag)
      for (const conv of newConvsToNotify) {
        showBrowserNotification(conv);
      }
    },
    [notificationsEnabled, currentUserId]
  );

  return { onConversationsUpdated, markSentMessage };
}
