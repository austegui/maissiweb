'use client';

import { useState, useRef } from 'react';
import { ConversationList, type ConversationListRef } from '@/components/conversation-list';
import { MessageView } from '@/components/message-view';
import { logout } from '@/app/login/actions';

type Conversation = {
  id: string;
  phoneNumber: string;
  contactName?: string;
};

export default function Home() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation>();
  const conversationListRef = useRef<ConversationListRef>(null);

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
      <div className="flex flex-1 overflow-hidden">
      <ConversationList
        ref={conversationListRef}
        onSelectConversation={setSelectedConversation}
        selectedConversationId={selectedConversation?.id}
        isHidden={!!selectedConversation}
      />
      <MessageView
        conversationId={selectedConversation?.id}
        phoneNumber={selectedConversation?.phoneNumber}
        contactName={selectedConversation?.contactName}
        onTemplateSent={handleTemplateSent}
        onBack={handleBackToList}
        isVisible={!!selectedConversation}
      />
      </div>
    </div>
  );
}
