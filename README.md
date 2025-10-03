# Crypto Favorites App

Backend (Node.js + Express) proxies CoinGecko Demo API and stores simple JSON. Frontend (React + TypeScript + Vite) consumes backend via `/api`.

## Project layout
- `backend/` – Express server, `/api/*` proxy, JSON storage
- `frontend/` – React + TS app (Vite)

## Setup
### Backend
```bash
cd backend
npm install
# .env -> API_KEY=your_demo_api_key
npm run dev
```
Runs on `http://localhost:4000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173` (proxy `/api` to backend).

## Notes
- Do not commit secrets; keep keys in `backend/.env`.
- Prices auto-refresh every 15 min; use global Refresh for manual update.
- Favorites and caches are stored in `localStorage` for instant hydration.

## Git
- Root `.gitignore` excludes node_modules, builds, env files, and OS junk.
- If `backend/` is missing in commits:
  - Ensure it is not a nested Git repo (`backend/.git`). Remove if present.
  - Git ignores empty folders; add `.gitkeep` in empty dirs like `backend/data/`.
