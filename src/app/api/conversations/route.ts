import { NextResponse } from 'next/server';
import {
  buildKapsoFields,
  type ConversationKapsoExtensions,
  type ConversationRecord
} from '@kapso/whatsapp-cloud-api';
import { getWhatsAppClientWithPhone } from '@/lib/whatsapp-client';
import { createClient } from '@/lib/supabase/server';

function parseDirection(kapso?: ConversationKapsoExtensions): 'inbound' | 'outbound' {
  if (!kapso) {
    return 'inbound';
  }

  const inboundAt = typeof kapso.lastInboundAt === 'string' ? Date.parse(kapso.lastInboundAt) : Number.NaN;
  const outboundAt = typeof kapso.lastOutboundAt === 'string' ? Date.parse(kapso.lastOutboundAt) : Number.NaN;

  if (Number.isFinite(inboundAt) && Number.isFinite(outboundAt)) {
    return inboundAt >= outboundAt ? 'inbound' : 'outbound';
  }

  if (Number.isFinite(inboundAt)) return 'inbound';
  if (Number.isFinite(outboundAt)) return 'outbound';
  return 'inbound';
}

export async function GET(request: Request) {
  try {
    const { client: whatsappClient, phoneNumberId } = await getWhatsAppClientWithPhone();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;

    const response = await whatsappClient.conversations.list({
      phoneNumberId,
      ...(status && { status: status as 'active' | 'ended' }),
      limit,
      fields: buildKapsoFields([
        'contact_name',
        'messages_count',
        'last_message_type',
        'last_message_text',
        'last_inbound_at',
        'last_outbound_at'
      ])
    });

    // Transform conversations to match frontend expectations
    const transformedData = response.data.map((conversation: ConversationRecord) => {
      const kapso = conversation.kapso;

      const lastMessageText = typeof kapso?.lastMessageText === 'string' ? kapso.lastMessageText : undefined;
      const lastMessageType = typeof kapso?.lastMessageType === 'string' ? kapso.lastMessageType : undefined;

      return {
        id: conversation.id,
        phoneNumber: conversation.phoneNumber ?? '',
        status: conversation.status ?? 'unknown',
        lastActiveAt: typeof conversation.lastActiveAt === 'string' ? conversation.lastActiveAt : undefined,
        phoneNumberId: conversation.phoneNumberId ?? phoneNumberId,
        metadata: conversation.metadata ?? {},
        contactName: typeof kapso?.contactName === 'string' ? kapso.contactName : undefined,
        messagesCount: typeof kapso?.messagesCount === 'number' ? kapso.messagesCount : undefined,
        lastMessage: lastMessageText
          ? {
              content: lastMessageText,
              direction: parseDirection(kapso),
              type: lastMessageType
            }
          : undefined
      };
    });

    // Enrich with Supabase metadata (status, assignment, labels)
    // Wrapped in try/catch so conversations still return even if Supabase is unreachable
    try {
      const supabase = await createClient();

      const conversationIds = transformedData.map((c) => c.id);
      const phoneNumbers = transformedData.map((c) => c.phoneNumber).filter(Boolean);

      // Parallel fetch: metadata + agent profiles + contact labels
      const [metaResult, agentsResult, labelsResult] = await Promise.all([
        supabase
          .from('conversation_metadata')
          .select('conversation_id, status, assigned_agent_id')
          .in('conversation_id', conversationIds),
        supabase
          .from('user_profiles')
          .select('id, display_name'),
        supabase
          .from('conversation_contact_labels')
          .select('phone_number, label_id, contact_labels(id, name, color)')
          .in('phone_number', phoneNumbers)
      ]);

      if (metaResult.error) {
        console.error('Error fetching conversation_metadata:', metaResult.error);
      }
      if (agentsResult.error) {
        console.error('Error fetching user_profiles:', agentsResult.error);
      }
      if (labelsResult.error) {
        console.error('Error fetching conversation_contact_labels:', labelsResult.error);
      }

      // Build lookup maps
      const metaMap = new Map(
        (metaResult.data ?? []).map((m) => [m.conversation_id, m])
      );
      const agentMap = new Map(
        (agentsResult.data ?? []).map((a) => [a.id, a.display_name])
      );

      // Build labels map: phone_number -> array of label objects
      const labelsMap = new Map<string, Array<{ id: string; name: string; color: string }>>();
      for (const row of labelsResult.data ?? []) {
        const existing = labelsMap.get(row.phone_number) ?? [];
        const labelDetail = Array.isArray(row.contact_labels)
          ? row.contact_labels[0]
          : row.contact_labels;
        if (labelDetail && labelDetail.id) {
          existing.push({
            id: labelDetail.id,
            name: labelDetail.name,
            color: labelDetail.color
          });
        }
        labelsMap.set(row.phone_number, existing);
      }

      // Merge enrichment into each conversation
      const enrichedData = transformedData.map((c) => {
        const meta = metaMap.get(c.id);
        return {
          ...c,
          convStatus: meta?.status ?? 'abierto',
          assignedAgentId: meta?.assigned_agent_id ?? null,
          assignedAgentName: meta?.assigned_agent_id
            ? (agentMap.get(meta.assigned_agent_id) ?? null)
            : null,
          labels: labelsMap.get(c.phoneNumber) ?? []
        };
      });

      return NextResponse.json({
        data: enrichedData,
        paging: response.paging
      });
    } catch (supabaseError) {
      console.error('Supabase enrichment failed, returning unenriched conversations:', supabaseError);
      // Return conversations without enrichment rather than failing the entire request
      return NextResponse.json({
        data: transformedData,
        paging: response.paging
      });
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
