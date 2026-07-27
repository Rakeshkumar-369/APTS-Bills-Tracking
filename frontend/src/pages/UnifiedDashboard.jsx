// src/pages/UnifiedDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsService, poService } from '../services';
import { useAuth } from '../context/AuthContext';
import SubmissionAudit from './SubmissionAudit';
import PdfViewerPage from './PdfViewerPage';

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAuditView, setShowAuditView] = useState(false);
  const [processAction, setProcessAction] = useState('');
  const [processRemarks, setProcessRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState(null);
  const [inboxStats, setInboxStats] = useState({
    total: 0,
    pending: 0,
    returned: 0
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    returned: 0,
    inProgress: 0
  });
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [showPdfView, setShowPdfView] = useState(false);
  const [pdfclaimId, setPdfclaimId] = useState(null);

  // Purchase Order states
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [posLoading, setPosLoading] = useState(false);

  // For assign action: target user list
  const [officers, setOfficers] = useState([]);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState('');

  // Get API base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const SERVER_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

  const toAbsoluteUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path.replace(/\\/g, '/');
    let normalized = path.replace(/\\/g, '/');
    normalized = normalized.replace(/^\/?/, '/');
    return `${SERVER_ORIGIN}${normalized}`;
  };

  // Determine user role
  const userRole = user?.role_rank === 100 ? 'admin' :
                    user?.role_rank === 10 ? 'vendor' :
                    user?.role_rank === 30 ? 'pm' :
                    user?.role_rank === 40 ? 'tpa' :
                    user?.role_rank === 50 ? 'jdinfra' :
                    user?.role_rank === 60 ? 'apts' : 'unknown';

  const getRoleDisplayName = () => {
    if (user?.role_rank === 100) return 'APTS Admin';
    if (user?.role_rank === 10) return 'Vendor';
    if (user?.role_rank === 30) return 'Project Manager';
    if (user?.role_rank === 40) return 'TPA Auditor';
    if (user?.role_rank === 50) return 'JD-Infra';
    if (user?.role_rank === 60) return 'APTS Manager';
    return 'User';
  };

  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.vendor_name) return user.vendor_name;
    if (user?.email) return user.email;
    return 'User';
  };

  const getRoleDescription = () => {
    if (user?.role_rank === 100) return 'System administration and oversight';
    if (user?.role_rank === 10) return 'Create and submit claims; respond to sendbacks';
    if (user?.role_rank === 30) return 'First verification desk - review and forward claims';
    if (user?.role_rank === 40) return 'Audit & verification desk - review and forward claims';
    if (user?.role_rank === 50) return 'Digital signature authority - validate and forward';
    if (user?.role_rank === 60) return 'Final clearance authority - approve or send back';
    return 'Manage your dashboard';
  };

  const roleDisplayName = getRoleDisplayName();
  const userDisplayName = getUserDisplayName();
  const roleDescription = getRoleDescription();

  useEffect(() => {
    if (user) {
      fetchData();
      if (['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole)) {
        fetchInboxStats();
      }
      if (userRole === 'admin' || userRole === 'vendor') {
        fetchPurchaseOrders();
        if (userRole === 'admin') {
          fetchOfficers();
        }
      }
    } else {
      setLoading(false);
      setError('Please login to view your dashboard');
    }
  }, [user]);

  const fetchInboxStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const response = await fetch(`${API_BASE}/inbox/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      if (!response.ok) return;
      const data = await response.json();
      setInboxStats(data);
    } catch (err) {
      console.debug('Inbox stats not available:', err.message);
    }
  };

const fetchPurchaseOrders = async () => {
  setPosLoading(true);
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    let params = {};
    if (userRole === 'vendor' && user?.vendor_id) {
      params.vendor_id = user.vendor_id;
    }
    const { data } = await poService.list(params);  // ← destructure the data array
    setPurchaseOrders(data || []);
  } catch (err) {
    console.error('Failed to fetch POs:', err);
  } finally {
    setPosLoading(false);
  }
};

  const fetchOfficers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const response = await fetch(`${API_BASE}/users/officers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch officers');
      const data = await response.json();
      setOfficers(data || []);
    } catch (err) {
      console.error('Failed to fetch officers:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token found');

      let claimsData = [];
      switch(userRole) {
        case 'vendor':
          const vendorId = user?.vendor_id || user?.vendorId || user?.id;
          claimsData = await claimsService.list({ vendor_id: vendorId });
          break;
        case 'pm':
        case 'tpa':
        case 'jdinfra':
        case 'apts':
          claimsData = await claimsService.list({ current_stage: userRole.toUpperCase() });
          break;
        case 'admin':
          claimsData = await claimsService.list({});
          break;
        default:
          claimsData = await claimsService.list({});
      }

      if (claimsData && claimsData.length > 0) {
        const claimsWithDetails = await Promise.all(
          claimsData.map(async (pkg) => {
            try {
              const pkgId = pkg.id || pkg.claim_id || pkg.ID;
              if (pkgId) {
                const details = await claimsService.get(pkgId, { includeDetails: true });
                return details || pkg;
              }
              return pkg;
            } catch {
              return pkg;
            }
          })
        );
        setClaims(claimsWithDetails);
      } else {
        setClaims([]);
      }

      const total = claimsData?.length || 0;
      const pending = claimsData?.filter(p => ['PENDING','SUBMITTED','IN_PROGRESS'].includes(p.status)).length || 0;
      const completed = claimsData?.filter(p => ['COMPLETED','APPROVED','CLEARED'].includes(p.status)).length || 0;
      const returned = claimsData?.filter(p => ['RETURNED','SENT_BACK','REJECTED'].includes(p.status)).length || 0;
      const inProgress = claimsData?.filter(p => p.status === 'IN_PROGRESS').length || 0;
      setStats({ total, pending, completed, returned, inProgress });

    } catch (err) {
      console.error('❌ Error fetching data:', err);
      setError(err.message || 'Failed to load data');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (claimId, fileId, filename) => {
    if (!claimId || !fileId) {
      alert('Invalid file or claim ID');
      return;
    }
    setDownloading(true);
    try {
      await claimsService.downloadFile(claimId, fileId, filename);
    } catch (err) {
      console.error('❌ Download error:', err);
      alert('Failed to download file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewClaim = async (item) => {
    const pkgId = item?.id || item?.claim_id || item?.ID;
    if (!pkgId) {
      console.error('No claim ID found in item:', item);
      alert('Unable to get claim ID');
      return;
    }
    setLoadingItemId(pkgId);
    try {
      const details = await claimsService.get(pkgId, { includeDetails: true });
      let fileUrl = null;
      let fileName = 'document.pdf';
      let fileSize = 'N/A';
      
      if (details?.files && details.files.length > 0) {
        const file = details.files[0];
        fileName = file.original_name || file.filename || 'document.pdf';
        fileSize = file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'N/A';
        if (file.id) {
          fileUrl = `${API_BASE}/claims/${pkgId}/files/${file.id}/download`;
        } else {
          const rawUrl = file.url || file.file_path || file.download_url || file.public_url || null;
          fileUrl = toAbsoluteUrl(rawUrl);
        }
      }
      if (!fileUrl && details?.file_url) fileUrl = toAbsoluteUrl(details.file_url);
      if (!fileUrl && details?.attachment_url) fileUrl = toAbsoluteUrl(details.attachment_url);
      if (!fileUrl && details?.document_url) fileUrl = toAbsoluteUrl(details.document_url);

      const submissionData = {
        id: details?.claim_code || details?.claimCode || pkgId,
        claimId: pkgId,
        vendor: details?.vendor_name || details?.vendor || 'N/A',
        projectType: details?.project_name || details?.project?.project_name || 'N/A',
        fileName: fileName,
        fileSize: fileSize,
        fileUrl: fileUrl,
        history: details?.history || [
          { actor: 'Vendor', date: new Date(details?.created_at).toLocaleString(), action: 'claim Created', remarks: 'Initial submission' }
        ],
        status: details?.status || 'PENDING'
      };
      
      setSelectedSubmission(submissionData);
      setShowAuditView(true);
      setShowViewModal(false);
      setActionRemarks('');
    } catch (err) {
      console.error('❌ Error fetching claim details:', err);
      const fallbackData = {
        id: item?.claim_code || item?.claimCode || pkgId,
        claimId: pkgId,
        vendor: item?.vendor_name || item?.vendor || 'N/A',
        projectType: item?.project_name || item?.project?.project_name || 'N/A',
        fileName: 'document.pdf',
        fileSize: 'N/A',
        fileUrl: null,
        history: [{ actor: 'System', date: new Date().toLocaleString(), action: 'claim Retrieved', remarks: 'Basic view' }],
        status: item?.status || 'PENDING'
      };
      setSelectedSubmission(fallbackData);
      setShowAuditView(true);
      setShowViewModal(false);
      setActionRemarks('');
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleOpenPdf = (submission) => {
    if (!submission.fileUrl) {
      alert('No document available for this claim');
      return;
    }
    if (!submission.claimId) {
      alert('Unable to determine claim ID for this document');
      return;
    }
    setPdfclaimId(submission.claimId);
    setShowPdfView(true);
  };

  const handleBackFromAudit = () => {
    setShowAuditView(false);
    setSelectedSubmission(null);
    setActionRemarks('');
  };

  const handleSendBack = async () => {
    if (!actionRemarks.trim()) {
      alert('Please enter remarks before sending back');
      return;
    }
    setProcessing(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token found');
      const pkgId = selectedSubmission?.claimId;
      if (!pkgId) throw new Error('claim ID not found');

      const response = await fetch(`${API_BASE}/claims/${pkgId}/sendback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ remarks: actionRemarks })
      });
      if (!response.ok) throw new Error('Failed to send back claim');
      setSuccessMessage(`claim ${selectedSubmission?.id || pkgId} has been sent back successfully!`);
      setShowAuditView(false);
      setSelectedSubmission(null);
      setActionRemarks('');
      await fetchData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('❌ Error sending back:', err);
      alert('Failed to send back claim: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleForward = async () => {
    if (!actionRemarks.trim()) {
      alert('Please enter remarks before forwarding');
      return;
    }
    setProcessing(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token found');
      const pkgId = selectedSubmission?.claimId;
      if (!pkgId) throw new Error('claim ID not found');

      const response = await fetch(`${API_BASE}/claims/${pkgId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ remarks: actionRemarks })
      });
      if (!response.ok) throw new Error('Failed to forward claim');
      setSuccessMessage(`claim ${selectedSubmission?.id || pkgId} has been forwarded successfully!`);
      setShowAuditView(false);
      setSelectedSubmission(null);
      setActionRemarks('');
      await fetchData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('❌ Error forwarding:', err);
      alert('Failed to forward claim: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessAction = async () => {
    if (!selectedItem || !processAction) {
      alert('Please select an action');
      return;
    }
    if (processAction === 'ASSIGN' && !selectedTargetUserId) {
      alert('Please select an officer to assign');
      return;
    }
    if (!processRemarks || processRemarks.trim().length < 3) {
      alert('Remarks are mandatory and must be at least 3 characters');
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token found');

      const pkgId = selectedItem?.id || selectedItem?.claim_id || selectedItem?.ID;
      if (!pkgId) throw new Error('claim ID not found');

      let endpoint = '';
      let body = { remarks: processRemarks };

      if (processAction === 'FORWARD') {
        endpoint = `${API_BASE}/claims/${pkgId}/forward`;
      } else if (processAction === 'SENDBACK') {
        endpoint = `${API_BASE}/claims/${pkgId}/sendback`;
      } else if (processAction === 'RESUBMIT') {
        endpoint = `${API_BASE}/claims/${pkgId}/resubmit`;
      } else if (processAction === 'ASSIGN') {
        endpoint = `${API_BASE}/claims/${pkgId}/assign`;
        body.target_user_id = parseInt(selectedTargetUserId);
      } else if (processAction === 'PULLBACK') {
        endpoint = `${API_BASE}/claims/${pkgId}/pull-back`;
      }

      console.log(`📤 Sending ${processAction} request to:`, endpoint);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to process claim');
      }
      const result = await response.json();
      console.log('✅ Process successful:', result);

      const actionLabel = processAction === 'RESUBMIT' ? 'resubmitted' : processAction.toLowerCase() + 'ed';
      setSuccessMessage(`claim ${selectedItem.claim_code || selectedItem.claimCode || pkgId} has been ${actionLabel} successfully!`);
      setShowProcessModal(false);
      setSelectedItem(null);
      setProcessAction('');
      setProcessRemarks('');
      setSelectedTargetUserId('');
      await fetchData();
      if (['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole)) {
        await fetchInboxStats();
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('❌ Error processing claim:', err);
      alert(`Failed to process claim: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const filteredItems = claims.filter(item => {
    const searchTermLower = searchTerm.toLowerCase();
    const pkgCode = item.claim_code || item.claimCode || item.id || '';
    const projectName = item.project_name || item.project?.project_name || '';
    const vendorName = item.vendor_name || item.vendor || '';
    const poNumber = item.po_number || item.po?.po_number || '';
    
    const matchesSearch = 
      pkgCode?.toLowerCase().includes(searchTermLower) ||
      projectName?.toLowerCase().includes(searchTermLower) ||
      vendorName?.toLowerCase().includes(searchTermLower) ||
      poNumber?.toLowerCase().includes(searchTermLower);
    
    const matchesStatus = filterStatus ? 
      (item.status || '').toUpperCase() === filterStatus.toUpperCase() : 
      true;
    
    return matchesSearch && matchesStatus;
  });

  const StatusBadge = ({ status }) => {
    const statusMap = {
      'PENDING': { color: '#f59e0b', bg: '#fef3c7' },
      'SUBMITTED': { color: '#3b82f6', bg: '#dbeafe' },
      'IN_PROGRESS': { color: '#8b5cf6', bg: '#ede9fe' },
      'COMPLETED': { color: '#10b981', bg: '#d1fae5' },
      'APPROVED': { color: '#10b981', bg: '#d1fae5' },
      'CLEARED': { color: '#10b981', bg: '#d1fae5' },
      'RETURNED': { color: '#ef4444', bg: '#fee2e2' },
      'SENT_BACK': { color: '#ef4444', bg: '#fee2e2' },
      'REJECTED': { color: '#ef4444', bg: '#fee2e2' },
    };
    const style = statusMap[status?.toUpperCase()] || { color: '#6b7280', bg: '#f3f4f6' };
    return (
      <span className="px-3 py-1 rounded-pill fw-semibold" style={{ backgroundColor: style.bg, color: style.color, fontSize: '0.75rem' }}>
        {status || 'Unknown'}
      </span>
    );
  };

  const StatCard = ({ icon, label, value, subtitle, color }) => {
    const colors = {
      blue: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
      yellow: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
      green: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
      red: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
      purple: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' }
    };
    const style = colors[color] || colors.blue;
    return (
      <div className="col-xl-2 col-lg-3 col-md-4 col-sm-6 mb-3">
        <div className="card h-100 border-0 shadow-sm hover-scale" style={{ borderRadius: '12px' }}>
          <div className="card-body p-3">
            <div className="d-flex align-items-center">
              <div className="rounded-3 p-3 me-3" style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}>
                {React.cloneElement(icon, { style: { color: style.text, fontSize: '1.5rem' } })}
              </div>
              <div>
                <h6 className="text-muted mb-0" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                  {label}
                </h6>
                <h3 className="mb-0 fw-bold" style={{ color: style.text, fontSize: '1.75rem' }}>
                  {value}
                </h3>
                {subtitle && <small className="text-muted" style={{ fontSize: '0.65rem' }}>{subtitle}</small>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchData}>
            <i className="bi bi-arrow-counterclockwise me-1"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  // Inline PDF view
  if (showPdfView && pdfclaimId) {
    return (
      <PdfViewerPage
        claimId={pdfclaimId}
        onBack={() => setShowPdfView(false)}
      />
    );
  }

  // Audit View
  if (showAuditView && selectedSubmission) {
    const daysElapsed = Math.floor(Math.random() * 10) + 1;
    return (
      <div className="container-fluid p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <SubmissionAudit
          submission={selectedSubmission}
          daysElapsed={daysElapsed}
          actionRemarks={actionRemarks}
          onRemarksChange={setActionRemarks}
          onBack={handleBackFromAudit}
          onOpenPdf={handleOpenPdf}
          onSendBack={handleSendBack}
          onForward={handleForward}
          hasDigitalSignature={userRole === 'jdinfra' || userRole === 'apts'}
        />
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="container-fluid p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show" role="alert" style={{ 
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          minWidth: '300px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
        }}>
          <i className="bi bi-check-circle-fill me-2"></i>
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
        </div>
      )}

      {/* Header */}
      <div className="rounded-4 p-4 mb-4" style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}>
        <div className="d-flex flex-wrap justify-content-between align-items-center">
          <div>
            <h2 className="mb-1 fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-speedometer2"></i>
              {roleDisplayName} Dashboard
            </h2>
            <p className="text-white-50 small mb-0">
              <i className="bi bi-person-circle me-1"></i>
              {userDisplayName} • {roleDescription}
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <button className="btn btn-light btn-sm fw-semibold" onClick={() => {
              fetchData();
              if (['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole)) fetchInboxStats();
              if (userRole === 'admin' || userRole === 'vendor') fetchPurchaseOrders();
            }} style={{ borderRadius: '8px' }}>
              <i className="bi bi-arrow-counterclockwise me-1"></i> Refresh
            </button>
            <span className="badge bg-white text-dark p-2 fw-semibold" style={{ borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '0.85rem' }}>
              <i className="bi bi-calendar3 me-1 text-primary"></i>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <StatCard icon={<i className="bi bi-box-seam"></i>} label="Total Items" value={stats.total} color="blue" />
        <StatCard icon={<i className="bi bi-clock-history"></i>} label="Pending" value={stats.pending} color="yellow" />
        <StatCard icon={<i className="bi bi-check-circle-fill"></i>} label="Completed" value={stats.completed} color="green" />
        <StatCard icon={<i className="bi bi-arrow-return-left"></i>} label="Returned" value={stats.returned} color="red" />
        <StatCard icon={<i className="bi bi-graph-up-arrow"></i>} label="In Progress" value={stats.inProgress} color="purple" />
        {/* Purchase Order Stats for Admin/Vendor */}
        {(userRole === 'admin' || userRole === 'vendor') && (
          <StatCard 
            icon={<i className="bi bi-receipt"></i>}
            label="Purchase Orders"
            value={purchaseOrders.length}
            subtitle={`${purchaseOrders.filter(po => po.status === 'ACTIVE').length} active`}
            color="blue"
          />
        )}
      </div>

      {/* Inbox Stats for Officers */}
      {['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole) && inboxStats.total > 0 && (
        <div className="row g-3 mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <div className="card-body p-3">
                <h6 className="fw-bold text-dark mb-3">
                  <i className="bi bi-inbox-fill text-primary me-2"></i> Inbox Summary
                </h6>
                <div className="d-flex flex-wrap gap-4">
                  <div><span className="text-muted small">Total in Inbox</span><h4 className="fw-bold text-primary">{inboxStats.total || 0}</h4></div>
                  <div><span className="text-muted small">Pending Action</span><h4 className="fw-bold text-warning">{inboxStats.pending || 0}</h4></div>
                  <div><span className="text-muted small">Returned</span><h4 className="fw-bold text-danger">{inboxStats.returned || 0}</h4></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="row g-3 mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <h6 className="fw-bold text-dark mb-0 me-2">
                  <i className="bi bi-lightning-fill text-primary me-1"></i> Quick Actions
                </h6>
                <div className="d-flex flex-wrap gap-2">
                  {userRole === 'vendor' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate('/vendor/claims')}>
                        <i className="bi bi-box-seam me-1"></i> View All claims
                      </button>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => navigate('/vendor/claims/create')}>
                        <i className="bi bi-upload me-1"></i> Submit claim
                      </button>
                    </>
                  )}
                  {['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole) && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/${userRole === 'apts' ? 'manager' : 'officer'}/inbox`)}>
                        <i className="bi bi-inbox-fill me-1"></i> Inbox
                      </button>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => navigate(`/${userRole === 'apts' ? 'manager' : 'officer'}/outbox`)}>
                        <i className="bi bi-check-circle-fill me-1"></i> Outbox
                      </button>
                    </>
                  )}
                  {userRole === 'admin' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/users')}>
                        <i className="bi bi-people-fill me-1"></i> Manage Users
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/vendors')}>
                        <i className="bi bi-building me-1"></i> Manage Vendors
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/workflows')}>
                        <i className="bi bi-diagram-3-fill me-1"></i> Workflows
                      </button>
                      {/* PO Management */}
                      <button className="btn btn-outline-primary btn-sm" onClick={() => navigate('/admin/purchase-orders')}>
                        <i className="bi bi-receipt me-1"></i> Manage POs
                      </button>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => navigate('/admin/purchase-orders/create')}>
                        <i className="bi bi-plus-circle me-1"></i> Create PO
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-white border-0"><i className="bi bi-search text-muted"></i></span>
                <input type="text" className="form-control border-0" placeholder="Search by code, project, vendor, or PO..." 
                       value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ backgroundColor: '#f8fafc' }} />
              </div>
            </div>
            <div className="col-md-4">
              <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ backgroundColor: '#f8fafc', border: 'none' }}>
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="APPROVED">Approved</option>
                <option value="RETURNED">Returned</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLEARED">Cleared</option>
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-outline-secondary w-100" onClick={() => { setSearchTerm(''); setFilterStatus(''); }} style={{ borderRadius: '8px' }}>
                <i className="bi bi-funnel me-1"></i> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th className="px-4 py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-hash me-1"></i> ID / Code
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-folder me-1"></i> Project
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-building me-1"></i> Vendor
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-receipt me-1"></i> PO
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-circle me-1"></i> Status
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-diagram-3 me-1"></i> Current Step
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-file-earmark me-1"></i> Files
                  </th>
                  <th className="py-3 text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-calendar me-1"></i> Date
                  </th>
                  <th className="px-4 py-3 text-end text-secondary fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-gear me-1"></i> Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-5">
                      <div className="text-muted">
                        <i className="bi bi-inbox fs-1 d-block mx-auto mb-3 opacity-25"></i>
                        <p className="mb-0 fw-semibold">No items found</p>
                        <small>Try adjusting your search or filters</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const pkgId = item?.id || item?.claim_id || item?.ID;
                    const pkgCode = item?.claim_code || item?.claimCode || pkgId || 'N/A';
                    const projectName = item?.project_name || item?.project?.project_name || 'N/A';
                    const vendorName = item?.vendor_name || item?.vendor || item?.vendor_id || 'N/A';
                    const poNumber = item?.po_number || item?.po?.po_number || 'N/A';
                    const currentStep = item?.current_step?.step_name || item?.current_step_name || 'Not Started';
                    const fileCount = item?.files?.length || 0;
                    const createdDate = item?.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A';
                    
                    return (
                      <tr key={pkgId || index} className="border-bottom" style={{ borderColor: '#f1f5f9' }}>
                        <td className="px-4 py-3">
                          <span className="fw-semibold text-primary" style={{ fontSize: '0.85rem' }}>{pkgCode}</span>
                        </td>
                        <td className="py-3" style={{ fontSize: '0.85rem' }}>{projectName}</td>
                        <td className="py-3" style={{ fontSize: '0.85rem' }}>{vendorName}</td>
                        <td className="py-3" style={{ fontSize: '0.85rem' }}>{poNumber}</td>
                        <td className="py-3"><StatusBadge status={item.status} /></td>
                        <td className="py-3" style={{ fontSize: '0.85rem' }}>{currentStep}</td>
                        <td className="py-3">
                          {fileCount > 0 ? (
                            <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                              <i className="bi bi-file-earmark-pdf-fill me-1"></i> {fileCount}
                            </span>
                          ) : <span className="badge bg-light text-secondary">0</span>}
                        </td>
                        <td className="py-3" style={{ fontSize: '0.8rem' }}>{createdDate}</td>
                        <td className="px-4 py-3 text-end">
                          <div className="d-flex gap-1 justify-content-end flex-wrap">
                            <button className="btn btn-sm btn-outline-primary" style={{ borderRadius: '6px' }}
                                    onClick={() => handleViewClaim(item)} disabled={loadingItemId === pkgId || !pkgId}>
                              {loadingItemId === pkgId ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-eye me-1"></i>}
                              View
                            </button>
                            {item.status?.toUpperCase() === 'RETURNED' && userRole === 'vendor' && (
                              <button className="btn btn-sm btn-primary" style={{ borderRadius: '6px' }}
                                      onClick={() => navigate(`/vendor/claims/${pkgId}/resubmit`)}>
                                <i className="bi bi-arrow-counterclockwise me-1"></i> Resubmit
                              </button>
                            )}
                            {['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole) && (
                              <button className="btn btn-sm btn-primary" style={{ borderRadius: '6px' }}
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setShowProcessModal(true);
                                        setProcessAction('');
                                        setProcessRemarks('');
                                        setSelectedTargetUserId('');
                                      }}>
                                <i className="bi bi-tasks me-1"></i> Process
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---- MODALS ---- */}

      {/* View Modal */}
      {showViewModal && selectedItem && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content" style={{ borderRadius: '12px' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-eye text-primary me-2"></i>
                  claim Details: {selectedItem.claim_code || selectedItem.claimCode || selectedItem.id || 'N/A'}
                </h5>
                <button type="button" className="btn-close" onClick={() => { setShowViewModal(false); setSelectedItem(null); }}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">claim Code</label><p className="fw-bold mb-0">{selectedItem.claim_code || selectedItem.claimCode || 'N/A'}</p></div></div>
                  <div className="col-md-6"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">Status</label><p className="mb-0"><StatusBadge status={selectedItem.status} /></p></div></div>
                  <div className="col-md-6"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">Project</label><p className="fw-bold mb-0">{selectedItem.project_name || selectedItem.project?.project_name || 'N/A'}</p></div></div>
                  <div className="col-md-6"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">Vendor</label><p className="fw-bold mb-0">{selectedItem.vendor_name || selectedItem.vendor || 'N/A'}</p></div></div>
                  <div className="col-md-6"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">PO</label><p className="fw-bold mb-0">{selectedItem.po_number || selectedItem.po?.po_number || 'N/A'}</p></div></div>
                  <div className="col-md-6"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">Current Step</label><p className="fw-bold mb-0">{selectedItem.current_step?.step_name || selectedItem.current_step_name || 'Not Started'}</p></div></div>
                  <div className="col-md-6"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">Created Date</label><p className="fw-bold mb-0">{selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString() : 'N/A'}</p></div></div>
                  <div className="col-12"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">Attached Files</label>
                    {selectedItem.files && selectedItem.files.length > 0 ? (
                      <div className="mt-2">
                        {selectedItem.files.map((file, idx) => {
                          const fileId = file.id || file.file_id || file.ID;
                          const pkgId = selectedItem.id || selectedItem.claim_id || selectedItem.ID;
                          return (
                            <div key={idx} className="d-flex align-items-center gap-2 mb-2 p-2 bg-white rounded border">
                              <i className="bi bi-file-earmark-pdf-fill text-danger fs-4"></i>
                              <div className="flex-grow-1">
                                <div className="fw-semibold">{file.original_name || file.filename || `File ${idx + 1}`}</div>
                                <small className="text-muted">{file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : ''}{file.mime_type ? ` • ${file.mime_type}` : ''}</small>
                              </div>
                              <button className="btn btn-sm btn-primary" onClick={() => handleDownloadFile(pkgId, fileId, file.original_name || file.filename)} disabled={downloading || !pkgId || !fileId}>
                                {downloading ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-download me-1"></i>} Download
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-muted mb-0">No files attached.</p>}
                  </div></div>
                  {selectedItem.remarks && (
                    <div className="col-12"><div className="bg-light p-3 rounded-3"><label className="text-muted small fw-semibold">Remarks</label><p className="mb-0">{selectedItem.remarks}</p></div></div>
                  )}
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
                <button className="btn btn-secondary" onClick={() => { setShowViewModal(false); setSelectedItem(null); }}>Close</button>
                {['pm', 'tpa', 'jdinfra', 'apts'].includes(userRole) && (
                  <button className="btn btn-primary" onClick={() => { setShowViewModal(false); setShowProcessModal(true); setProcessAction(''); setProcessRemarks(''); setSelectedTargetUserId(''); }}>
                    <i className="bi bi-tasks me-1"></i> Process
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process Modal */}
      {showProcessModal && selectedItem && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '12px' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-tasks text-primary me-2"></i>
                  Process claim: {selectedItem.claim_code || selectedItem.claimCode || selectedItem.id || 'N/A'}
                </h5>
                <button type="button" className="btn-close" onClick={() => { setShowProcessModal(false); setSelectedItem(null); setProcessAction(''); setProcessRemarks(''); setSelectedTargetUserId(''); }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">claim Details</label>
                  <div className="bg-light p-3 rounded-3">
                    <p className="mb-1"><strong>Project:</strong> {selectedItem.project_name || 'N/A'}</p>
                    <p className="mb-1"><strong>Vendor:</strong> {selectedItem.vendor_name || selectedItem.vendor || 'N/A'}</p>
                    <p className="mb-1"><strong>PO:</strong> {selectedItem.po_number || selectedItem.po?.po_number || 'N/A'}</p>
                    <p className="mb-0"><strong>Current Status:</strong> <StatusBadge status={selectedItem.status} /></p>
                    {selectedItem.workflow_id === null && (
                      <p className="mb-0 mt-2"><span className="badge bg-info">Manual Assignment</span></p>
                    )}
                  </div>
                </div>

                {processAction !== 'RESUBMIT' && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Action</label>
                    <select className="form-select" value={processAction} onChange={(e) => setProcessAction(e.target.value)}>
                      <option value="">Select Action...</option>
                      {selectedItem.workflow_id ? (
                        // Workflow mode
                        <>
                          <option value="FORWARD">Forward to Next Step</option>
                          <option value="SENDBACK">Send Back</option>
                        </>
                      ) : (
                        // Manual mode
                        <>
                          <option value="ASSIGN">Assign to Officer</option>
                          <option value="PULLBACK">Pull Back from Current Officer</option>
                          <option value="SENDBACK">Send Back to Vendor</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                {processAction === 'ASSIGN' && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Select Officer</label>
                    <select className="form-select" value={selectedTargetUserId} onChange={(e) => setSelectedTargetUserId(e.target.value)}>
                      <option value="">Choose an officer...</option>
                      {officers.map(o => (
                        <option key={o.id} value={o.id}>{o.name} ({o.email})</option>
                      ))}
                    </select>
                    <small className="text-muted">Only active officers are shown.</small>
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-semibold">Remarks <span className="text-danger">*</span></label>
                  <textarea className="form-control" rows="3" placeholder="Enter your remarks (minimum 3 characters)..." 
                            value={processRemarks} onChange={(e) => setProcessRemarks(e.target.value)}></textarea>
                  <small className="text-muted">Remarks are mandatory for all actions</small>
                </div>

                {processAction === 'FORWARD' && (
                  <div className="alert alert-info"><i className="bi bi-info-circle-fill me-2"></i>This will forward the claim to the next step in the workflow.</div>
                )}
                {processAction === 'SENDBACK' && (
                  <div className="alert alert-warning"><i className="bi bi-arrow-counterclockwise me-2"></i>This will send the claim back to the previous step or vendor.</div>
                )}
                {processAction === 'ASSIGN' && (
                  <div className="alert alert-info"><i className="bi bi-person-plus-fill me-2"></i>This will assign the claim to the selected officer (manual mode).</div>
                )}
                {processAction === 'PULLBACK' && (
                  <div className="alert alert-warning"><i className="bi bi-arrow-return-left me-2"></i>You will pull the claim back from the current assigned officer (only immediate sender can pull back).</div>
                )}
                {processAction === 'RESUBMIT' && (
                  <div className="alert alert-success"><i className="bi bi-arrow-counterclockwise me-2"></i>You are resubmitting this claim after revision.</div>
                )}
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
                <button className="btn btn-secondary" onClick={() => { setShowProcessModal(false); setSelectedItem(null); setProcessAction(''); setProcessRemarks(''); setSelectedTargetUserId(''); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleProcessAction}
                        disabled={!processAction || processing || !processRemarks || processRemarks.trim().length < 3 || (processAction === 'ASSIGN' && !selectedTargetUserId)}>
                  {processing ? <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</> : <><i className="bi bi-check-circle me-1"></i>Confirm</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- STYLES ---- */}
      <style>{`
        .hover-scale { transition: all 0.3s ease; }
        .hover-scale:hover { transform: translateY(-4px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1) !important; }
        .btn-primary { background-color: #2563eb; border-color: #2563eb; }
        .btn-primary:hover { background-color: #1d4ed8; border-color: #1d4ed8; }
        .btn-outline-primary { color: #2563eb; border-color: #2563eb; }
        .btn-outline-primary:hover { background-color: #2563eb; color: white; }
        .form-control:focus, .form-select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
        .badge { font-weight: 500; }
        .table-hover tbody tr:hover { background-color: #f8fafc; }
        .modal.show { display: block; }
        .modal { overflow-y: auto; }
      `}</style>
    </div>
  );
}