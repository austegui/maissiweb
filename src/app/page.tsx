'use client';

import { useState, useRef } from 'react';
import { ConversationList, type ConversationListRef } from '@/components/conversation-list';
import { MessageView } from '@/components/message-view';
import { ErrorBoundary } from '@/components/error-boundary';
import { useHandoffAlerts } from '@/hooks/use-handoff-alerts';
import { logout } from '@/app/login/actions';

type Conversation = {
  id: string;
  phoneNumber: string;
  contactName?: string;
};

export default function Home() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation>();
  const conversationListRef = useRef<ConversationListRef>(null);
  const { alertingIds, allHandoffIds, acknowledge, onConversationsUpdated } = useHandoffAlerts();

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    acknowledge(conversation.id);
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

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">WhatsApp Inbox</span>
        <div className="flex items-center gap-3">
          <a href="/admin/settings" className="text-xs text-gray-500 hover:text-gray-700">
            Settings
          </a>
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
        onConversationsLoaded={onConversationsUpdated}
      />
      <MessageView
        conversationId={selectedConversation?.id}
        phoneNumber={selectedConversation?.phoneNumber}
        contactName={selectedConversation?.contactName}
        onTemplateSent={handleTemplateSent}
        onBack={handleBackToList}
        isVisible={!!selectedConversation}
        isHandoff={selectedConversation ? allHandoffIds.has(selectedConversation.id) : false}
      />
      </div>
      </ErrorBoundary>
    </div>
  );
}
