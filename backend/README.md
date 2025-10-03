# CoinGecko Demo Proxy + JSON Storage (Node.js)

## Requirements

- Node.js 18+

## Setup

1. Create `.env` in `backend/` with:

```
API_KEY=your_demo_api_key_here
PORT=4000
```

2. Install deps:

```powershell
cd backend
npm install
```

## Run

- Dev:

```powershell
npm run dev
```

- Prod:

```powershell
npm start
```

Server: `http://localhost:4000`

## Endpoints

- Health: `GET /health`
- CoinGecko ping (proxy): `GET /api/ping`
- Prices (proxy): `GET /api/price?ids=bitcoin,ethereum&vs_currencies=usd`
- List records: `GET /records`
- Add record: `POST /records` (JSON body is stored under `data`)
- Delete record: `DELETE /records/:id`

## Notes

- Uses header `x-cg-demo-api-key` for CoinGecko Demo API.
- Records stored at `backend/data/records.json` (auto-created).
- Keep your API key on the server-side; do not expose it in the browser.

## References

- CoinGecko Demo Auth: https://docs.coingecko.com/v3.0.1/reference/authentication
