// src/components/PageLoader.jsx
export default function PageLoader({ fullScreen = false, label = 'Loading...' }) {
  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: fullScreen ? '100vh' : '40vh' }}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="spinner-border text-primary" />
        <p className="mt-3 text-muted small mb-0">{label}</p>
      </div>
    </div>
  );
}
