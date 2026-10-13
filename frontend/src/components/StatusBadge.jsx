// src/components/StatusBadge.jsx
const STATUS = {
  PENDING: { cls: 'text-bg-warning', label: 'Pending' },
  IN_PROGRESS: { cls: 'text-bg-info', label: 'In Progress' },
  SENT_BACK: { cls: 'text-bg-danger', label: 'Returned to Vendor' },
  COMPLETED: { cls: 'text-bg-success', label: 'Completed' },
  REJECTED: { cls: 'text-bg-danger', label: 'Rejected' },
  ACTIVE: { cls: 'text-bg-success', label: 'Active' },
  CLOSED: { cls: 'text-bg-secondary', label: 'Closed' },
  CANCELLED: { cls: 'text-bg-dark', label: 'Cancelled' },
};

export default function StatusBadge({ status }) {
  const key = String(status || '').toUpperCase();
  const s = STATUS[key] || { cls: 'text-bg-secondary', label: status || 'Unknown' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
