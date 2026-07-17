import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function OfficerDashboard({ currentTab }) {
  const { user, submissions, processWorkflowMovement, calculateDaysElapsed } = useApp();
  const [activeAuditSub, setActiveAuditSub] = useState(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [successToast, setSuccessToast] = useState('');

  if (!user) return null;

  // Filter incoming items targeting this officer title slot ("Workflow Inbox")
  const inboxSubmissions = submissions.filter(sub => sub.currentStage === user.title);
  
  // Track packages already pushed onward out of this desk ("Workflow Outbox")
  const outboxSubmissions = submissions.filter(sub => 
    sub.currentStage !== user.title && 
    sub.history.some(log => log.actor.includes(user.name))
  );

  const executeStageMovement = (actionType) => {
    if (!activeAuditSub) return;
    
    processWorkflowMovement(activeAuditSub.id, actionRemarks || 'Approved and processed.', actionType);
    
    const feedbackLabel = actionType === 'FORWARD' ? 'Forwarded successfully' : 'Returned back with remarks';
    setSuccessToast(`Package tracking node ${activeAuditSub.id} has been ${feedbackLabel}.`);
    
    setActiveAuditSub(null);
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

  // 100% Full View Screen Render block for Inbox Split Layout (Arrived Files + PDF)
  return (
    <div className="container-fluid py-4 animate-fade-in">
      {successToast && (
        <div className="alert alert-success border-0 bg-success bg-opacity-10 text-success fw-bold p-3 rounded-3 fs-7 mb-4 shadow-xs d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill fs-5"></i> {successToast}
        </div>
      )}

      {activeAuditSub ? (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white animate-fade-in">
          <div className="bg-light bg-opacity-60 border-bottom px-4 py-3 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <button onClick={() => setActiveAuditSub(null)} className="btn btn-outline-secondary btn-sm rounded-circle px-2 py-1 border-0 bg-white shadow-xs">
                <i className="bi bi-arrow-left"></i>
              </button>
              <div>
                <h5 className="mb-0 fw-extrabold text-dark tracking-tight">Auditing Node: {activeAuditSub.id}</h5>
                <span className="text-muted fs-8 font-monospace">{activeAuditSub.vendor} &bull; {activeAuditSub.projectType} Scope</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-warning bg-opacity-15 text-warning border border-warning border-opacity-20 px-3 py-1.5 rounded-pill fs-8 fw-bold">
                <i className="bi bi-hourglass-split me-1"></i> Desk Age: {calculateDaysElapsed(activeAuditSub.dateArrivedAtCurrentStage)} Days
              </span>
            </div>
          </div>

          <div className="row g-0" style={{ minHeight: '580px' }}>
            {/* Left Box Split Compartment Component: Dynamic Native IFrame PDF Canvas Previewer Frame */}
            <div className="col-12 col-lg-7 border-end bg-light bg-opacity-40 d-flex flex-column">
              <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between shadow-3xs">
                <div className="d-flex align-items-center gap-2 text-truncate pe-2">
                  <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
                  <span className="fs-7.5 fw-bold text-dark text-truncate">{activeAuditSub.fileName}</span>
                  <span className="text-muted fs-8 font-monospace">({activeAuditSub.fileSize})</span>
                </div>
                {activeAuditSub.fileUrl && (
                  <a href={activeAuditSub.fileUrl} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-xs px-2 py-1 rounded d-flex align-items-center gap-1 font-monospace fs-8 fw-bold bg-white shadow-3xs">
                    <i className="bi bi-fullscreen"></i> External View
                  </a>
                )}
              </div>
              
              {/* Native System Iframe Core Object Vector Slot rendering your loaded local blank PDF files perfectly */}
              <div className="flex-grow-1 p-0 bg-secondary bg-opacity-10" style={{ minHeight: '500px' }}>
                {activeAuditSub.fileUrl ? (
                  <iframe 
                    src={activeAuditSub.fileUrl} 
                    title="Workflow Particulars Document Canvas Layer" 
                    className="w-100 h-100 border-0"
                  />
                ) : (
                  <div className="d-flex align-items-center justify-content-center h-100 p-5 text-muted font-monospace fs-8 text-uppercase">
                    <i className="bi bi-exclamation-triangle me-1 text-warning"></i> File buffer location path vector missing
                  </div>
                )}
              </div>
              
              <div className="bg-light border-top p-2.5 text-center fs-8 fw-bold text-muted uppercase font-monospace">
                Portal Embedded Document Canvas Frame v3.0 &bull; Live Render Model
              </div>
            </div>

            {/* Right Box Split Compartment Component: Workflow Operations Panel */}
            <div className="col-12 col-lg-5 p-4 d-flex flex-column justify-content-between bg-white">
              <div className="d-flex flex-column gap-3.5">
                <div>
                  <label className="form-label fw-bold text-secondary fs-8 font-monospace text-uppercase tracking-wider mb-1">Workflow Lifecycle Audit Remarks</label>
                  <textarea 
                    className="form-control border border-light-subtle rounded-3 fs-7.5 bg-light bg-opacity-20"
                    rows="5"
                    placeholder="Enter analytical review logs, query specifics, or validation checks..."
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                  ></textarea>
                  <div className="form-text fs-8 text-muted mt-1">
                    * Action Remarks are mandatory if triggering a back-movement query response loop.
                  </div>
                </div>

                <div>
                  <span className="d-block fw-bold text-secondary fs-8 font-monospace text-uppercase tracking-wider mb-2">Preceding Activity Trails</span>
                  <div className="bg-light bg-opacity-50 border border-light-subtle rounded-3 p-3 overflow-auto" style={{ maxHeight: '160px' }}>
                    {activeAuditSub.history.map((log, index) => (
                      <div key={index} className="fs-8 border-bottom border-light-subtle pb-2 mb-2 last-border-0">
                        <div className="d-flex align-items-center justify-content-between mb-0.5">
                          <span className="fw-bold text-dark">{log.actor}</span>
                          <span className="text-muted font-monospace">{log.date}</span>
                        </div>
                        <span className="d-block text-primary fw-semibold fs-8.5">{log.action}</span>
                        {log.remarks && <p className="text-secondary italic mb-0 mt-0.5 bg-white p-1.5 rounded border shadow-3xs">"{log.remarks}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Operations Grid Button Drawer Blocks */}
              <div className="pt-4 border-top border-light-subtle d-flex flex-column gap-2">
                <div className="row g-2">
                  <div className="col-6">
                    <button 
                      onClick={() => executeStageMovement('SENDBACK')}
                      className="btn btn-outline-danger w-100 py-2.5 rounded-3 fw-bold fs-7 d-flex align-items-center justify-content-center gap-1.5 shadow-sm"
                      disabled={!actionRemarks.trim()}
                      title="Add remarks to send package back"
                    >
                      <i className="bi bi-reply-all-fill"></i> Send Back
                    </button>
                  </div>
                  <div className="col-6">
                    <button 
                      onClick={() => executeStageMovement('FORWARD')}
                      className={`btn w-100 py-2.5 rounded-3 fw-bold fs-7 d-flex align-items-center justify-content-center gap-1.5 shadow-sm ${
                        user.hasDigitalSignature ? 'btn-success' : 'btn-primary'
                      }`}
                    >
                      <i className={`bi ${user.hasDigitalSignature ? 'bi-patch-check-fill' : 'bi-arrow-right-circle-fill'}`}></i>
                      {user.hasDigitalSignature ? 'Digital Sign' : 'Approve & Move'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
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
                              onClick={() => {
                                setActiveAuditSub(sub);
                                setActionRemarks('');
                              }} 
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