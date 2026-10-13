# APTS Bills Tracking — Frontend

React 19 + Vite single-page app. Setup and run instructions are in the [root README](../README.md).

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api to http://localhost:5000)
npm run lint
npm run build    # production bundle in dist/ (served by the backend when NODE_ENV=production)
```

Notes:
- Pages are lazy-loaded per route; PDF.js loads only when a claim is opened.
- The access token is held in memory only; the session is restored from the HttpOnly refresh cookie.
- Optional settings: see `.env.example` (`VITE_API_BASE_URL`, `VITE_PROXY_TARGET`, `VITE_IDLE_TIMEOUT_MINUTES`).
