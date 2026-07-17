import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function VendorDashboard({ currentTab }) {
  const { user, submissions, submitParticulars } = useApp();
  const [projectType, setProjectType] = useState('');
  const [fileObject, setFileObject] = useState(null);
  const [vendorRemarks, setVendorRemarks] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!user) return null;

  // Filter items logged by this specific vendor node
  const mySubmissions = submissions.filter(sub => sub.vendor === user.name);

  const handleUpload = (e) => {
    e.preventDefault();
    if (!projectType || !fileObject) return;

    submitParticulars(projectType, fileObject, null, vendorRemarks);

    setSuccessMsg(`Particulars package for ${projectType} logged under tracking matrix successfully!`);
    setProjectType('');
    setFileObject(null);
    setVendorRemarks('');

    setTimeout(() => setSuccessMsg(''), 4000);
    e.target.reset();
  };

  // Restored: Swapped to explicitly check for the clean 'status' tab key
  if (currentTab === 'status') {
    return (
      <div className="container-fluid py-4 animate-fade-in">
        <div className="d-flex flex-column mb-4">
          <h3 className="mb-0 fw-extrabold text-dark tracking-tight">Package Tracking Ledger</h3>
          <p className="text-muted fs-7">Real-time lifecycle monitoring matrix across official administrative desk networks</p>
        </div>

        {mySubmissions.length === 0 ? (
          <div className="text-center bg-white border rounded-4 p-5 shadow-xs">
            <i className="bi bi-folder-x text-muted display-4 d-block mb-3 opacity-50"></i>
            <h5 className="text-dark fw-bold">No active logs found</h5>
            <p className="text-muted fs-7">Use the "Upload Particulars" workspace link to log your first documentation file tracking trail.</p>
          </div>
        ) : (
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
            <div className="table-responsive">
              <table className="table align-middle mb-0 text-nowrap">
                <thead className="bg-light bg-opacity-70 border-bottom text-uppercase font-monospace fs-8 text-secondary fw-bold">
                  <tr>
                    <th className="px-4 py-3">Tracking ID</th>
                    <th className="py-3">Infrastructure Project Scope</th>
                    <th className="py-3">Document Particulars File</th>
                    <th className="py-3">Current Active Desk Location</th>
                    <th className="px-4 py-3 text-end">Global Status Badge</th>
                  </tr>
                </thead>
                <tbody className="fs-7.5 fw-medium text-dark">
                  {mySubmissions.map(sub => (
                    <tr key={sub.id} className="border-bottom border-light-subtle">
                      <td className="px-4 py-3 font-monospace fw-bold text-secondary">{sub.id}</td>
                      <td className="py-3 fw-bold text-dark">{sub.projectType}</td>
                      <td className="py-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
                          <div>
                            <span className="d-block text-truncate fw-bold text-dark" style={{ maxWidth: '200px' }} title={sub.fileName}>{sub.fileName}</span>
                            <span className="text-muted font-monospace fs-8">{sub.fileSize}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-15 font-monospace px-2 py-1 rounded-1">
                          <i className="bi bi-person-workspace me-1"></i> {sub.currentStage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <span className={`badge rounded-pill px-2.5 py-1 fs-8 fw-bold shadow-3xs ${
                          sub.status.includes('Rejected') || sub.status.includes('Back')
                            ? 'bg-danger bg-opacity-10 text-danger' 
                            : sub.status.includes('Approved') 
                            ? 'bg-success bg-opacity-10 text-success' 
                            : 'bg-warning bg-opacity-10 text-warning'
                        }`}>{sub.status}</span>
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

  return (
    <div className="container-fluid py-4 animate-fade-in" style={{ maxWidth: '960px' }}>
      <div className="d-flex flex-column mb-4">
        <h3 className="mb-0 fw-extrabold text-dark tracking-tight">Dispatch Particulars Package</h3>
        <p className="text-muted fs-7">Route fresh documentation maps directly into the official administrative verification cycle streams</p>
      </div>

      {successMsg && (
        <div className="alert alert-success border-0 bg-success bg-opacity-10 text-success fw-bold p-3 rounded-3 fs-7 mb-4 shadow-xs d-flex align-items-center gap-2 animate-fade-in">
          <i className="bi bi-check-circle-fill fs-5"></i> {successMsg}
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
        <form onSubmit={handleUpload} className="d-flex flex-column gap-4">
          <div>
            <label className="form-label fw-bold text-secondary fs-7 uppercase font-monospace mb-1">Target Project Agreement Classification</label>
            <select 
              className="form-select form-select-lg border border-light-subtle fs-7 rounded-3 bg-light bg-opacity-10"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              required
            >
              <option value="">-- Choose target project framework lane --</option>
              {/* RESTORED ORIGINAL EXPLICIT PROJECT NAMES */}
              <option value="Video Conferencing">Video Conferencing</option>
              <option value="APSDWAN">APSDWAN</option>
              <option value="APSCAN">APSCAN</option>
            </select>
          </div>

          <div>
            <label className="form-label fw-bold text-secondary fs-7 uppercase font-monospace mb-1">Upload Particulars PDF Document</label>
            <input 
              type="file" 
              className="form-control form-control-lg border border-light-subtle fs-7 rounded-3 bg-light bg-opacity-10" 
              accept="application/pdf"
              onChange={(e) => setFileObject(e.target.files[0])}
              required 
            />
            <div className="form-text fs-8 text-muted mt-1">
              <i className="bi bi-info-circle"></i> Attach your official system PDF mapping configuration to upload directly.
            </div>
          </div>

          <div>
            <label className="form-label fw-bold text-secondary fs-7 uppercase font-monospace mb-1">Vendor Audit Submission Log Remarks</label>
            <textarea 
              className="form-control border border-light-subtle fs-7 rounded-3 bg-light bg-opacity-10"
              rows="4"
              placeholder="Provide analytical scope descriptors, compilation tracking numbers, or notes for the verifying desk..."
              value={vendorRemarks}
              onChange={(e) => setVendorRemarks(e.target.value)}
            ></textarea>
          </div>

          <div className="pt-2 border-top border-light-subtle mt-2">
            <button type="submit" className="btn btn-primary btn-lg px-4 py-2.5 rounded-3 fw-bold fs-7 shadow-sm d-inline-flex align-items-center gap-2">
              <i className="bi bi-cloud-arrow-up-fill fs-6"></i> Upload & Route to Desk Network
            </button>
          </div>
        </form>
      </div>
      
      <style>{`
        .fs-7.5 { font-size: 0.825rem !important; }
        .fs-8 { font-size: 0.75rem !important; }
        .shadow-3xs { box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important; }
      `}</style>
    </div>
  );
}