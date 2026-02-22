'use client';

import { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { format, isValid, isToday, isYesterday } from 'date-fns';
import { RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutoPolling } from '@/hooks/use-auto-polling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import * as Tabs from '@radix-ui/react-tabs';

type Conversation = {
  id: string;
  phoneNumber: string;
  status: string;
  lastActiveAt: string;
  phoneNumberId: string;
  metadata?: Record<string, unknown>;
  contactName?: string;
  messagesCount?: number;
  lastMessage?: {
    content: string;
    direction: string;
    type?: string;
  };
  convStatus?: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  labels?: { id: string; name: string; color: string }[];
};

const STATUS_DOT_CLASS: Record<string, string> = {
  abierto: 'bg-green-500',
  pendiente: 'bg-amber-500',
  resuelto: 'bg-gray-400',
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getContrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 128 ? '#111827' : '#ffffff';
}

function formatConversationDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (!isValid(date)) return '';

    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  } catch {
    return '';
  }
}

function getAvatarInitials(contactName?: string, phoneNumber?: string): string {
  if (contactName) {
    const words = contactName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return contactName.slice(0, 2).toUpperCase();
  }

  if (phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.slice(-2);
  }

  return '??';
}

type Props = {
  onSelectConversation: (conversation: Conversation) => void;
  selectedConversationId?: string;
  isHidden?: boolean;
  handoffIds?: Set<string>;
  onConversationsLoaded?: (conversations: Conversation[], meta?: { agents: { id: string; displayName: string }[]; currentUserId: string | null }) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  assignmentFilter: string;
  onAssignmentFilterChange: (value: string) => void;
  labelFilter: string | null;
  onLabelFilterChange: (value: string | null) => void;
  currentUserId?: string;
  allLabels?: { id: string; name: string; color: string }[];
  realtimeConnected?: boolean;
};

export type ConversationListRef = {
  refresh: () => Promise<Conversation[]>;
  selectByPhoneNumber: (phoneNumber: string) => void;
};

export const ConversationList = forwardRef<ConversationListRef, Props>(
  ({ onSelectConversation, selectedConversationId, isHidden = false, handoffIds, onConversationsLoaded, statusFilter, onStatusFilterChange, assignmentFilter, onAssignmentFilterChange, labelFilter, onLabelFilterChange, currentUserId, allLabels, realtimeConnected }, ref) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  onConversationsLoadedRef.current = onConversationsLoaded;

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const conversationsRef = useRef<Conversation[]>([]);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      const convs: Conversation[] = data.data || [];

      // Skip setState + parent notification if data hasn't changed
      // Compare IDs, lastActiveAt, and metadata fields to catch Realtime updates
      const prev = conversationsRef.current;
      const changed = convs.length !== prev.length || convs.some((c, i) =>
        c.id !== prev[i]?.id ||
        c.lastActiveAt !== prev[i]?.lastActiveAt ||
        c.convStatus !== prev[i]?.convStatus ||
        c.assignedAgentId !== prev[i]?.assignedAgentId
      );

      if (changed) {
        conversationsRef.current = convs;
        setConversations(convs);
        const meta = data.agents !== undefined
          ? { agents: data.agents ?? [], currentUserId: data.currentUserId ?? null }
          : undefined;
        onConversationsLoadedRef.current?.(convs, meta);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error; // Re-throw so polling hook can apply backoff
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  // Auto-polling: 5s fallback when Realtime is disconnected, 10s when connected
  // Use strict check so undefined (before hook initializes) defaults to 10s
  const pollingInterval = realtimeConnected === false ? 5000 : 10000;
  const { isPolling } = useAutoPolling({
    interval: pollingInterval,
    enabled: true,
    onPoll: fetchConversations
  });

  const selectByPhoneNumber = (phoneNumber: string) => {
    const conversation = conversations.find(conv => conv.phoneNumber === phoneNumber);
    if (conversation) {
      onSelectConversation(conversation);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: async () => {
      await fetchConversations();
      return conversationsRef.current;
    },
    selectByPhoneNumber
  }));

  const filteredConversations = conversations.filter((conv) => {
    // Text search filter
    const query = debouncedQuery.toLowerCase();
    const matchesSearch =
      conv.phoneNumber.toLowerCase().includes(query) ||
      conv.contactName?.toLowerCase().includes(query);

    // Status tab filter
    const convStatus = conv.convStatus ?? 'abierto';
    const matchesStatus = statusFilter === 'todos' || convStatus === statusFilter;

    // Assignment filter
    let matchesAssignment = true;
    if (assignmentFilter === 'mios') {
      matchesAssignment = conv.assignedAgentId === currentUserId;
    } else if (assignmentFilter === 'sin_asignar') {
      matchesAssignment = !conv.assignedAgentId;
    }

    // Label filter
    const matchesLabel = !labelFilter || (conv.labels ?? []).some((l) => l.id === labelFilter);

    return matchesSearch && matchesStatus && matchesAssignment && matchesLabel;
  });

  function getEmptyStateText(): string {
    if (statusFilter === 'abierto') return 'No hay conversaciones abiertas';
    if (statusFilter === 'pendiente') return 'No hay conversaciones pendientes';
    if (statusFilter === 'resuelto') return 'No hay conversaciones resueltas';
    if (searchQuery) return 'No se encontraron conversaciones';
    return 'No hay conversaciones aun';
  }

  if (loading) {
    return (
      <div className={cn(
        "w-full md:w-96 border-r border-[#d1d7db] bg-white flex flex-col",
        isHidden && "hidden md:flex"
      )}>
        <div className="p-4 border-b border-[#d1d7db] bg-[#f0f2f5]">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="flex-1 p-3 space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex gap-3 p-3">
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full md:w-96 border-r border-[#d1d7db] bg-white flex flex-col",
      isHidden && "hidden md:flex"
    )}>
      <div className="p-4 pb-0 border-b border-[#d1d7db] bg-[#f0f2f5]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[#111b21]">Chats</h1>
            {isPolling && (
              <div
                className="h-2 w-2 rounded-full bg-green-500 animate-pulse"
                title="Auto-updating"
              />
            )}
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="ghost"
            size="icon"
            className="text-[#667781] hover:bg-[#d1d7db]/30"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667781]" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or start new chat"
            className="pl-9 bg-white border-[#d1d7db] focus-visible:ring-[#00a884] rounded-lg"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <select
            value={assignmentFilter}
            onChange={(e) => onAssignmentFilterChange(e.target.value)}
            className="text-xs border border-[#d1d7db] rounded px-2 py-1 bg-white text-[#111b21] outline-none focus:ring-1 focus:ring-[#00a884] flex-1 min-w-0"
          >
            <option value="todos">Todos</option>
            <option value="mios">Mis conversaciones</option>
            <option value="sin_asignar">Sin asignar</option>
          </select>
          <select
            value={labelFilter ?? ''}
            onChange={(e) => onLabelFilterChange(e.target.value || null)}
            className="text-xs border border-[#d1d7db] rounded px-2 py-1 bg-white text-[#111b21] outline-none focus:ring-1 focus:ring-[#00a884] flex-1 min-w-0 truncate"
          >
            <option value="">Etiqueta</option>
            {(allLabels ?? []).map((label) => (
              <option key={label.id} value={label.id}>{label.name}</option>
            ))}
          </select>
        </div>
        <Tabs.Root value={statusFilter} onValueChange={onStatusFilterChange}>
          <Tabs.List className="flex border-t border-[#e9edef] mt-3 -mb-[1px]">
            {(['abierto', 'pendiente', 'resuelto', 'todos'] as const).map((tab) => (
              <Tabs.Trigger
                key={tab}
                value={tab}
                className="flex-1 px-2 py-2 text-xs font-medium text-[#667781] data-[state=active]:text-[#00a884] data-[state=active]:border-b-2 data-[state=active]:border-[#00a884] transition-colors capitalize"
              >
                {tab === 'abierto' ? 'Abierto' :
                 tab === 'pendiente' ? 'Pendiente' :
                 tab === 'resuelto' ? 'Resuelto' : 'Todos'}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
      </div>

      <ScrollArea className="flex-1 h-0 overflow-hidden">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-[#667781]">
            {getEmptyStateText()}
          </div>
        ) : (
          <div className="w-full overflow-hidden">
          {filteredConversations.map((conversation) => {
            const isHandoff = handoffIds?.has(conversation.id) ?? false;
            const dotClass = STATUS_DOT_CLASS[conversation.convStatus ?? 'abierto'] ?? 'bg-gray-400';
            return (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={cn(
                'w-full p-3 pr-4 border-b border-[#e9edef] hover:bg-[#f0f2f5] text-left transition-colors relative overflow-hidden',
                selectedConversationId === conversation.id && 'bg-[#f0f2f5]',
                isHandoff && 'bg-[#fff8e1] border-l-4 border-l-[#f59e0b] hover:bg-[#fff3cd]'
              )}
            >
              <div className="flex gap-3 items-start overflow-hidden">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className={cn(
                    "text-sm font-medium",
                    isHandoff ? "bg-[#f59e0b] text-white" : "bg-[#d1d7db] text-[#111b21]"
                  )}>
                    {getAvatarInitials(conversation.contactName, conversation.phoneNumber)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex justify-between items-start gap-2 overflow-hidden">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotClass)} />
                      <p className="font-medium text-[#111b21] truncate">
                        {conversation.contactName || conversation.phoneNumber}
                      </p>
                      {isHandoff && (
                        <Badge className="bg-[#f59e0b] hover:bg-[#d97706] text-white text-[10px] px-1.5 py-0 flex-shrink-0">
                          Handoff
                        </Badge>
                      )}
                    </div>
                    {conversation.lastMessage && (
                      <p className="text-sm text-[#667781] truncate mt-0.5">
                        {conversation.lastMessage.direction === 'outbound' && (
                          <span className="text-[#53bdeb]">✓ </span>
                        )}
                        {conversation.lastMessage.content}
                      </p>
                    )}
                    {conversation.labels && conversation.labels.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 overflow-hidden">
                        {conversation.labels.slice(0, 3).map((label) => (
                          <span
                            key={label.id}
                            style={{ backgroundColor: label.color, color: getContrastColor(label.color) }}
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 max-w-[60px] truncate"
                          >
                            {label.name}
                          </span>
                        ))}
                        {conversation.labels.length > 3 && (
                          <span className="text-[9px] text-[#667781]">+{conversation.labels.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-[#667781]">
                      {formatConversationDate(conversation.lastActiveAt)}
                    </span>
                    {conversation.assignedAgentName && (
                      <span
                        className="h-5 w-5 rounded-full bg-[#d1d7db] text-[#111b21] text-[9px] font-medium flex items-center justify-center flex-shrink-0"
                        title={conversation.assignedAgentName}
                      >
                        {getInitials(conversation.assignedAgentName)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
            );
          })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});

ConversationList.displayName = 'ConversationList';
