# Phase 12: Analytics + Export - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin-only operational dashboard showing team performance metrics and charts, plus CSV export of conversation data filtered by date range and status. This phase delivers visibility into message volume, response times, and per-agent performance. Search, alerts, and user management are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- Single scrollable page — all metrics visible without tab switching
- Top section: 3 KPI summary cards (Total Messages, Avg Response Time, Conversations Resolved)
- Middle section: Message volume chart (daily/weekly)
- Below chart: Per-agent breakdown as horizontal bar chart + sortable data table
- Bottom section: CSV export with filters and download button

### Date range selector
- Single date range picker at the top of the page
- Affects all sections: KPI cards, volume chart, agent breakdown
- All data on the page reflects the chosen period

### Per-agent breakdown
- Horizontal bar chart for quick visual comparison between agents
- Sortable table below with exact numbers (messages handled, avg response time, resolved count)

### Claude's Discretion
- Chart library choice (recharts, chart.js, etc.)
- Exact card styling and spacing
- Date picker component (custom vs preset buttons vs calendar)
- Chart color palette
- Table sorting implementation
- CSV file naming convention
- Export filter UI design
- How "response time" is calculated from available data

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-analytics-export*
*Context gathered: 2026-02-22*
