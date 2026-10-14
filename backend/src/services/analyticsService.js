// src/services/analyticsService.js
// Timeline analytics for the MD dashboard (read-only).
const analyticsRepository = require('../repositories/analyticsRepository');
const ApiError = require('../utils/ApiError');

const DAY_MS = 86400000;
const MAX_RANGE_DAYS = 1830; // ~5 years
const MAX_BUCKETS = 400;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

// ---- date helpers: all UTC on 'YYYY-MM-DD' strings (no timezone drift) ----
const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toYmd = (date) => date.toISOString().slice(0, 10);
const addDays = (date, n) => new Date(date.getTime() + n * DAY_MS);
const mondayOf = (date) => addDays(date, -((date.getUTCDay() + 6) % 7));
const firstOfMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const nextMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

function isValidYmd(s) {
  if (typeof s !== 'string' || !YMD.test(s)) return false;
  return toYmd(parseYmd(s)) === s; // rejects 2026-02-31 etc.
}

function resolveRange({ from, to }) {
  const today = toYmd(new Date());
  const toStr = to || today;
  const fromStr = from || toYmd(addDays(parseYmd(toStr), -89)); // default: last 90 days
  if (!isValidYmd(fromStr) || !isValidYmd(toStr)) {
    throw new ApiError(400, 'Dates must be valid and in YYYY-MM-DD format');
  }
  if (fromStr > toStr) throw new ApiError(400, 'From date cannot be after To date');
  const days = Math.round((parseYmd(toStr) - parseYmd(fromStr)) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) throw new ApiError(400, 'Date range cannot exceed 5 years');
  return { from: fromStr, to: toStr, days };
}

function pickGranularity(requested, days) {
  const auto = days <= 31 ? 'day' : days <= 140 ? 'week' : 'month';
  if (!['day', 'week', 'month'].includes(requested)) return auto;
  const buckets = requested === 'day' ? days : requested === 'week' ? Math.ceil(days / 7) + 1 : Math.ceil(days / 28) + 1;
  if (buckets > MAX_BUCKETS) return auto;
  return requested;
}

// Continuous list of bucket keys covering [from, to]
function buildBuckets(from, to, granularity) {
  const keys = [];
  const end = parseYmd(to);
  let cursor = parseYmd(from);
  if (granularity === 'week') cursor = mondayOf(cursor);
  if (granularity === 'month') cursor = firstOfMonth(cursor);
  while (cursor <= end) {
    keys.push(toYmd(cursor));
    cursor = granularity === 'day' ? addDays(cursor, 1) : granularity === 'week' ? addDays(cursor, 7) : nextMonth(cursor);
  }
  return keys;
}

const pctChange = (current, previous) => {
  if (!previous) return current ? null : 0; // null = no baseline to compare against
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

class AnalyticsService {
  async getOverview(query = {}) {
    const { from, to, days } = resolveRange(query);
    const granularity = pickGranularity(query.granularity, days);
    const toExclusive = toYmd(addDays(parseYmd(to), 1));

    // Previous period of equal length, for ▲/▼ comparison
    const prevFrom = toYmd(addDays(parseYmd(from), -days));

    const [
      claims, completed, prevClaims, prevCompleted,
      submittedRows, completedRows, statusRows,
      stages, vendors, projects, po, delivery, deliveryTimeline, activity, activeVendors,
    ] = await Promise.all([
      analyticsRepository.claimSummary(from, toExclusive),
      analyticsRepository.completedSummary(from, toExclusive),
      analyticsRepository.claimSummary(prevFrom, from),
      analyticsRepository.completedSummary(prevFrom, from),
      analyticsRepository.submittedSeries(from, toExclusive, granularity),
      analyticsRepository.completedSeries(from, toExclusive, granularity),
      analyticsRepository.statusBreakdown(from, toExclusive),
      analyticsRepository.pendingByStage(),
      analyticsRepository.topVendors(from, toExclusive, 5),
      analyticsRepository.topProjects(from, toExclusive, 5),
      analyticsRepository.poSummary(from, toExclusive),
      analyticsRepository.deliverySnapshot(),
      analyticsRepository.deliveryTimeline(10),
      analyticsRepository.recentActivity(from, toExclusive, 10),
      analyticsRepository.activeVendorCount(),
    ]);

    const subMap = new Map(submittedRows.map(r => [r.bucket, r]));
    const compMap = new Map(completedRows.map(r => [r.bucket, r]));
    const timeline = buildBuckets(from, to, granularity).map(key => ({
      bucket: key,
      submitted: subMap.get(key)?.count || 0,
      submitted_amount: subMap.get(key)?.amount || 0,
      completed: compMap.get(key)?.count || 0,
      completed_amount: compMap.get(key)?.amount || 0,
    }));

    return {
      range: { from, to, days, granularity, previous_from: prevFrom },
      kpis: {
        claims_submitted: claims.submitted,
        claimed_amount: claims.claimed_amount,
        claims_completed: completed.completed,
        completed_amount: completed.completed_amount,
        avg_processing_days: completed.avg_days,
        in_progress: claims.in_progress,
        sent_back: claims.sent_back,
        rejected: claims.rejected,
        pos_created: po.created,
        po_value: po.value,
        active_vendors: activeVendors,
        change: {
          claims_submitted: pctChange(claims.submitted, prevClaims.submitted),
          claimed_amount: pctChange(claims.claimed_amount, prevClaims.claimed_amount),
          claims_completed: pctChange(completed.completed, prevCompleted.completed),
          avg_processing_days:
            completed.avg_days !== null && prevCompleted.avg_days
              ? pctChange(completed.avg_days, prevCompleted.avg_days) : null,
        },
      },
      timeline,
      status_breakdown: statusRows,
      pending_by_stage: stages,
      top_vendors: vendors,
      top_projects: projects,
      delivery,
      delivery_timeline: deliveryTimeline,
      recent_activity: activity,
    };
  }
}

module.exports = new AnalyticsService();