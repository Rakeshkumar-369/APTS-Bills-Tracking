// src/components/AnalyticsCharts.jsx
// Lightweight, dependency-free SVG/CSS charts for the MD dashboard.

// ---------- formatting helpers ----------
export const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Compact Indian format: 1.25 Cr / 4.5 L / 12,300
export function formatINRCompact(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
  return formatINR(v);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (ymd) => ymd.split('-').map(Number); // [y, m, d]

export function bucketLabel(ymd, granularity) {
  const [y, m, d] = parts(ymd);
  if (granularity === 'month') return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
  return `${d} ${MONTHS[m - 1]}`;
}

export function bucketTitle(ymd, granularity) {
  const [y, m, d] = parts(ymd);
  if (granularity === 'month') return `${MONTHS[m - 1]} ${y}`;
  if (granularity === 'week') return `Week of ${d} ${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function niceMax(value) {
  if (value <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

// ---------- Grouped bar chart over a timeline ----------
export function TimelineBarChart({ data, series, granularity, valueFormat = (v) => v, height = 260 }) {
  const W = 720;
  const H = height;
  const m = { top: 12, right: 8, bottom: 30, left: 54 };
  const innerW = W - m.left - m.right;
  const innerH = H - m.top - m.bottom;

  const maxVal = Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  if (data.length === 0 || maxVal === 0) {
    return <div className="text-center text-muted py-5 small">No activity in this period</div>;
  }

  const top = niceMax(maxVal);
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const groupW = innerW / data.length;
  const barW = Math.max(2, Math.min(22, (groupW * 0.8) / series.length));
  const labelEvery = Math.ceil(data.length / 10);
  const y = (v) => m.top + innerH - (v / top) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Timeline chart" style={{ display: 'block' }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke="#e9ecef" strokeWidth="1" />
          <text x={m.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6c757d">{valueFormat(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const gx = m.left + i * groupW + (groupW - barW * series.length) / 2;
        return (
          <g key={d.bucket}>
            {series.map((s, si) => {
              const v = d[s.key] || 0;
              const h = (v / top) * innerH;
              return <rect key={s.key} x={gx + si * barW} y={y(v)} width={barW - 1} height={h} rx="2" fill={s.color} />;
            })}
            <rect x={m.left + i * groupW} y={m.top} width={groupW} height={innerH} fill="transparent">
              <title>
                {bucketTitle(d.bucket, granularity)}
                {series.map((s) => `\n${s.label}: ${valueFormat(d[s.key] || 0, true)}`).join('')}
              </title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={m.left + i * groupW + groupW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#6c757d">
                {bucketLabel(d.bucket, granularity)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Donut ----------
export function Donut({ segments, centerValue, centerLabel, size = 190 }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Distribution chart">
      <circle cx="100" cy="100" r={r} fill="none" stroke="#e9ecef" strokeWidth="22" />
      {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={s.label}
            cx="100" cy="100" r={r} fill="none" stroke={s.color} strokeWidth="22"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
            transform="rotate(-90 100 100)"
          >
            <title>{`${s.label}: ${s.value}`}</title>
          </circle>
        );
        offset += len;
        return el;
      })}
      <text x="100" y="98" textAnchor="middle" fontSize="28" fontWeight="700" fill="#212529">{centerValue}</text>
      <text x="100" y="118" textAnchor="middle" fontSize="12" fill="#6c757d">{centerLabel}</text>
    </svg>
  );
}

// ---------- Horizontal bar list ----------
export function HBarList({ items, format = (v) => v, emptyText = 'No data in this period' }) {
  if (!items.length) return <div className="text-center text-muted py-4 small">{emptyText}</div>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="d-flex flex-column gap-3">
      {items.map((item) => (
        <div key={item.key || item.label}>
          <div className="d-flex justify-content-between align-items-baseline small mb-1">
            <span className="fw-semibold text-truncate me-2" title={item.label}>{item.label}</span>
            <span className="text-nowrap">
              <span className="fw-semibold">{format(item.value)}</span>
              {item.sub && <span className="text-muted ms-2">{item.sub}</span>}
            </span>
          </div>
          <div className="progress" style={{ height: 10 }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, backgroundColor: item.color || '#0d6efd' }}
              title={item.title}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Segmented bar with legend ----------
export function SegmentedBar({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div className="text-center text-muted py-4 small">No purchase orders yet</div>;
  return (
    <div>
      <div className="d-flex rounded overflow-hidden mb-3" style={{ height: 22 }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="row g-2">
        {segments.map((s) => (
          <div className="col-6" key={s.label}>
            <div className="d-flex align-items-center small">
              <span className="rounded-circle d-inline-block me-2" style={{ width: 10, height: 10, backgroundColor: s.color }} />
              <span className="text-muted me-1">{s.label}</span>
              <span className="fw-bold ms-auto">{s.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}