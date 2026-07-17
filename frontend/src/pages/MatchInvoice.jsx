import React from 'react';
import { useApp } from '../context/AppContext';

export default function MatchInvoice() {
  const { submissions } = useApp();
  
  // Filter for cases undergoing active matching operations at the APTS desk
  const aptsQueue = submissions.filter(s => s.currentStage === 'APTS' || s.invoiceSubmitted);

  const triggerMockDownload = (fileName) => {
    alert(`Initializing high-speed secure download for artifact particulars document:\n[${fileName}]\n(40+ Pages Inventory Statement Package Bundle)`);
  };

  return (
    <div className="container-fluid py-2">
      <div className="card shadow border-0 rounded-3 p-4 bg-white mb-4">
        <h5 className="fw-bold text-dark mb-1">
          <i className="bi bi-bank text-primary me-2"></i>
          APTS Clearance & Invoice Reconciliation
        </h5>
        <p className="text-muted small mb-0">
          Automated control deck to cross-verify approved ITE&C specifications sheets against final vendor invoices.
        </p>
      </div>

      <div className="card shadow border-0 rounded-3 p-4 bg-white">
        {aptsQueue.length === 0 ? (
          <div className="text-center py-5 text-muted border rounded border-dashed">
            <i className="bi bi-file-earmark-diff fs-1 text-black-50 d-block mb-2"></i>
            No active invoices matching in the system right now.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-bordered align-middle text-sm">
              <thead className="table-light text-secondary small text-uppercase">
                <tr>
                  <th>Job Ref</th>
                  <th>Vendor & Project Scope</th>
                  <th>Approved Specifications Particulars</th>
                  <th>Submitted Claim Invoice</th>
                  <th>Automatic Reconciliation Matrix Status</th>
                </tr>
              </thead>
              <tbody>
                {aptsQueue.map(sub => (
                  <tr key={sub.id}>
                    <td><span className="badge bg-dark font-monospace">{sub.id}</span></td>
                    <td>
                      <div className="fw-bold text-dark">{sub.vendor}</div>
                      <span className="text-muted text-xs font-monospace">{sub.projectType}</span>
                    </td>
                    <td className="bg-light bg-opacity-50">
                      <div className="small text-success fw-bold d-flex align-items-center gap-1">
                        <i className="bi bi-patch-check-fill text-success"></i>
                        ITE&C Certificate Cleared
                      </div>
                      <button 
                        type="button" 
                        onClick={() => triggerMockDownload(sub.fileName)} 
                        className="btn btn-link text-decoration-none p-0 mt-1 d-block text-xs text-primary"
                      >
                        <i className="bi bi-download me-1"></i> Download Particulars PDF
                      </button>
                    </td>
                    <td>
                      {sub.invoiceSubmitted ? (
                        <div>
                          <div className="small fw-bold text-dark">
                            <i className="bi bi-receipt text-secondary me-1"></i>
                            {sub.invoiceData.invoiceNo}
                          </div>
                          <div className="text-xs text-primary fw-bold mt-0.5">
                            Amount: ₹ {Number(sub.invoiceData.totalAmount).toLocaleString('en-IN')}/-
                          </div>
                        </div>
                      ) : (
                        <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-20 px-2 py-1 text-xs">
                          <i className="bi bi-hourglass-split me-1"></i> Awaiting Vendor Upload
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      {sub.invoiceSubmitted ? (
                        <div className="p-2 border border-success rounded bg-success bg-opacity-5 text-start">
                          <span className="text-success fw-bold small d-block mb-1">
                            <i className="bi bi-shield-fill-check me-1"></i> 100% Data Alignment Match
                          </span>
                          <button 
                            className="btn btn-success btn-xs w-100 py-1 font-bold rounded shadow-xs text-white" 
                            onClick={() => alert(`Disbursement instruction fired to finance division for Reference ID: ${sub.id}`)}
                          >
                            Release Bill Payment
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted text-xs italic">
                          Awaiting invoice documents to trigger automatic matching matrix
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}