import { NextResponse } from 'next/server';
import { buildKapsoFields } from '@kapso/whatsapp-cloud-api';
import { getWhatsAppClientWithPhone } from '@/lib/whatsapp-client';
import { createClient } from '@/lib/supabase/server';

const MAX_PAGES = 20;

export async function GET(request: Request) {
  try {
    // --- Auth guard ---
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // --- Parse query params ---
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from'); // e.g. "2026-01-01"
    const to = searchParams.get('to');     // e.g. "2026-01-31"

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing required params: from, to' }, { status: 400 });
    }

    const fromISO = `${from}T00:00:00Z`;
    const toISO = `${to}T23:59:59Z`;

    // --- Fetch Kapso conversations (paginated, 20-page safety cap) ---
    const { client: whatsappClient, phoneNumberId } = await getWhatsAppClientWithPhone();

    const allConversations: Array<{
      messagesCount: number;
      lastInboundAt: string | null;
      lastOutboundAt: string | null;
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
        allConversations.push({
          messagesCount: typeof kapso?.messagesCount === 'number' ? kapso.messagesCount : 0,
          lastInboundAt: typeof kapso?.lastInboundAt === 'string' ? kapso.lastInboundAt : null,
          lastOutboundAt: typeof kapso?.lastOutboundAt === 'string' ? kapso.lastOutboundAt : null,
        });
      }

      const nextCursor = response.paging?.cursors?.after;
      if (!nextCursor || response.data.length === 0) {
        break;
      }
      cursor = nextCursor;
      page++;
    }

    // --- Parallel Supabase RPC calls ---
    const [volumeResult, agentStatsResult, profilesResult] = await Promise.all([
      supabase.rpc('get_conversation_volume_by_day', { from_date: fromISO, to_date: toISO }),
      supabase.rpc('get_agent_stats', { from_date: fromISO, to_date: toISO }),
      supabase.from('user_profiles').select('id, display_name'),
    ]);

    if (volumeResult.error) {
      console.error('Error calling get_conversation_volume_by_day:', volumeResult.error);
    }
    if (agentStatsResult.error) {
      console.error('Error calling get_agent_stats:', agentStatsResult.error);
    }
    if (profilesResult.error) {
      console.error('Error fetching user_profiles:', profilesResult.error);
    }

    // --- Compute KPIs ---
    const totalMessages = allConversations.reduce((sum, c) => sum + c.messagesCount, 0);
    const totalConversations = allConversations.length;

    // avgReplyTime: difference between lastOutboundAt and lastInboundAt (when outbound > inbound)
    const replyDeltas: number[] = [];
    for (const c of allConversations) {
      if (c.lastInboundAt && c.lastOutboundAt) {
        const inboundMs = Date.parse(c.lastInboundAt);
        const outboundMs = Date.parse(c.lastOutboundAt);
        if (Number.isFinite(inboundMs) && Number.isFinite(outboundMs) && outboundMs > inboundMs) {
          replyDeltas.push(outboundMs - inboundMs);
        }
      }
    }
    const avgReplyTimeMinutes =
      replyDeltas.length > 0
        ? replyDeltas.reduce((sum, d) => sum + d, 0) / replyDeltas.length / 60_000
        : null;

    // resolvedCount: sum of resolved_count from agent_stats
    const agentStats: Array<{ agent_id: string; resolved_count: number; total_count: number }> =
      agentStatsResult.data ?? [];
    const resolvedCount = agentStats.reduce((sum, a) => sum + Number(a.resolved_count ?? 0), 0);

    // --- Build agent name map ---
    const agentNameMap = new Map<string, string>(
      (profilesResult.data ?? []).map((p) => [p.id, p.display_name ?? p.id])
    );

    // --- Shape response ---
    const volumeByDay: Array<{ day: string; count: number }> = (volumeResult.data ?? []).map(
      (row: { day: string; conversation_count: number }) => ({
        day: String(row.day),
        count: Number(row.conversation_count ?? 0),
      })
    );

    const agentBreakdown = agentStats.map((a) => ({
      agentId: a.agent_id,
      agentName: agentNameMap.get(a.agent_id) ?? a.agent_id,
      resolvedCount: Number(a.resolved_count ?? 0),
      totalCount: Number(a.total_count ?? 0),
    }));

    return NextResponse.json({
      kpis: {
        totalMessages,
        totalConversations,
        avgReplyTimeMinutes,
        resolvedCount,
      },
      volumeByDay,
      agentBreakdown,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
