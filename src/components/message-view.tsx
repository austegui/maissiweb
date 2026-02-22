'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { format, isValid, isToday, isYesterday, differenceInHours } from 'date-fns';
import { RefreshCw, Paperclip, Send, X, AlertCircle, MessageSquare, XCircle, ListTree, ArrowLeft, UserRound, ChevronDown, Check, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaMessage } from '@/components/media-message';
import { TemplateSelectorDialog } from '@/components/template-selector-dialog';
import { InteractiveMessageDialog } from '@/components/interactive-message-dialog'
import { CannedResponsesPicker } from '@/components/canned-responses-picker';
import { LabelPicker } from '@/components/label-picker';
import { useAutoPolling } from '@/hooks/use-auto-polling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import * as Select from '@radix-ui/react-select';
import type { MediaData } from '@kapso/whatsapp-cloud-api';

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  createdAt: string;
  status?: string;
  phoneNumber: string;
  hasMedia: boolean;
  mediaData?: {
    url: string;
    contentType?: string;
    filename?: string;
  } | (MediaData & { url: string });
  reactionEmoji?: string | null;
  reactedToMessageId?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  messageType?: string;
  caption?: string | null;
  metadata?: {
    mediaId?: string;
    caption?: string;
  };
};

const STATUS_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  pendiente: 'Pendiente',
  resuelto: 'Resuelto',
};

const STATUS_DOT: Record<string, string> = {
  abierto: 'bg-green-500',
  pendiente: 'bg-amber-500',
  resuelto: 'bg-gray-400',
};

function formatMessageTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (isValid(date)) {
      return format(date, 'HH:mm');
    }
    return '';
  } catch {
    return '';
  }
}

function formatDateDivider(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (!isValid(date)) return '';

    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  } catch {
    return '';
  }
}

function shouldShowDateDivider(currentMsg: Message, prevMsg: Message | null): boolean {
  if (!prevMsg) return true;

  try {
    const currentDate = new Date(currentMsg.createdAt);
    const prevDate = new Date(prevMsg.createdAt);

    if (!isValid(currentDate) || !isValid(prevDate)) return false;

    return format(currentDate, 'yyyy-MM-dd') !== format(prevDate, 'yyyy-MM-dd');
  } catch {
    return false;
  }
}

function isWithin24HourWindow(messages: Message[]): boolean {
  // Find the last inbound message
  const inboundMessages = messages.filter(msg => msg.direction === 'inbound');

  if (inboundMessages.length === 0) {
    // No inbound messages yet - only templates allowed
    return false;
  }

  const lastInboundMessage = inboundMessages[inboundMessages.length - 1];

  try {
    const lastMessageDate = new Date(lastInboundMessage.createdAt);
    if (!isValid(lastMessageDate)) return false;

    const hoursSinceLastMessage = differenceInHours(new Date(), lastMessageDate);
    return hoursSinceLastMessage < 24;
  } catch {
    return false; // In case of error, only allow templates
  }
}

function getDisabledInputMessage(messages: Message[]): string {
  const inboundMessages = messages.filter(msg => msg.direction === 'inbound');

  if (inboundMessages.length === 0) {
    return "User hasn't messaged yet. Send a template message or wait for them to reply.";
  }

  return "Last message was over 24 hours ago. Send a template message or wait for the user to message you.";
}

type StatusSelectProps = {
  value: string;
  onChange: (newStatus: string) => void;
};

function StatusSelect({ value, onChange }: StatusSelectProps) {
  const dotClass = STATUS_DOT[value] ?? 'bg-gray-400';
  const label = STATUS_LABELS[value] ?? value;

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm border border-[#d1d7db] bg-white hover:bg-[#f0f2f5] transition-colors outline-none data-[state=open]:ring-2 data-[state=open]:ring-[#00a884]"
        aria-label="Estado de conversacion"
      >
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotClass)} />
        <Select.Value>{label}</Select.Value>
        <Select.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-[#667781]" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="bg-white border border-[#d1d7db] rounded-lg shadow-lg z-50 overflow-hidden"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport>
            {(['abierto', 'pendiente', 'resuelto'] as const).map((status) => (
              <Select.Item
                key={status}
                value={status}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#111b21] cursor-pointer hover:bg-[#f0f2f5] outline-none data-[highlighted]:bg-[#f0f2f5] select-none"
              >
                <span className={cn("h-2 w-2 rounded-full flex-shrink-0", STATUS_DOT[status])} />
                <Select.ItemText>{STATUS_LABELS[status]}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check className="h-3 w-3 text-[#00a884]" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

type AssignmentSelectProps = {
  agents: { id: string; displayName: string }[];
  value: string | null;
  onChange: (value: string) => void;
};

function AssignmentSelect({ agents, value, onChange }: AssignmentSelectProps) {
  const assignedAgent = agents.find((a) => a.id === value);
  const displayLabel = assignedAgent ? assignedAgent.displayName : 'Sin asignar';

  return (
    <Select.Root value={value ?? '__unassigned__'} onValueChange={onChange}>
      <Select.Trigger
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-[#d1d7db] bg-white hover:bg-[#f0f2f5] transition-colors outline-none data-[state=open]:ring-2 data-[state=open]:ring-[#00a884]"
        aria-label="Asignacion de agente"
      >
        <Select.Value>{displayLabel}</Select.Value>
        <Select.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-[#667781]" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="bg-white border border-[#d1d7db] rounded-lg shadow-lg z-50 overflow-hidden"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport>
            <Select.Item
              value="__unassigned__"
              className="flex items-center gap-2 px-3 py-2 text-xs text-[#667781] cursor-pointer hover:bg-[#f0f2f5] outline-none data-[highlighted]:bg-[#f0f2f5] select-none"
            >
              <Select.ItemText>Sin asignar</Select.ItemText>
              <Select.ItemIndicator className="ml-auto">
                <Check className="h-3 w-3 text-[#00a884]" />
              </Select.ItemIndicator>
            </Select.Item>
            {agents.map((agent) => (
              <Select.Item
                key={agent.id}
                value={agent.id}
                className="flex items-center gap-2 px-3 py-2 text-xs text-[#111b21] cursor-pointer hover:bg-[#f0f2f5] outline-none data-[highlighted]:bg-[#f0f2f5] select-none"
              >
                <Select.ItemText>{agent.displayName}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check className="h-3 w-3 text-[#00a884]" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

type Props = {
  conversationId?: string;
  phoneNumber?: string;
  contactName?: string;
  convStatus?: string;
  onStatusChange?: (conversationId: string, newStatus: string) => void;
  onTemplateSent?: (phoneNumber: string) => Promise<void>;
  onBack?: () => void;
  isVisible?: boolean;
  isHandoff?: boolean;
  agents?: { id: string; displayName: string }[];
  assignedAgentId?: string | null;
  onAssignmentChange?: (conversationId: string, agentId: string | null, agentName: string | null) => void;
  allLabels?: { id: string; name: string; color: string }[];
  contactLabels?: { id: string; name: string; color: string }[];
  onLabelsChange?: (conversationId: string, labels: { id: string; name: string; color: string }[]) => void;
  onTogglePanel?: () => void;
  isPanelOpen?: boolean;
  onMessageSent?: () => void;
};

export function MessageView({ conversationId, phoneNumber, contactName, convStatus, onStatusChange, onTemplateSent, onBack, isVisible = false, isHandoff = false, agents, assignedAgentId, onAssignmentChange, allLabels, contactLabels, onLabelsChange, onTogglePanel, isPanelOpen, onMessageSent }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [canSendRegularMessage, setCanSendRegularMessage] = useState(true);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showInteractiveDialog, setShowInteractiveDialog] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showCannedPicker, setShowCannedPicker] = useState(false);
  const [cannedQuery, setCannedQuery] = useState('');
  const [localStatus, setLocalStatus] = useState(convStatus ?? 'abierto');
  const [localAssignedAgentId, setLocalAssignedAgentId] = useState<string | null>(assignedAgentId ?? null);
  const [localLabels, setLocalLabels] = useState<{ id: string; name: string; color: string }[]>(contactLabels ?? []);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousMessageCountRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastMessageStatusRef = useRef<string | undefined>(undefined);
  const autoReopenedRef = useRef<string | null>(null);

  // Sync localStatus when convStatus prop changes (e.g., switching conversations)
  useEffect(() => {
    setLocalStatus(convStatus ?? 'abierto');
  }, [convStatus]);

  // Sync assignment when prop changes (e.g., switching conversations)
  useEffect(() => {
    setLocalAssignedAgentId(assignedAgentId ?? null);
  }, [assignedAgentId]);

  // Sync labels when prop changes (e.g., switching conversations)
  useEffect(() => {
    setLocalLabels(contactLabels ?? []);
  }, [contactLabels]);

  // Close label picker when conversation changes
  useEffect(() => {
    setShowLabelPicker(false);
  }, [conversationId]);

  // Reset auto-reopen tracking when conversation changes
  useEffect(() => {
    autoReopenedRef.current = null;
  }, [conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await fetch(`/api/messages/${conversationId}`);
      const data = await response.json();

      // Separate reactions from regular messages
      const reactions = (data.data || []).filter((msg: Message) => msg.messageType === 'reaction');
      const regularMessages = (data.data || []).filter((msg: Message) => msg.messageType !== 'reaction');

      // Create a map of message ID to reaction emoji
      const reactionMap = new Map<string, string>();
      reactions.forEach((reaction: Message) => {
        if (reaction.reactedToMessageId && reaction.reactionEmoji) {
          reactionMap.set(reaction.reactedToMessageId, reaction.reactionEmoji);
        }
      });

      // Attach reactions to their corresponding messages
      const messagesWithReactions = regularMessages.map((msg: Message) => {
        const reaction = reactionMap.get(msg.id);
        return reaction ? { ...msg, reactionEmoji: reaction } : msg;
      });

      const sortedMessages = messagesWithReactions.sort((a: Message, b: Message) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // Skip setState if data hasn't changed
      const lastNew = sortedMessages[sortedMessages.length - 1];
      const changed = sortedMessages.length !== previousMessageCountRef.current ||
        lastNew?.id !== lastMessageIdRef.current ||
        lastNew?.status !== lastMessageStatusRef.current;

      if (changed) {
        setMessages(sortedMessages);
      }
      previousMessageCountRef.current = sortedMessages.length;
      lastMessageIdRef.current = lastNew?.id ?? null;
      lastMessageStatusRef.current = lastNew?.status;

      // Auto-reopen: if conversation is 'resuelto' and last message is inbound, reopen to 'abierto'
      const lastMsg = sortedMessages[sortedMessages.length - 1];
      if (
        localStatus === 'resuelto' &&
        lastMsg?.direction === 'inbound' &&
        autoReopenedRef.current !== conversationId
      ) {
        autoReopenedRef.current = conversationId;
        fetch(`/api/conversations/${conversationId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'abierto' })
        }).catch(err => console.error('Auto-reopen failed:', err));
        setLocalStatus('abierto');
        onStatusChange?.(conversationId!, 'abierto');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conversationId, localStatus, onStatusChange]);

  useEffect(() => {
    if (conversationId) {
      setLoading(true);
      fetchMessages();
    }
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    // Only auto-scroll if user is near bottom
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [messages, isNearBottom]);

  useEffect(() => {
    setCanSendRegularMessage(isWithin24HourWindow(messages));
  }, [messages]);

  // Track if user is near bottom of scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const viewport = container.querySelector('[data-radix-scroll-area-viewport]');
      if (!viewport) return;

      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setIsNearBottom(distanceFromBottom < 100);
    };

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll);
      return () => viewport.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  // Auto-polling for messages (every 5 seconds)
  useAutoPolling({
    interval: 5000,
    enabled: !!conversationId,
    onPoll: fetchMessages
  });

  const handleStatusChange = async (newStatus: string) => {
    setLocalStatus(newStatus); // optimistic update
    // Reset auto-reopen ref when user manually sets status to resuelto
    if (newStatus === 'resuelto') {
      autoReopenedRef.current = null;
    }
    try {
      await fetch(`/api/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      onStatusChange?.(conversationId!, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
      setLocalStatus(convStatus ?? 'abierto'); // revert on error
    }
  };

  const handleAssignmentChange = async (value: string) => {
    const agentId = value === '__unassigned__' ? null : value;
    const agentName = agentId ? (agents?.find((a) => a.id === agentId)?.displayName ?? null) : null;
    setLocalAssignedAgentId(agentId); // optimistic
    try {
      await fetch(`/api/conversations/${conversationId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      });
      onAssignmentChange?.(conversationId!, agentId, agentName);
    } catch (error) {
      console.error('Error updating assignment:', error);
      setLocalAssignedAgentId(assignedAgentId ?? null); // revert
    }
  };

  const handleLabelToggle = async (label: { id: string; name: string; color: string }, selected: boolean) => {
    const newLabels = selected
      ? [...localLabels, label]
      : localLabels.filter((l) => l.id !== label.id);
    setLocalLabels(newLabels); // optimistic

    try {
      if (selected) {
        await fetch(`/api/labels/contacts/${phoneNumber}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelId: label.id })
        });
      } else {
        await fetch(`/api/labels/contacts/${phoneNumber}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelId: label.id })
        });
      }
      onLabelsChange?.(conversationId!, newLabels);
    } catch (error) {
      console.error('Error toggling label:', error);
      setLocalLabels(contactLabels ?? []); // revert
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessageInput(value);
    if (value[0] === '/') {
      setShowCannedPicker(true);
      setCannedQuery(value.slice(1));
    } else {
      setShowCannedPicker(false);
      setCannedQuery('');
    }
  };

  const handleCannedSelect = (body: string) => {
    setMessageInput(body);
    setShowCannedPicker(false);
    setCannedQuery('');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!messageInput.trim() && !selectedFile) || !phoneNumber || sending) return;

    setShowCannedPicker(false);
    setCannedQuery('');
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('to', phoneNumber);
      if (messageInput.trim()) {
        formData.append('body', messageInput);
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await fetch('/api/messages/send', {
        method: 'POST',
        body: formData
      });

      onMessageSent?.();
      setMessageInput('');
      handleRemoveFile();
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSent = async () => {
    await fetchMessages();

    // Notify parent to refresh conversation list and select this conversation
    if (phoneNumber && onTemplateSent) {
      await onTemplateSent(phoneNumber);
    }
  };

  if (!conversationId) {
    return (
      <div className={cn(
        "flex-1 flex items-center justify-center bg-muted/50",
        !isVisible && "hidden md:flex"
      )}>
        <p className="text-muted-foreground">Select a conversation to view messages</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(
        "flex-1 flex flex-col bg-[#efeae2]",
        !isVisible && "hidden md:flex"
      )}>
        <div className="p-3 border-b border-[#d1d7db] bg-[#f0f2f5]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {onBack && (
                <Button
                  onClick={onBack}
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-[#667781] hover:bg-[#f0f2f5]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="flex-1">
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[900px] mx-auto space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={cn('flex mb-2', i % 2 === 0 ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[70%] rounded-lg px-3 py-2 shadow-sm',
                  i % 2 === 0 ? 'rounded-br-none' : 'rounded-bl-none'
                )}>
                  <Skeleton className="h-4 mb-2" style={{ width: `${Math.random() * 150 + 150}px` }} />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex-1 flex flex-col bg-[#efeae2]",
      !isVisible && "hidden md:flex"
    )}>
      <div className="p-3 border-b border-[#d1d7db] bg-[#f0f2f5]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {onBack && (
              <Button
                onClick={onBack}
                variant="ghost"
                size="icon"
                className="md:hidden text-[#667781] hover:bg-[#f0f2f5] flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-medium text-[#111b21] truncate">{contactName || phoneNumber || 'Conversation'}</h2>
              {contactName && phoneNumber && (
                <p className="text-xs text-[#667781] truncate">{phoneNumber}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {conversationId && (
              <Button
                onClick={() => onTogglePanel?.()}
                variant="ghost"
                size="icon"
                className={cn(
                  "text-[#667781] hover:bg-[#f0f2f5]",
                  isPanelOpen && "bg-[#e9f5e2] text-[#00a884]"
                )}
                title="Panel de contacto"
              >
                <UserRound className="h-4 w-4" />
              </Button>
            )}
            {conversationId && (
              <StatusSelect value={localStatus} onChange={handleStatusChange} />
            )}
            {conversationId && (
              <AssignmentSelect
                agents={agents ?? []}
                value={localAssignedAgentId}
                onChange={handleAssignmentChange}
              />
            )}
            {conversationId && (
              <div className="relative">
                <button
                  onClick={() => setShowLabelPicker(!showLabelPicker)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-[#d1d7db] bg-white hover:bg-[#f0f2f5] transition-colors"
                >
                  <Tag className="h-3 w-3" />
                  Etiquetas
                  {localLabels.length > 0 && (
                    <span className="bg-[#00a884] text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center">
                      {localLabels.length}
                    </span>
                  )}
                </button>
                {showLabelPicker && (
                  <LabelPicker
                    allLabels={allLabels ?? []}
                    selectedLabels={localLabels}
                    onToggle={handleLabelToggle}
                    onClose={() => setShowLabelPicker(false)}
                  />
                )}
              </div>
            )}
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="ghost"
              size="icon"
              className="text-[#667781] hover:bg-[#f0f2f5]"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {isHandoff && (
        <div className="bg-[#fff8e1] border-b border-[#f59e0b] px-4 py-2 flex items-center gap-2">
          <UserRound className="h-4 w-4 text-[#f59e0b] flex-shrink-0" />
          <span className="text-sm text-[#92400e]">
            This customer requested a human agent
          </span>
        </div>
      )}

      <ScrollArea ref={messagesContainerRef} className="flex-1 h-0 p-4">
        <div className="max-w-[900px] mx-auto">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground">No messages yet</p>
        ) : (
          messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showDateDivider = shouldShowDateDivider(message, prevMessage);

            return (
              <div key={message.id}>
                {showDateDivider && (
                  <div className="flex justify-center my-4">
                    <Badge variant="secondary" className="shadow-sm">
                      {formatDateDivider(message.createdAt)}
                    </Badge>
                  </div>
                )}

                <div
                  className={cn(
                    'flex mb-2',
                    message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[70%] rounded-lg px-3 py-2 relative shadow-sm',
                      message.direction === 'outbound'
                        ? 'bg-[#d9fdd3] text-[#111b21] rounded-br-none'
                        : 'bg-white text-[#111b21] rounded-bl-none'
                    )}
                  >
                    {message.hasMedia && message.mediaData?.url ? (
                      <div className="mb-2">
                        {message.messageType === 'sticker' ? (
                          <img
                            src={message.mediaData.url}
                            alt="Sticker"
                            loading="lazy"
                            className="max-w-[150px] max-h-[150px] h-auto"
                          />
                        ) : message.mediaData.contentType?.startsWith('image/') || message.messageType === 'image' ? (
                          <img
                            src={message.mediaData.url}
                            alt="Media"
                            loading="lazy"
                            className="rounded max-w-full h-auto max-h-96"
                          />
                        ) : message.mediaData.contentType?.startsWith('video/') || message.messageType === 'video' ? (
                          <video
                            src={message.mediaData.url}
                            controls
                            preload="none"
                            className="rounded max-w-full h-auto max-h-96"
                          />
                        ) : message.mediaData.contentType?.startsWith('audio/') || message.messageType === 'audio' ? (
                          <audio src={message.mediaData.url} controls className="w-full" />
                        ) : (
                          <a
                            href={message.mediaData.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'flex items-center gap-2 text-sm underline cursor-pointer hover:opacity-80',
                              message.direction === 'outbound' ? 'text-[#00a884]' : 'text-[#00a884]'
                            )}
                          >
                            📎 {message.mediaData.filename || message.filename || 'Download file'}
                          </a>
                        )}
                      </div>
                    ) : message.metadata?.mediaId && message.messageType ? (
                      <div className="mb-2">
                        <MediaMessage
                          mediaId={message.metadata.mediaId}
                          messageType={message.messageType}
                          caption={message.caption}
                          filename={message.filename}
                          isOutbound={message.direction === 'outbound'}
                        />
                      </div>
                    ) : null}

                    {message.caption && (
                      <p className="text-sm break-words whitespace-pre-wrap mb-1">
                        {message.caption}
                      </p>
                    )}

                    {message.content && message.content !== '[Image attached]' && (
                      <p className="text-sm break-words whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-[#667781]">
                        {formatMessageTime(message.createdAt)}
                      </span>

                      {message.messageType && (
                        <span className="text-[11px] text-[#667781] opacity-60">
                          · {message.messageType}
                        </span>
                      )}

                      {message.direction === 'outbound' && message.status && (
                        <>
                          {message.status === 'failed' ? (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <span className="text-xs text-[#53bdeb]">
                              {message.status === 'read' ? '✓✓' :
                               message.status === 'delivered' ? '✓✓' :
                               message.status === 'sent' ? '✓' : ''}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {message.direction === 'outbound' && message.status === 'failed' && (
                      <div className="mt-1">
                        <span className="text-[11px] text-red-500 flex items-center gap-1">
                          Not delivered
                        </span>
                      </div>
                    )}

                    {message.reactionEmoji && (
                      <div className="absolute -bottom-2 -right-2 bg-background rounded-full px-1.5 py-0.5 text-sm shadow-sm border">
                        {message.reactionEmoji}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-[#d1d7db] bg-[#f0f2f5]">
        {canSendRegularMessage ? (
          <>
            {selectedFile && (
              <div className="p-3 border-b border-[#d1d7db] bg-white">
                <div className="flex items-start gap-3">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-[#f0f2f5] rounded flex items-center justify-center">
                      <Paperclip className="h-6 w-6 text-[#667781]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111b21] truncate">{selectedFile.name}</p>
                    <p className="text-xs text-[#667781]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button
                    onClick={handleRemoveFile}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-[#667781]"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="relative">
              {showCannedPicker && (
                <CannedResponsesPicker
                  query={cannedQuery}
                  onSelect={handleCannedSelect}
                  onClose={() => { setShowCannedPicker(false); setCannedQuery(''); }}
                />
              )}
              <form onSubmit={handleSendMessage} className="p-3 max-w-[900px] mx-auto w-full flex gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  variant="ghost"
                  size="icon"
                  className="text-[#667781] hover:bg-[#d1d7db]/30"
                  title="Upload file"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowInteractiveDialog(true)}
                  disabled={sending}
                  size="icon"
                  variant="ghost"
                  className="text-[#667781] hover:text-[#00a884] hover:bg-[#f0f2f5]"
                  title="Send interactive message"
                >
                  <ListTree className="h-5 w-5" />
                </Button>
                <Input
                  type="text"
                  value={messageInput}
                  onChange={handleMessageInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && showCannedPicker) {
                      e.preventDefault();
                      setShowCannedPicker(false);
                      setCannedQuery('');
                    }
                  }}
                  placeholder="Type a message"
                  disabled={sending}
                  className="flex-1 bg-white border-[#d1d7db] focus-visible:ring-[#00a884] rounded-lg"
                />
                <Button
                  type="submit"
                  disabled={sending || (!messageInput.trim() && !selectedFile)}
                  size="icon"
                  className="bg-[#00a884] hover:bg-[#008f6f] rounded-full"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="p-3 max-w-[900px] mx-auto w-full">
            <div className="bg-[#fff4cc] border border-[#e9c46a] rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-[#8b7000] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#111b21] mb-3">
                    {getDisabledInputMessage(messages)}
                  </p>
                  <Button
                    onClick={() => setShowTemplateDialog(true)}
                    className="bg-[#00a884] hover:bg-[#008f6f]"
                    size="sm"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send template
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <TemplateSelectorDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        phoneNumber={phoneNumber || ''}
        onTemplateSent={handleTemplateSent}
      />

      <InteractiveMessageDialog
        open={showInteractiveDialog}
        onOpenChange={setShowInteractiveDialog}
        conversationId={conversationId}
        phoneNumber={phoneNumber}
        onMessageSent={fetchMessages}
      />
    </div>
  );
}
