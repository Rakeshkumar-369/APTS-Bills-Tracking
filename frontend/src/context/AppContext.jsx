import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

// Mock Account Reference Matrix for sandbox environments - Added apts_manager
const MOCK_USERS = {
  vendor_user: {
    username: 'vendor_user',
    name: 'Akshara Enterprises',
    role: 'vendor',
    title: 'Vendor'
  },
  pm_user: {
    username: 'pm_user',
    name: 'Sri K. Srinivasa Rao',
    role: 'officer',
    title: 'PM'
  },
  tpa_user: {
    username: 'tpa_user',
    name: 'Vedic Systems Audit Node',
    role: 'officer',
    title: 'TPA'
  },
  jd_infra: {
    username: 'jd_infra',
    name: 'Sri M. Ravi Kumar',
    role: 'officer',
    title: 'JD-Infra',
    hasDigitalSignature: true
  },
  apts_manager: {
    username: 'apts_manager',
    name: 'Sri P. Venkataswamy',
    role: 'apts_manager',
    title: 'APTS Manager'
  }
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState([
    {
      id: 'NODE-837492',
      vendor: 'Akshara Enterprises',
      projectType: 'Fibre Grid Phase-II Connect',
      fileName: 'baseline_spec_v1.pdf',
      fileSize: '2.4 MB',
      fileUrl: '',
      status: 'Pending Verification (PM Desk)',
      currentStage: 'PM',
      dateArrivedAtCurrentStage: new Date().toISOString().split('T')[0],
      history: [
        {
          actor: 'Akshara Enterprises (Vendor Node)',
          action: 'claim Dispatched & Logged',
          date: new Date().toISOString().split('T')[0],
          remarks: 'Initial particulars baseline documentation mapping.'
        }
      ]
    }
  ]);

  // Auth processing core handler
  const login = (username, password) => {
    // Both form entries and bypass button nodes pass the key string here directly
    const foundUser = MOCK_USERS[username];
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  // Capture structural real file objects or fall back to system mocks
  const submitParticulars = (projectType, fileObject, fileSize, vendorRemarks) => {
    let realFileUrl = '';
    let displayFileName = 'particulars_dump.pdf';
    let displayFileSize = '0.00 MB';

    if (fileObject && typeof fileObject === 'object') {
      realFileUrl = URL.createObjectURL(fileObject);
      displayFileName = fileObject.name;
      displayFileSize = fileSize || `${(fileObject.size / (1024 * 1024)).toFixed(2)} MB`;
    }

    const newSubmission = {
      id: `NODE-${Math.floor(100000 + Math.random() * 900000)}`,
      vendor: user ? user.name : 'Unknown Vendor',
      projectType,
      fileName: displayFileName,
      fileSize: displayFileSize,
      fileUrl: realFileUrl,
      status: 'Pending Verification (PM Desk)',
      currentStage: 'PM',
      dateArrivedAtCurrentStage: new Date().toISOString().split('T')[0],
      history: [
        {
          actor: `${user ? user.name : 'Vendor Node'}`,
          action: 'claim Dispatched & Logged',
          date: new Date().toISOString().split('T')[0],
          remarks: vendorRemarks
        }
      ]
    };

    setSubmissions([newSubmission, ...submissions]);
  };

  const processWorkflowMovement = (submissionId, remarks, actionType) => {
    setSubmissions(prevSubmissions => 
      prevSubmissions.map(sub => {
        if (sub.id !== submissionId) return sub;

        let nextStage = sub.currentStage;
        let nextStatus = sub.status;
        let actionLabel = '';

        if (actionType === 'FORWARD') {
          if (sub.currentStage === 'PM') {
            nextStage = 'TPA';
            nextStatus = 'Pending Verification (TPA Desk)';
            actionLabel = 'Approved & Forwarded to TPA';
          } else if (sub.currentStage === 'TPA') {
            nextStage = 'JD-Infra';
            nextStatus = 'Pending Verification (JD-Infra Desk)';
            actionLabel = 'Cleared by Auditor & Forwarded to JD-Infra';
          } else if (sub.currentStage === 'JD-Infra') {
            nextStage = 'APTS_MANAGER';
            nextStatus = 'Digitally Signed & Forwarded to APTS Manager';
            actionLabel = 'Digitally Signed & Forwarded to APTS Manager';
          } else if (sub.currentStage === 'APTS_MANAGER') {
            nextStage = 'APPROVED_FINAL';
            nextStatus = 'Approved & APTS Operation Cleared';
            actionLabel = 'Acknowledged, Settled & Disbursed by APTS';
          }
        } else if (actionType === 'SENDBACK') {
          if (sub.currentStage === 'APTS_MANAGER') {
            nextStage = 'JD-Infra';
            nextStatus = 'Returned Back to JD-Infra for Clarification';
            actionLabel = 'Returned Back to JD-Infra Desk';
          } else if (sub.currentStage === 'JD-Infra') {
            nextStage = 'TPA';
            nextStatus = 'Returned Back to TPA for Clarification';
            actionLabel = 'Returned Back to TPA Desk';
          } else if (sub.currentStage === 'TPA') {
            nextStage = 'PM';
            nextStatus = 'Returned Back to PM for Clarification';
            actionLabel = 'Returned Back to PM Desk';
          } else if (sub.currentStage === 'PM') {
            nextStage = 'VENDOR_REVISION';
            nextStatus = 'Rejected/Returned Back to Vendor Node';
            actionLabel = 'Returned Back to Vendor for Core Revision';
          }
        }

        return {
          ...sub,
          currentStage: nextStage,
          status: nextStatus,
          dateArrivedAtCurrentStage: new Date().toISOString().split('T')[0],
          history: [
            ...sub.history,
            {
              actor: `${user.name} (${user.title} Desk)`,
              action: actionLabel,
              date: new Date().toISOString().split('T')[0],
              remarks: remarks
            }
          ]
        };
      })
    );
  };

  const calculateDaysElapsed = (startDateString) => {
    if (!startDateString) return 0;
    const start = new Date(startDateString);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    return Math.floor(diffTime / (1024 * 60 * 60 * 24)) || 0;
  };

  return (
    <AppContext.Provider value={{ 
      user, 
      submissions, 
      login, 
      logout, 
      submitParticulars, 
      processWorkflowMovement, 
      calculateDaysElapsed 
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}