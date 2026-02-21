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
      limit: 50,
      fields: buildKapsoFields(['contact_name'])
    });

    type HandoffInfo = { id: string; contactName?: string; phoneNumber?: string };
    type DebugConv = {
      id: string;
      phoneNumber?: string;
      messageCount: number;
      sampleContents: string[];
      rawSample: unknown[];
      hasHandoff: boolean;
    };

    const debugConvs: DebugConv[] = [];

    const results = await Promise.allSettled(
      convResponse.data.map(async (conv: ConversationRecord) => {
        const msgResponse = await whatsappClient.messages.listByConversation({
          phoneNumberId,
          conversationId: conv.id,
          limit: MESSAGES_TO_SCAN,
          fields: buildKapsoFields(['content', 'direction'])
        });

        const sampleContents: string[] = [];
        const rawSample: unknown[] = [];

        const hasHandoff = msgResponse.data.some((msg) => {
          const content = extractContent(msg);
          sampleContents.push(content.slice(0, 100));
          // Include raw shape of first 3 messages for debugging
          if (rawSample.length < 3) {
            const kapso = msg.kapso as KapsoMessageExtensions | undefined;
            const rawContent = kapso?.content;
            rawSample.push({
              type: msg.type,
              textBody: typeof msg.text?.body === 'string' ? msg.text.body.slice(0, 80) : null,
              kapsoContentType: typeof rawContent,
              kapsoContent: rawContent
                ? JSON.stringify(rawContent).slice(0, 120)
                : null,
            });
          }
          return content.includes(HANDOFF_MARKER);
        });

        debugConvs.push({
          id: conv.id,
          phoneNumber: conv.phoneNumber ?? undefined,
          messageCount: msgResponse.data.length,
          sampleContents,
          rawSample,
          hasHandoff,
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
      handoffs,
      debug: {
        totalConversations: convResponse.data.length,
        conversations: debugConvs,
      }
    });
  } catch (error) {
    console.error('Error checking handoffs:', error);
    return NextResponse.json(
      { handoffConversationIds: [] },
      { status: 500 }
    );
  }
}
