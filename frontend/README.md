# Frontend (React + TypeScript)

## Setup
```powershell
cd frontend
npm install
```

## Run
```powershell
npm run dev
```
Open the printed local URL (default: http://localhost:5173).

## Features
- Search coins (top bar), click result to add to favorites
- Favorites page with live USD prices
- Balance page to enter holdings and see total value and a 30d chart

## Backend Proxy
The app calls the backend endpoints at `/api/*`. If the frontend and backend run on different ports, set up a dev proxy in `vite.config.ts` (not included here) or start the frontend from the same origin.
