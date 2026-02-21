import { NextResponse } from 'next/server';
import {
  buildKapsoFields,
  type ConversationKapsoExtensions,
  type ConversationRecord,
  type KapsoMessageExtensions,
  type MetaMessage
} from '@kapso/whatsapp-cloud-api';
import { getWhatsAppClient } from '@/lib/whatsapp-client';
import { getConfig } from '@/lib/get-config';

const HANDOFF_MARKER = 'handoff_to_human';
const MESSAGES_TO_SCAN = 10;

function extractContent(msg: MetaMessage): string {
  const kapso = msg.kapso as KapsoMessageExtensions | undefined;

  if (kapso?.content) {
    if (typeof kapso.content === 'string') return kapso.content;
    if (typeof kapso.content === 'object' && 'text' in kapso.content) {
      const text = (kapso.content as { text?: unknown }).text;
      if (typeof text === 'string') return text;
    }
  }

  if (typeof msg.text?.body === 'string') return msg.text.body;
  return '';
}

export async function GET() {
  try {
    const whatsappClient = await getWhatsAppClient();
    const phoneNumberId = await getConfig('PHONE_NUMBER_ID');

    const convResponse = await whatsappClient.conversations.list({
      phoneNumberId,
      status: 'active',
      limit: 50,
      fields: buildKapsoFields(['contact_name'])
    });

    type HandoffInfo = { id: string; contactName?: string; phoneNumber?: string };

    const results = await Promise.allSettled(
      convResponse.data.map(async (conv: ConversationRecord) => {
        const msgResponse = await whatsappClient.messages.listByConversation({
          phoneNumberId,
          conversationId: conv.id,
          limit: MESSAGES_TO_SCAN,
          fields: buildKapsoFields(['content', 'direction'])
        });

        const hasHandoff = msgResponse.data.some((msg) => {
          const content = extractContent(msg);
          return content.includes(HANDOFF_MARKER);
        });

        if (!hasHandoff) return null;

        const kapso = conv.kapso as ConversationKapsoExtensions | undefined;
        const info: HandoffInfo = {
          id: conv.id,
          contactName: typeof kapso?.contactName === 'string' ? kapso.contactName : undefined,
          phoneNumber: conv.phoneNumber ?? undefined
        };
        return info;
      })
    );

    const handoffs = results
      .filter(
        (r): r is PromiseFulfilledResult<HandoffInfo | null> =>
          r.status === 'fulfilled'
      )
      .map((r) => r.value)
      .filter((v): v is HandoffInfo => v !== null);

    return NextResponse.json({
      handoffConversationIds: handoffs.map((h) => h.id),
      handoffs
    });
  } catch (error) {
    console.error('Error checking handoffs:', error);
    return NextResponse.json(
      { handoffConversationIds: [] },
      { status: 500 }
    );
  }
}
