'use client';

import { useState, useRef, useCallback } from 'react';

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

// --- Hook ---
// This hook handles ONLY visual handoff detection (amber border + badge).
// Sound and browser notifications for all inbound messages are handled
// by useMessageAlerts in src/hooks/use-message-alerts.ts.

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
  const prevHandoffIdsRef = useRef<Set<string>>(new Set());

  const onConversationsUpdated = useCallback(
    (conversations: ConversationData[]) => {
      const handoffConvs = conversations.filter(isHandoffConversation);
      const newIds = new Set(handoffConvs.map((c) => c.id));

      prevHandoffIdsRef.current = newIds;
      setAllHandoffIds(newIds);
    },
    []
  );

  const acknowledge = useCallback((conversationId: string) => {
    setAcknowledgedIds((prev) => new Set([...prev, conversationId]));
  }, []);

  const alertingIds = new Set(
    [...allHandoffIds].filter((id) => !acknowledgedIds.has(id))
  );

  return { alertingIds, allHandoffIds, acknowledge, onConversationsUpdated };
}
