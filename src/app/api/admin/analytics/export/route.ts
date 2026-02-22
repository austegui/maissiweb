import { buildKapsoFields } from '@kapso/whatsapp-cloud-api';
import { getWhatsAppClientWithPhone } from '@/lib/whatsapp-client';
import { createClient } from '@/lib/supabase/server';

const MAX_PAGES = 20;

/** Wrap a string in double-quotes and escape internal double-quotes for CSV. */
const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';

export async function GET(request: Request) {
  try {
    // --- Auth guard ---
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Parse query params ---
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const statusFilter = searchParams.get('status'); // optional

    if (!from || !to) {
      return new Response(JSON.stringify({ error: 'Missing required params: from, to' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fromISO = `${from}T00:00:00Z`;
    const toISO = `${to}T23:59:59Z`;

    // --- Fetch Kapso conversations (paginated, 20-page safety cap) ---
    const { client: whatsappClient, phoneNumberId } = await getWhatsAppClientWithPhone();

    const rawConversations: Array<{
      id: string;
      phoneNumber: string;
      contactName: string;
      messagesCount: number;
      lastActiveAt: string | null;
    }> = [];

    let cursor: string | undefined = undefined;
    let page = 0;

    while (page < MAX_PAGES) {
      const response = await whatsappClient.conversations.list({
        phoneNumberId,
        lastActiveSince: fromISO,
        lastActiveUntil: toISO,
        limit: 100,
        ...(cursor ? { after: cursor } : {}),
        fields: buildKapsoFields([
          'contact_name',
          'messages_count',
          'last_inbound_at',
          'last_outbound_at'
        ])
      });

      for (const conv of response.data) {
        const kapso = conv.kapso;
        rawConversations.push({
          id: conv.id,
          phoneNumber: conv.phoneNumber ?? '',
          contactName: typeof kapso?.contactName === 'string' ? kapso.contactName : '',
          messagesCount: typeof kapso?.messagesCount === 'number' ? kapso.messagesCount : 0,
          lastActiveAt: typeof conv.lastActiveAt === 'string' ? conv.lastActiveAt : null,
        });
      }

      const nextCursor = response.paging?.cursors?.after;
      if (!nextCursor || response.data.length === 0) {
        break;
      }
      cursor = nextCursor;
      page++;
    }

    // --- Enrich with Supabase metadata (parallel) ---
    const conversationIds = rawConversations.map((c) => c.id);

    const [metaResult, profilesResult] = await Promise.all([
      conversationIds.length > 0
        ? supabase
            .from('conversation_metadata')
            .select('conversation_id, status, assigned_agent_id')
            .in('conversation_id', conversationIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('user_profiles').select('id, display_name'),
    ]);

    if (metaResult.error) {
      console.error('Error fetching conversation_metadata for export:', metaResult.error);
    }
    if (profilesResult.error) {
      console.error('Error fetching user_profiles for export:', profilesResult.error);
    }

    const metaMap = new Map<string, { status: string; assigned_agent_id: string | null }>(
      (metaResult.data ?? []).map((m) => [
        m.conversation_id,
        { status: m.status, assigned_agent_id: m.assigned_agent_id ?? null },
      ])
    );

    const agentNameMap = new Map<string, string>(
      (profilesResult.data ?? []).map((p) => [p.id, p.display_name ?? p.id])
    );

    // --- Enrich and optionally filter by status ---
    type EnrichedRow = {
      contactName: string;
      phoneNumber: string;
      status: string;
      agentName: string;
      messagesCount: number;
      lastActiveAt: string | null;
    };

    let enriched: EnrichedRow[] = rawConversations.map((c) => {
      const meta = metaMap.get(c.id);
      const status = meta?.status ?? 'abierto';
      const agentId = meta?.assigned_agent_id ?? null;
      const agentName = agentId ? (agentNameMap.get(agentId) ?? agentId) : '';
      return {
        contactName: c.contactName,
        phoneNumber: c.phoneNumber,
        status,
        agentName,
        messagesCount: c.messagesCount,
        lastActiveAt: c.lastActiveAt,
      };
    });

    if (statusFilter) {
      enriched = enriched.filter((r) => r.status === statusFilter);
    }

    // --- Build CSV ---
    const BOM = '\uFEFF';
    const header = 'Contact Name,Phone Number,Status,Assigned Agent,Message Count,Last Active';

    const rows = enriched.map((r) =>
      [
        esc(r.contactName),
        esc(r.phoneNumber),
        esc(r.status),
        esc(r.agentName),
        String(r.messagesCount),
        esc(r.lastActiveAt ?? ''),
      ].join(',')
    );

    const csv = BOM + [header, ...rows].join('\r\n');
    const filename = `conversaciones-${from}-${to}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Analytics export error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
