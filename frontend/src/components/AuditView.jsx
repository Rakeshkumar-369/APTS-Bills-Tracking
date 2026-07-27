// src/components/AuditView.jsx
import React from 'react';

export default function AuditView({
  submission,
  actionRemarks,
  onRemarksChange,
  onBack,
  onSendBack,
  onForward,
  onOpenPdf,
}) {
  if (!submission) return null;

  // Get activity trails from history or use defaults from image
  const activityTrails = submission.history || [
    { action: 'CREATE', remarks: '"dgfbgvhg"' },
    { action: 'SENDBACK', remarks: '"fgfcgbfhgh"' },
    { action: 'FORWARD', remarks: '"ghfghngjghjh"' },
  ];

  return (
    <div style={{ 
      backgroundColor: '#f1f5f9', 
      minHeight: '100vh',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* MAIN MENU - Top Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        padding: '16px 24px',
        marginBottom: '24px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <h6 style={{ 
          fontWeight: '700', 
          color: '#0f172a',
          margin: 0,
          fontSize: '0.875rem',
          letterSpacing: '0.5px'
        }}>MAIN MENU</h6>
        <div style={{ display: 'flex', gap: '28px' }}>
          <span style={{ 
            color: '#2563eb', 
            fontWeight: '600',
            fontSize: '0.875rem',
            cursor: 'pointer',
            paddingBottom: '2px',
            borderBottom: '2px solid #2563eb'
          }}>Dashboard</span>
          <span style={{ 
            color: '#64748b', 
            fontWeight: '500',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}>Inbox</span>
          <span style={{ 
            color: '#64748b', 
            fontWeight: '500',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}>Outbox</span>
          <span style={{ 
            color: '#64748b', 
            fontWeight: '500',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}>Match Invoices</span>
        </div>
      </div>

      {/* Main Card - Exactly matching the image */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        {/* Header - Auditing Node */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ←
            </button>
            <div>
              <h5 style={{ 
                margin: 0,
                fontWeight: '700',
                fontSize: '1rem',
                color: '#0f172a'
              }}>
                Auditing Node: {submission.id || 'APTS-2026-0003'}
              </h5>
              <span style={{ 
                fontSize: '0.875rem',
                color: '#475569'
              }}>
                {submission.vendor || 'Akshara Enterprises'} • {submission.projectType || 'APSDWAN Scope'}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* DOCUMENT claim - Matches image exactly */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px'
            }}>
              DOCUMENT claim
            </label>
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <span style={{ fontSize: '1.25rem' }}>📄</span>
                <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a' }}>
                  {submission.fileName || 'document.pdf'}
                </span>
                <span style={{ 
                  color: '#94a3b8', 
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  ({submission.fileSize || 'N/A'})
                </span>
              </div>
              {submission.fileUrl ? (
                <button
                  onClick={() => onOpenPdf(submission)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#eff6ff'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  View Document
                </button>
              ) : (
                <span style={{
                  color: '#ef4444',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>⚠️</span>
                  FILE MISSING
                </span>
              )}
            </div>
          </div>

          {/* Two Column Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px'
          }}>
            {/* Left Column - Preceding Activity Trails */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}>
                PRECEDING ACTIVITY TRAILS
              </label>
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 0',
                maxHeight: '280px',
                overflowY: 'auto'
              }}>
                {activityTrails.map((trail, index) => (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: index < activityTrails.length - 1 ? '1px solid #e5e7eb' : 'none'
                    }}
                  >
                    <span style={{
                      fontWeight: '700',
                      fontSize: '0.8125rem',
                      color: '#0f172a',
                      letterSpacing: '0.3px'
                    }}>
                      {trail.action}
                    </span>
                    <span style={{
                      color: '#475569',
                      fontSize: '0.8125rem'
                    }}>
                      {trail.remarks || `"${trail.action.toLowerCase()}"`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column - Workflow Lifecycle Audit Remarks */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}>
                WORKFLOW LIFECYCLE AUDIT REMARKS
              </label>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '180px',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  backgroundColor: '#fafbfc',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                placeholder="Enter analytical review logs, query specifics, or validation checks..."
                value={actionRemarks}
                onChange={(e) => onRemarksChange(e.target.value)}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginTop: '6px',
                fontStyle: 'italic'
              }}>
                * Action Remarks are mandatory if triggering a back-movement query response loop.
              </div>

              {/* Action Buttons - Matches image exactly */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '16px'
              }}>
                <button
                  onClick={onSendBack}
                  disabled={!actionRemarks.trim()}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    border: '2px solid #ef4444',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: actionRemarks.trim() ? 'pointer' : 'not-allowed',
                    opacity: actionRemarks.trim() ? 1 : 0.5,
                    transition: 'all 0.2s',
                    letterSpacing: '0.3px'
                  }}
                  onMouseEnter={(e) => {
                    if (actionRemarks.trim()) {
                      e.target.style.backgroundColor = '#fef2f2';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
                >
                  Send Back
                </button>
                <button
                  onClick={onForward}
                  disabled={!actionRemarks.trim()}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: actionRemarks.trim() ? 'pointer' : 'not-allowed',
                    opacity: actionRemarks.trim() ? 1 : 0.5,
                    transition: 'all 0.2s',
                    letterSpacing: '0.3px'
                  }}
                  onMouseEnter={(e) => {
                    if (actionRemarks.trim()) {
                      e.target.style.backgroundColor = '#1d4ed8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#2563eb';
                  }}
                >
                  Approve & Move
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}