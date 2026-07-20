import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import SubmissionAudit from './SubmissionAudit';
import PdfViewerPage from './PdfViewerPage';

export default function OfficerDashboard({ currentTab }) {
  const { user, submissions, processWorkflowMovement, calculateDaysElapsed } = useApp();
  const [activeAuditSub, setActiveAuditSub] = useState(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [successToast, setSuccessToast] = useState('');
  // 'list' -> inbox table, 'timeline' -> HistoryTimeline, 'pdf' -> full-page viewer
  const [viewMode, setViewMode] = useState('list');

  if (!user) return null;

  // Filter incoming items targeting this officer title slot ("Workflow Inbox")
  const inboxSubmissions = submissions.filter(sub => sub.currentStage === user.title);

  // Track packages already pushed onward out of this desk ("Workflow Outbox")
  const outboxSubmissions = submissions.filter(sub =>
    sub.currentStage !== user.title &&
    sub.history.some(log => log.actor.includes(user.name))
  );

  const openAudit = (sub) => {
    setActiveAuditSub(sub);
    setActionRemarks('');
    setViewMode('timeline');
  };

  const closeAudit = () => {
    setActiveAuditSub(null);
    setViewMode('list');
  };

  const openPdf = () => setViewMode('pdf');
  const backToTimeline = () => setViewMode('timeline');

  const executeStageMovement = (actionType) => {
    if (!activeAuditSub) return;

    processWorkflowMovement(activeAuditSub.id, actionRemarks || 'Approved and processed.', actionType);

    const feedbackLabel = actionType === 'FORWARD' ? 'Forwarded successfully' : 'Returned back with remarks';
    setSuccessToast(`Package tracking node ${activeAuditSub.id} has been ${feedbackLabel}.`);

    closeAudit();
    setActionRemarks('');

    setTimeout(() => setSuccessToast(''), 4000);
  };

  // 100% Full View Screen Render block for Outbox (Moved Files)
  if (currentTab === 'outbox') {
    return (
      <div className="container-fluid py-4 animate-fade-in">
        <div className="d-flex flex-column mb-4">
          <h3 className="mb-0 fw-extrabold text-dark tracking-tight">Workflow Outbox</h3>
          <p className="text-muted fs-7">Logs of transmission packages processed and forwarded from your desk layer</p>
        </div>

        {outboxSubmissions.length === 0 ? (
          <div className="text-center bg-white border rounded-4 p-5 shadow-xs">
            <i className="bi bi-send-x text-muted display-4 d-block mb-3 opacity-50"></i>
            <h5 className="text-dark fw-bold">Outbox index empty</h5>
            <p className="text-muted fs-7">Packages you clear or return will populate dynamic tracing matrices here.</p>
          </div>
        ) : (
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
            <div className="table-responsive">
              <table className="table align-middle mb-0 text-nowrap">
                <thead className="bg-light bg-opacity-70 border-bottom text-uppercase font-monospace fs-8 text-secondary fw-bold">
                  <tr>
                    <th className="px-4 py-3">Tracking ID</th>
                    <th className="py-3">Vendor / Project</th>
                    <th className="py-3">Document Package</th>
                    <th className="py-3">Current Global Status</th>
                    <th className="px-4 py-3 text-end">Logs Trace</th>
                  </tr>
                </thead>
                <tbody className="fs-7.5 fw-medium text-dark">
                  {outboxSubmissions.map(sub => (
                    <tr key={sub.id} className="border-bottom border-light-subtle">
                      <td className="px-4 py-3 font-monospace fw-bold text-secondary">{sub.id}</td>
                      <td className="py-3">
                        <span className="d-block fw-bold text-dark">{sub.vendor}</span>
                        <span className="badge bg-secondary bg-opacity-10 text-secondary fs-8 font-monospace rounded-1 px-1.5 mt-0.5">{sub.projectType}</span>
                      </td>
                      <td className="py-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
                          <span>{sub.fileName}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`badge rounded-pill px-2.5 py-1 fs-8 fw-bold ${
                          sub.status.includes('Approved') ? 'bg-success bg-opacity-10 text-success' : 'bg-warning bg-opacity-10 text-warning'
                        }`}>{sub.status}</span>
                      </td>
                      <td className="px-4 py-3 text-end font-monospace text-muted fs-8">
                        {sub.history[sub.history.length - 1]?.date || 'Active'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full-page PDF viewer takes over the entire screen — reached only via the
  // "View Document" link inside SubmissionAudit.
  if (viewMode === 'pdf' && activeAuditSub) {
    return (
      <div className="container-fluid py-4 animate-fade-in">
        <PdfViewerPage submission={activeAuditSub} onBack={backToTimeline} />
      </div>
    );
  }

  // 100% Full View Screen Render block for Inbox (Arrived Files list + History Timeline)
  return (
    <div className="container-fluid py-4 animate-fade-in">
      {successToast && (
        <div className="alert alert-success border-0 bg-success bg-opacity-10 text-success fw-bold p-3 rounded-3 fs-7 mb-4 shadow-xs d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill fs-5"></i> {successToast}
        </div>
      )}

      {viewMode === 'timeline' && activeAuditSub ? (
        <SubmissionAudit
          submission={activeAuditSub}
          daysElapsed={calculateDaysElapsed(activeAuditSub.dateArrivedAtCurrentStage)}
          actionRemarks={actionRemarks}
          onRemarksChange={setActionRemarks}
          onBack={closeAudit}
          onOpenPdf={openPdf}
          onSendBack={() => executeStageMovement('SENDBACK')}
          onForward={() => executeStageMovement('FORWARD')}
          hasDigitalSignature={user.hasDigitalSignature}
        />
      ) : (
        /* Workspace Queue Inbox Grid Layout List (Arrived Files) */
        <div>
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div>
              <h3 className="mb-0 fw-extrabold text-dark tracking-tight">Workflow Action Inbox</h3>
              <p className="text-muted fs-7 mb-0">Submissions awaiting structural validation analysis from your department layer desk</p>
            </div>
            <span className="badge bg-primary px-3 py-2 rounded-pill fs-7.5 font-monospace fw-bold shadow-2xs">
              {inboxSubmissions.length} Pending Actions
            </span>
          </div>

          {inboxSubmissions.length === 0 ? (
            <div className="text-center bg-white border rounded-4 p-5 shadow-xs">
              <i className="bi bi-folder-check text-success display-4 d-block mb-3 opacity-50"></i>
              <h5 className="text-dark fw-bold">Inbox completely clear!</h5>
              <p className="text-muted fs-7">No particulars packages are currently sitting in your desk evaluation lane.</p>
            </div>
          ) : (
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
              <div className="table-responsive">
                <table className="table align-middle mb-0 text-nowrap">
                  <thead className="bg-light bg-opacity-70 border-bottom text-uppercase font-monospace fs-8 text-secondary fw-bold">
                    <tr>
                      <th className="px-4 py-3">Tracking ID</th>
                      <th className="py-3">Vendor Origin</th>
                      <th className="py-3">Project Agreement</th>
                      <th className="py-3">Particulars File</th>
                      <th className="py-3 text-center">Desk Age</th>
                      <th className="px-4 py-3 text-end">Action Desk</th>
                    </tr>
                  </thead>
                  <tbody className="fs-7.5 fw-medium text-dark">
                    {inboxSubmissions.map(sub => {
                      const age = calculateDaysElapsed(sub.dateArrivedAtCurrentStage);
                      return (
                        <tr key={sub.id} className="border-bottom border-light-subtle hover-bg-light-row transition-all">
                          <td className="px-4 py-3 font-monospace fw-bold text-secondary">{sub.id}</td>
                          <td className="py-3 fw-bold text-dark">{sub.vendor}</td>
                          <td className="py-3">
                            <span className="badge bg-primary bg-opacity-10 text-primary fs-8 font-monospace rounded-1 px-2 py-1">{sub.projectType}</span>
                          </td>
                          <td className="py-3">
                            <div className="d-flex align-items-center gap-2">
                              <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
                              <span className="text-truncate" style={{ maxWidth: '180px' }} title={sub.fileName}>{sub.fileName}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`badge rounded-pill px-2.5 py-1 fs-8 fw-bold ${
                              age > 5 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-warning bg-opacity-10 text-warning'
                            }`}>{age} Days</span>
                          </td>
                          <td className="px-4 py-3 text-end">
                            <button
                              onClick={() => openAudit(sub)}
                              className="btn btn-primary btn-sm rounded-pill px-3 fw-bold shadow-xs fs-8"
                            >
                              <i className="bi bi-search me-1"></i> Audit File
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .hover-bg-light-row:hover {
          background-color: rgba(248, 249, 250, 0.6) !important;
        }
        .fs-7.5 { font-size: 0.825rem !important; }
        .fs-8.5 { font-size: 0.775rem !important; }
        .shadow-3xs { box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important; }
      `}</style>
    </div>
  );
}
