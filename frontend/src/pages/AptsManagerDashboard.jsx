import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function AptsManagerDashboard({ currentTab }) {
  const { submissions, calculateDaysElapsed } = useApp();
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Filter tracking nodes that have reached the APTS Manager desk or have been final cleared
  const incomingItems = submissions.filter(
    sub => sub.currentStage === 'APTS_MANAGER' || sub.currentStage === 'APPROVED_FINAL'
  );

  // Fallback function to view or print generated PDF documentation smoothly
  const handleViewPdf = (item) => {
    if (item.fileUrl && item.fileUrl.trim() !== '') {
      window.open(item.fileUrl, '_blank');
    } else {
      // If mock string placeholder data exists without live blob URL wrapper structures, generate dynamic fallback
      const mockPdfBlob = new Blob(
        [`%PDF-1.4 ... APTS Verification System Document Node Reference: ${item.id} ... Vendor: ${item.vendor}`], 
        { type: 'application/pdf' }
      );
      const testUrl = URL.createObjectURL(mockPdfBlob);
      window.open(testUrl, '_blank');
    }
  };

  return (
    <div className="p-4 container-fluid animate-fade-in">
      {/* Dashboard Summary Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-shield-lock-fill text-primary me-2"></i> APTS Manager Desk
          </h3>
          <p className="text-muted small mb-0">Final settlement clearing house for digitally signed vendor particulars.</p>
        </div>
        <div className="d-flex gap-3">
          <div className="bg-white px-3 py-2 rounded-3 shadow-sm border text-center">
            <span className="small text-secondary fw-bold d-block">Pending Action</span>
            <span className="badge bg-warning text-dark mt-1">
              {incomingItems.filter(i => i.currentStage === 'APTS_MANAGER').length} Packages
            </span>
          </div>
          <div className="bg-white px-3 py-2 rounded-3 shadow-sm border text-center">
            <span className="small text-secondary fw-bold d-block">Total Settled</span>
            <span className="badge bg-success mt-1">
              {incomingItems.filter(i => i.currentStage === 'APPROVED_FINAL').length} Cleared
            </span>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Main Left Side Items Panel Matrix Listing */}
        <div className={selectedSubmission ? "col-md-7" : "col-md-12"}>
          <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
            <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold text-dark d-flex align-items-center">
                <i className="bi bi-inbox-fill text-primary me-2"></i>
                Incoming Signed Particulars Inbox
              </h5>
              <span className="text-xs text-muted font-monospace">Role: Final End-Node</span>
            </div>
            
            <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Package ID</th>
                    <th>Vendor Entity</th>
                    <th>Project Matrix</th>
                    <th>Received Date</th>
                    <th>Status Flag</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        <i className="bi bi-folder-x fs-1 d-block mb-2 text-secondary"></i>
                        No digitally signed particulars currently sitting in APTS Inbox.
                      </td>
                    </tr>
                  ) : (
                    incomingItems.map((item) => (
                      <tr 
                        key={item.id} 
                        className={selectedSubmission?.id === item.id ? "table-primary" : ""}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedSubmission(item)}
                      >
                        <td><span className="font-monospace fw-bold text-primary">{item.id}</span></td>
                        <td className="small text-dark fw-bold">{item.vendor}</td>
                        <td className="small text-secondary">{item.projectType}</td>
                        <td className="small font-monospace">{item.dateArrivedAtCurrentStage}</td>
                        <td>
                          <span className={`badge border ${
                            item.currentStage === 'APPROVED_FINAL' 
                              ? 'bg-success-subtle text-success border-success' 
                              : 'bg-warning-subtle text-warning-emphasis border-warning'
                          } rounded-pill px-2.5 py-1.5 text-xs`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="text-end">
                          <button 
                            className="btn btn-sm btn-primary fw-bold px-3 shadow-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubmission(item);
                            }}
                          >
                            Open Case File
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side Expanded Case Detail View Engine */}
        {selectedSubmission && (
          <div className="col-md-5">
            <div className="card border-0 shadow-sm rounded-3 sticky-top overflow-hidden" style={{ top: '20px' }}>
              <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
                <h6 className="mb-0 fw-bold font-monospace text-truncate">
                  <i className="bi bi-folder2-open text-warning me-2"></i> File: {selectedSubmission.id}
                </h6>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setSelectedSubmission(null)}
                ></button>
              </div>
              
              <div className="card-body p-4" style={{ maxHeight: '700px', overflowY: 'auto' }}>
                {/* Meta Attributes List Container */}
                <div className="mb-4 bg-light p-3 rounded-3 border">
                  <div className="row g-2 small">
                    <div className="col-4 text-secondary fw-bold">Vendor Name:</div>
                    <div className="col-8 text-dark fw-semibold">{selectedSubmission.vendor}</div>
                    
                    <div className="col-4 text-secondary fw-bold">Project Class:</div>
                    <div className="col-8 text-dark">{selectedSubmission.projectType}</div>
                    
                    <div className="col-4 text-secondary fw-bold">Arrival Date:</div>
                    <div className="col-8 text-dark font-monospace">{selectedSubmission.dateArrivedAtCurrentStage}</div>
                    
                    <div className="col-4 text-secondary fw-bold">Desk Age:</div>
                    <div className="col-8 text-danger fw-bold">
                      {calculateDaysElapsed(selectedSubmission.dateArrivedAtCurrentStage)} Days Pending
                    </div>
                  </div>
                </div>

                {/* Secure File Reference Attachment View Block */}
                <h6 className="fw-bold mb-2 text-secondary small uppercase">Document Particulars Reference</h6>
                <div className="card border mb-4 rounded-3 shadow-xs bg-light">
                  <div className="card-body py-3 d-flex align-items-center justify-content-between bg-white rounded-3">
                    <div className="d-flex align-items-center overflow-hidden me-2">
                      <i className="bi bi-file-earmark-pdf-fill text-danger fs-2 me-3 flex-shrink-0"></i>
                      <div className="overflow-hidden">
                        <div className="fw-bold text-dark text-truncate small">
                          {selectedSubmission.fileName}
                        </div>
                        <span className="text-muted text-xs font-monospace">{selectedSubmission.fileSize}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleViewPdf(selectedSubmission)}
                      className="btn btn-sm btn-danger fw-bold px-3 flex-shrink-0 d-flex align-items-center"
                    >
                      <i className="bi bi-file-pdf me-1"></i> View PDF
                    </button>
                  </div>
                </div>

                {/* Complete Dynamic Historical Trail Audits Display Grid */}
                <h6 className="fw-bold mb-3 text-secondary border-bottom pb-2">
                  <i className="bi bi-clock-history me-2"></i> Route Workflow History Log
                </h6>
                <div className="position-relative ps-3 border-start ms-2 mb-4">
                  {selectedSubmission.history.map((log, index) => (
                    <div key={index} className="mb-3 position-relative">
                      <span className="position-absolute start-0 top-0 translate-middle bg-primary border border-light rounded-circle p-1" style={{ marginLeft: '-17px' }}></span>
                      <div className="bg-light p-2.5 rounded-3 border small">
                        <div className="d-flex justify-content-between mb-1 gap-2">
                          <span className="fw-bold text-dark text-truncate">{log.actor}</span>
                          <span className="text-muted font-monospace text-xs flex-shrink-0">{log.date}</span>
                        </div>
                        <div className="text-primary fw-semibold text-xs mb-1">{log.action}</div>
                        {log.remarks && <p className="text-muted mb-0 font-italic text-xs bg-white p-2 border rounded mt-1">"{log.remarks}"</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Processing Action Center Section */}
                {selectedSubmission.currentStage === 'APTS_MANAGER' ? (
                  <div className="border-top pt-3 mt-3">
                    <div className="alert alert-success border-0 text-center small py-2 mb-3">
                      <i className="bi bi-patch-check-fill me-2"></i>
                      Package signed digitally by <strong>JD-Infra</strong> authority node.
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-success w-100 py-2.5 fw-bold shadow-sm d-flex align-items-center justify-content-center"
                      onClick={() => {
                        if(window.confirm("Perform final system validation and clear this vendor package entry?")) {
                          selectedSubmission.currentStage = 'APPROVED_FINAL';
                          selectedSubmission.status = 'Approved & APTS Operation Cleared';
                          selectedSubmission.history.push({
                            actor: 'Sri P. Venkataswamy (APTS Manager Desk)',
                            action: 'Acknowledged, Settled & Disbursed by APTS',
                            date: new Date().toISOString().split('T')[0],
                            remarks: 'Final disbursement processing complete. Document locked and archived in APTS registry.'
                          });
                          setSelectedSubmission(null);
                        }
                      }}
                    >
                      <i className="bi bi-check-circle-fill me-2"></i> Verify, Clear & Close Case File
                    </button>
                  </div>
                ) : (
                  <div className="alert alert-secondary border-0 text-center small py-2 mb-0">
                    <i className="bi bi-archive-fill me-2"></i> This workflow has reached its final terminal state and is safely archived.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}