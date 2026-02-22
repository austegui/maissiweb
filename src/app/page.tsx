'use client';

import { useState, useRef, useEffect } from 'react';
import { ConversationList, type ConversationListRef } from '@/components/conversation-list';
import { MessageView } from '@/components/message-view';
import { ContactPanel } from '@/components/contact-panel';
import { ErrorBoundary } from '@/components/error-boundary';
import { useHandoffAlerts } from '@/hooks/use-handoff-alerts';
import { useMessageAlerts } from '@/hooks/use-message-alerts';
import { NotificationToggle } from '@/components/notification-toggle';
import { logout } from '@/app/login/actions';

type Conversation = {
  id: string;
  phoneNumber: string;
  contactName?: string;
  convStatus?: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  labels?: { id: string; name: string; color: string }[];
  lastActiveAt?: string;
};

export default function Home() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation>();
  const [statusFilter, setStatusFilter] = useState('abierto');
  const [assignmentFilter, setAssignmentFilter] = useState('todos');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [agents, setAgents] = useState<{ id: string; displayName: string }[]>([]);
  const [allLabels, setAllLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const conversationListRef = useRef<ConversationListRef>(null);
  const { alertingIds, allHandoffIds, acknowledge, onConversationsUpdated } = useHandoffAlerts();
  const { onConversationsUpdated: onMessageAlert, markSentMessage } = useMessageAlerts({
    notificationsEnabled,
    currentUserId,
  });

  // Fetch notification preference on mount
  useEffect(() => {
    fetch('/api/user/preferences')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.notifications_enabled === 'boolean') {
          setNotificationsEnabled(data.notifications_enabled);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch all labels once on mount for the label filter dropdown
  useEffect(() => {
    fetch('/api/labels')
      .then((r) => r.json())
      .then((data) => setAllLabels(data.data ?? []))
      .catch(console.error);
  }, []);

  const handleNotificationToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications_enabled: value }),
    }).catch((err) => {
      console.error('Failed to save notification preference:', err);
      // Revert on error
      setNotificationsEnabled(!value);
    });
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    acknowledge(conversation.id);
  };

  const handleConversationsLoaded = (convs: Conversation[], meta?: { agents: { id: string; displayName: string }[]; currentUserId: string | null }) => {
    onConversationsUpdated(convs);
    onMessageAlert(convs);
    setConversations(convs);
    if (meta?.agents) setAgents(meta.agents);
    if (meta?.currentUserId) setCurrentUserId(meta.currentUserId);
  };

  const handleTemplateSent = async (phoneNumber: string) => {
    // Refresh the conversation list and get the updated conversations
    const conversations = await conversationListRef.current?.refresh();

    // Find and select the conversation for the phone number
    if (conversations) {
      const conversation = conversations.find(conv => conv.phoneNumber === phoneNumber);
      if (conversation) {
        setSelectedConversation(conversation);
      }
    }
  };

  const handleBackToList = () => {
    setSelectedConversation(undefined);
  };

  const handleStatusChange = (convId: string, newStatus: string) => {
    if (selectedConversation?.id === convId) {
      setSelectedConversation(prev => prev ? { ...prev, convStatus: newStatus } : prev);
    }
  };

  const handleAssignmentChange = (convId: string, agentId: string | null, agentName: string | null) => {
    if (selectedConversation?.id === convId) {
      setSelectedConversation(prev => prev ? { ...prev, assignedAgentId: agentId, assignedAgentName: agentName } : prev);
    }
  };

  const handleLabelsChange = (convId: string, labels: { id: string; name: string; color: string }[]) => {
    if (selectedConversation?.id === convId) {
      setSelectedConversation(prev => prev ? { ...prev, labels } : prev);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <img src="/maissi-logo.svg" alt="Maissi" className="h-6" />
          <span className="text-sm font-medium">Maissi Beauty Shop AI</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin/labels" className="text-xs text-gray-500 hover:text-gray-700">
            Etiquetas
          </a>
          <a href="/admin/canned-responses" className="text-xs text-gray-500 hover:text-gray-700">
            Canned Responses
          </a>
          <a href="/admin/settings" className="text-xs text-gray-500 hover:text-gray-700">
            Settings
          </a>
          <NotificationToggle
            enabled={notificationsEnabled}
            onToggle={handleNotificationToggle}
          />
          <form action={logout}>
            <button type="submit" className="text-xs text-gray-500 hover:text-gray-700">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <ErrorBoundary>
      <div className="flex flex-1 overflow-hidden">
      <ConversationList
        ref={conversationListRef}
        onSelectConversation={handleSelectConversation}
        selectedConversationId={selectedConversation?.id}
        isHidden={!!selectedConversation}
        handoffIds={alertingIds}
        onConversationsLoaded={handleConversationsLoaded}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        assignmentFilter={assignmentFilter}
        onAssignmentFilterChange={setAssignmentFilter}
        labelFilter={labelFilter}
        onLabelFilterChange={setLabelFilter}
        currentUserId={currentUserId}
        allLabels={allLabels}
      />
      <MessageView
        conversationId={selectedConversation?.id}
        phoneNumber={selectedConversation?.phoneNumber}
        contactName={selectedConversation?.contactName}
        convStatus={selectedConversation?.convStatus}
        onTemplateSent={handleTemplateSent}
        onBack={handleBackToList}
        isVisible={!!selectedConversation}
        isHandoff={selectedConversation ? allHandoffIds.has(selectedConversation.id) : false}
        onStatusChange={handleStatusChange}
        agents={agents}
        assignedAgentId={selectedConversation?.assignedAgentId}
        onAssignmentChange={handleAssignmentChange}
        allLabels={allLabels}
        contactLabels={selectedConversation?.labels}
        onLabelsChange={handleLabelsChange}
        onTogglePanel={() => setShowContactPanel(p => !p)}
        isPanelOpen={showContactPanel}
        onMessageSent={markSentMessage}
      />
      {showContactPanel && selectedConversation && (
        <ContactPanel
          key={selectedConversation.id}
          conversationId={selectedConversation.id}
          phoneNumber={selectedConversation.phoneNumber}
          contactName={selectedConversation.contactName}
          onClose={() => setShowContactPanel(false)}
          conversationHistory={conversations.filter(c => c.phoneNumber === selectedConversation.phoneNumber)}
        />
      )}
      </div>
      </ErrorBoundary>
    </div>
  );
}
