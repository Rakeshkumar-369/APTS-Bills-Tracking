// src/pages/MDDashboard.jsx
// Managing Director — timeline-based analytics dashboard (read-only).
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import analyticsService from '../services/analyticsService';
import {
  TimelineBarChart, Donut, HBarList, SegmentedBar,
  formatINR, formatINRCompact,
} from '../components/AnalyticsCharts';

// ---------- local-date helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(d.getDate() + 1); return d; };
const fyStart = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // Indian FY: 1 Apr – 31 Mar
  return new Date(year, 3, 1);
};

const PRESETS = [
  { key: '7d', label: '7 Days', range: () => [daysAgo(6), new Date()] },
  { key: '30d', label: '30 Days', range: () => [daysAgo(29), new Date()] },
  { key: '90d', label: '90 Days', range: () => [daysAgo(89), new Date()] },
  { key: '6m', label: '6 Months', range: () => [monthsAgo(6), new Date()] },
  { key: '12m', label: '12 Months', range: () => [monthsAgo(12), new Date()] },
  { key: 'fy', label: 'This FY', range: () => [fyStart(), new Date()] },
  { key: 'custom', label: 'Custom', range: null },
];

const GRANULARITIES = [
  { key: 'auto', label: 'Auto' },
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

const STATUS_META = {
  PENDING: { label: 'Pending', color: '#adb5bd' },
  IN_PROGRESS: { label: 'In progress', color: '#0d6efd' },
  SENT_BACK: { label: 'Sent back', color: '#ffc107' },
  COMPLETED: { label: 'Completed', color: '#198754' },
  REJECTED: { label: 'Rejected', color: '#dc3545' },
};

const ACTION_META = {
  CREATE: { label: 'Claim submitted', color: '#0d6efd' },
  FORWARD: { label: 'Forwarded', color: '#0dcaf0' },
  SENDBACK: { label: 'Sent back', color: '#ffc107' },
  COMPLETE: { label: 'Completed', color: '#198754' },
  REJECT: { label: 'Rejected', color: '#dc3545' },
  RESUBMIT: { label: 'Resubmitted', color: '#6f42c1' },
  PULL_BACK: { label: 'Pulled back', color: '#fd7e14' },
};

const formatDate = (ymd) => {
  if (!ymd) return '—';
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------- small presentational pieces ----------
function Delta({ value, invert = false }) {
  if (value === null || value === undefined) return <span className="text-muted small">no prior data</span>;
  if (value === 0) return <span className="text-muted small">no change</span>;
  const up = value > 0;
  const good = invert ? !up : up;
  return (
    <span className={`small fw-semibold ${good ? 'text-success' : 'text-danger'}`}>
      <i className={`bi ${up ? 'bi-arrow-up-short' : 'bi-arrow-down-short'}`}></i>
      {Math.abs(value)}%
      <span className="text-muted fw-normal ms-1">vs previous period</span>
    </span>
  );
}

function KpiCard({ icon, tone, label, value, title, children }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <span className="text-muted small text-uppercase fw-semibold">{label}</span>
          <span className={`rounded-3 d-inline-flex align-items-center justify-content-center bg-${tone} bg-opacity-10 text-${tone}`}
            style={{ width: 34, height: 34 }}>
            <i className={`bi ${icon}`}></i>
          </span>
        </div>
        <div className="fs-3 fw-bold lh-1 mb-2" title={title}>{value}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, right, children, className = '' }) {
  return (
    <div className={`card border-0 shadow-sm h-100 ${className}`}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
          <div>
            <h6 className="fw-bold mb-0">{title}</h6>
            {subtitle && <small className="text-muted">{subtitle}</small>}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

function DeliveryBadge({ daysLeft }) {
  if (daysLeft < 0) return <span className="badge bg-danger bg-opacity-10 text-danger">Overdue by {Math.abs(daysLeft)}d</span>;
  if (daysLeft === 0) return <span className="badge bg-warning bg-opacity-25 text-warning-emphasis">Due today</span>;
  if (daysLeft <= 7) return <span className="badge bg-warning bg-opacity-25 text-warning-emphasis">Due in {daysLeft}d</span>;
  return <span className="badge bg-primary bg-opacity-10 text-primary">On track · {daysLeft}d left</span>;
}

// ---------- page ----------
export default function MDDashboard() {
  const [preset, setPreset] = useState('90d');
  const [customFrom, setCustomFrom] = useState(toYmd(daysAgo(29)));
  const [customTo, setCustomTo] = useState(toYmd(new Date()));
  const [appliedCustom, setAppliedCustom] = useState(null); // { from, to }
  const [granularity, setGranularity] = useState('auto');
  const [metric, setMetric] = useState('count'); // 'count' | 'amount'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [tick, setTick] = useState(0); // bumping this re-evaluates "today" for preset ranges
  const requestId = useRef(0);

  const range = useMemo(() => {
    if (preset === 'custom') return appliedCustom;
    const p = PRESETS.find((x) => x.key === preset);
    const [from, to] = p.range();
    return { from: toYmd(from), to: toYmd(to) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, appliedCustom, tick]);

  const load = useCallback(async () => {
    if (!range) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await analyticsService.getOverview({ ...range, granularity });
      if (id !== requestId.current) return; // a newer request superseded this one
      setData(result);
      setUpdatedAt(new Date());
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err?.message || 'Failed to load analytics');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [range, granularity]);

  useEffect(() => { load(); }, [load]);

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    if (customFrom > customTo) { setError('From date cannot be after To date'); return; }
    setAppliedCustom({ from: customFrom, to: customTo });
    setPreset('custom');
  };

  const selectPreset = (key) => {
    setPreset(key);
    if (key === 'custom' && !appliedCustom) setAppliedCustom({ from: customFrom, to: customTo });
  };

  const k = data?.kpis;
  const statusSegments = (data?.status_breakdown || []).map((s) => ({
    label: STATUS_META[s.status]?.label || s.status,
    value: s.count,
    color: STATUS_META[s.status]?.color || '#6c757d',
  }));
  const statusTotal = statusSegments.reduce((s, x) => s + x.value, 0);

  const isAmount = metric === 'amount';
  const chartSeries = isAmount
    ? [
        { key: 'submitted_amount', label: 'Claimed', color: '#0d6efd' },
        { key: 'completed_amount', label: 'Completed', color: '#198754' },
      ]
    : [
        { key: 'submitted', label: 'Submitted', color: '#0d6efd' },
        { key: 'completed', label: 'Completed', color: '#198754' },
      ];
  const chartFormat = (v, full) => (isAmount ? (full ? formatINR(v) : formatINRCompact(v)) : Math.round(v));

  const d = data?.delivery;
  const deliverySegments = d ? [
    { label: 'On track', value: d.on_track, color: '#0d6efd' },
    { label: 'Due in 7 days', value: d.due_soon, color: '#ffc107' },
    { label: 'Overdue', value: d.overdue, color: '#dc3545' },
    { label: 'Delivered on time', value: d.delivered_on_time, color: '#198754' },
    { label: 'Delivered late', value: d.delivered_late, color: '#fd7e14' },
    { label: 'No timeline set', value: d.not_set, color: '#ced4da' },
  ] : [];

  const ageColor = (days) => (days < 3 ? '#198754' : days < 7 ? '#ffc107' : '#dc3545');

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-graph-up-arrow text-primary me-2"></i>Executive Dashboard
          </h4>
          <small className="text-muted">
            {range ? `${formatDate(range.from)} – ${formatDate(range.to)}` : ''}
            {data && ` · grouped by ${data.range.granularity}`}
            {updatedAt && ` · updated ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
          </small>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={() => setTick((t) => t + 1)} disabled={loading}>
          <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>Refresh
        </button>
      </div>

      {/* Timeline controls */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="btn-group btn-group-sm" role="group" aria-label="Time range">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`btn ${preset === p.key ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => selectPreset(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="d-flex align-items-center gap-2">
                <input type="date" className="form-control form-control-sm" value={customFrom}
                  max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
                <span className="text-muted small">to</span>
                <input type="date" className="form-control form-control-sm" value={customTo}
                  min={customFrom || undefined} max={toYmd(new Date())} onChange={(e) => setCustomTo(e.target.value)} />
                <button className="btn btn-sm btn-success" onClick={applyCustom}>Apply</button>
              </div>
            )}

            <div className="ms-auto d-flex align-items-center gap-2">
              <small className="text-muted">Group by</small>
              <div className="btn-group btn-group-sm" role="group" aria-label="Grouping">
                {GRANULARITIES.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    className={`btn ${granularity === g.key ? 'btn-dark' : 'btn-outline-dark'}`}
                    onClick={() => setGranularity(g.key)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span><i className="bi bi-exclamation-triangle-fill me-2"></i>{error}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={load}>Retry</button>
        </div>
      )}

      {!data && loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
          <p className="text-muted mt-3 mb-0">Loading analytics...</p>
        </div>
      )}

      {data && (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          {/* KPI cards */}
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-4 col-xl-2">
              <KpiCard icon="bi-file-earmark-text" tone="primary" label="Claims submitted" value={k.claims_submitted}>
                <Delta value={k.change.claims_submitted} />
              </KpiCard>
            </div>
            <div className="col-6 col-lg-4 col-xl-2">
              <KpiCard icon="bi-currency-rupee" tone="info" label="Amount claimed"
                value={formatINRCompact(k.claimed_amount)} title={formatINR(k.claimed_amount)}>
                <Delta value={k.change.claimed_amount} />
              </KpiCard>
            </div>
            <div className="col-6 col-lg-4 col-xl-2">
              <KpiCard icon="bi-check2-circle" tone="success" label="Claims completed" value={k.claims_completed}>
                <Delta value={k.change.claims_completed} />
              </KpiCard>
            </div>
            <div className="col-6 col-lg-4 col-xl-2">
              <KpiCard icon="bi-stopwatch" tone="warning" label="Avg processing time"
                value={k.avg_processing_days === null ? '—' : `${k.avg_processing_days} d`}>
                <Delta value={k.change.avg_processing_days} invert />
              </KpiCard>
            </div>
            <div className="col-6 col-lg-4 col-xl-2">
              <KpiCard icon="bi-hourglass-split" tone="secondary" label="In progress" value={k.in_progress}>
                <span className="small text-muted">{k.sent_back} sent back · {k.rejected} rejected</span>
              </KpiCard>
            </div>
            <div className="col-6 col-lg-4 col-xl-2">
              <KpiCard icon="bi-receipt" tone="dark" label="POs created" value={k.pos_created}>
                <span className="small text-muted" title={formatINR(k.po_value)}>
                  {formatINRCompact(k.po_value)} · {k.active_vendors} active vendors
                </span>
              </KpiCard>
            </div>
          </div>

          {/* Timeline + status */}
          <div className="row g-3 mb-3">
            <div className="col-lg-8">
              <Panel
                title="Claims timeline"
                subtitle={`Submitted vs completed, by ${data.range.granularity}`}
                right={
                  <div className="btn-group btn-group-sm">
                    <button className={`btn ${!isAmount ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMetric('count')}>Count</button>
                    <button className={`btn ${isAmount ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMetric('amount')}>Amount</button>
                  </div>
                }
              >
                <TimelineBarChart
                  data={data.timeline}
                  series={chartSeries}
                  granularity={data.range.granularity}
                  valueFormat={chartFormat}
                />
                <div className="d-flex gap-3 justify-content-center small mt-1">
                  {chartSeries.map((s) => (
                    <span key={s.key} className="d-flex align-items-center">
                      <span className="d-inline-block rounded me-1" style={{ width: 10, height: 10, backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="col-lg-4">
              <Panel title="Claim status" subtitle="Claims submitted in this period">
                <div className="d-flex flex-column align-items-center">
                  <Donut segments={statusSegments} centerValue={statusTotal} centerLabel="claims" />
                  <div className="w-100 mt-3">
                    {statusSegments.length === 0 && <div className="text-center text-muted small">No claims in this period</div>}
                    {statusSegments.map((s) => (
                      <div key={s.label} className="d-flex align-items-center small mb-1">
                        <span className="rounded-circle d-inline-block me-2" style={{ width: 10, height: 10, backgroundColor: s.color }} />
                        <span>{s.label}</span>
                        <span className="ms-auto fw-bold">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </div>
          </div>

          {/* Bottlenecks + delivery health */}
          <div className="row g-3 mb-3">
            <div className="col-lg-6">
              <Panel title="Where claims are waiting" subtitle="Open claims right now · bar colour shows average days since last action">
                <HBarList
                  emptyText="No open claims"
                  items={data.pending_by_stage.map((s) => ({
                    key: s.stage,
                    label: s.stage,
                    value: s.count,
                    sub: `avg ${s.avg_days}d · ${formatINRCompact(s.amount)}`,
                    color: ageColor(s.avg_days),
                    title: `${s.count} claims · ${formatINR(s.amount)}`,
                  }))}
                />
                <div className="d-flex gap-3 small text-muted mt-3">
                  <span><span className="d-inline-block rounded me-1" style={{ width: 10, height: 10, background: '#198754' }} />under 3 days</span>
                  <span><span className="d-inline-block rounded me-1" style={{ width: 10, height: 10, background: '#ffc107' }} />3–7 days</span>
                  <span><span className="d-inline-block rounded me-1" style={{ width: 10, height: 10, background: '#dc3545' }} />over 7 days</span>
                </div>
              </Panel>
            </div>
            <div className="col-lg-6">
              <Panel title="Delivery health" subtitle="All live purchase orders, as of today">
                <SegmentedBar segments={deliverySegments} />
              </Panel>
            </div>
          </div>

          {/* Delivery timeline table */}
          <div className="row g-3 mb-3">
            <div className="col-12">
              <Panel title="Delivery timeline" subtitle="Undelivered purchase orders by deadline · overdue first">
                {data.delivery_timeline.length === 0 ? (
                  <div className="text-center text-muted py-4 small">No pending deliveries with a deadline</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr className="small text-muted text-uppercase">
                          <th>PO</th>
                          <th>Project</th>
                          <th>Vendor(s)</th>
                          <th>Window</th>
                          <th>Status</th>
                          <th>Vendor delivery</th>
                          <th>Installation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.delivery_timeline.map((po) => (
                          <tr key={po.id}>
                            <td className="fw-semibold text-nowrap">{po.po_number}</td>
                            <td>{po.project_name}</td>
                            <td>{po.vendor_names || '—'}</td>
                            <td className="text-nowrap small">
                              {formatDate(po.delivery_start_date)} → <strong>{formatDate(po.delivery_end_date)}</strong>
                            </td>
                            <td><DeliveryBadge daysLeft={po.days_left} /></td>
                            <td className="text-nowrap small">{formatDate(po.vendor_delivery_date)}</td>
                            <td className="text-nowrap small">{formatDate(po.installation_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          </div>

          {/* Top vendors / projects */}
          <div className="row g-3 mb-3">
            <div className="col-lg-6">
              <Panel title="Top vendors" subtitle="By amount claimed in this period">
                <HBarList
                  format={formatINRCompact}
                  items={data.top_vendors.map((v) => ({
                    key: v.id, label: v.name, value: v.amount,
                    sub: `${v.claims} claims · ${v.completed} done`, title: formatINR(v.amount),
                  }))}
                />
              </Panel>
            </div>
            <div className="col-lg-6">
              <Panel title="Top projects" subtitle="By amount claimed in this period">
                <HBarList
                  format={formatINRCompact}
                  items={data.top_projects.map((p) => ({
                    key: p.id, label: p.name, value: p.amount, color: '#6f42c1',
                    sub: `${p.claims} claims · ${p.completed} done`, title: formatINR(p.amount),
                  }))}
                />
              </Panel>
            </div>
          </div>

          {/* Recent activity */}
          <div className="row g-3">
            <div className="col-12">
              <Panel title="Recent activity" subtitle="Latest claim actions in this period">
                {data.recent_activity.length === 0 ? (
                  <div className="text-center text-muted py-4 small">No activity in this period</div>
                ) : (
                  <ul className="list-unstyled mb-0 position-relative" style={{ paddingLeft: 22 }}>
                    <span className="position-absolute" style={{ left: 6, top: 6, bottom: 6, width: 2, background: '#e9ecef' }} />
                    {data.recent_activity.map((a) => {
                      const meta = ACTION_META[a.action] || { label: a.action, color: '#6c757d' };
                      return (
                        <li key={a.id} className="position-relative mb-3">
                          <span className="position-absolute rounded-circle border border-2 border-white"
                            style={{ left: -22, top: 3, width: 14, height: 14, backgroundColor: meta.color }} />
                          <div className="d-flex justify-content-between flex-wrap">
                            <span>
                              <span className="fw-semibold">{a.action_label || meta.label}</span>
                              <span className="text-muted"> · {a.claim_code} · {a.vendor_name}</span>
                            </span>
                            <small className="text-muted" title={new Date(a.created_at).toLocaleString('en-IN')}>
                              {a.performed_by_name} · {timeAgo(a.created_at)}
                            </small>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}

      <style>{`.spin{display:inline-block;animation:md-spin 1s linear infinite}@keyframes md-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}