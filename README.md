# scan_comiccon_geekcon_frontend

Mobile-first frontend scanner dashboard for ComicCon x GeekCon cashiers.

## What Is Included

- Next.js App Router project.
- Current API integrations are preserved:
  - `POST /api/v1/crm/login/`
  - `POST /api/v1/crm/refresh/`
  - `POST /api/v1/crm/cashier/scanner/`
  - `GET /api/v1/crm/cashier/scanner/history/`
  - `GET /api/v1/crm/cashier/scanner/search/`
- Token storage via `react-secure-storage` + auto refresh interceptor.
- Scanner-only UI on `/`: camera scanner, manual ticket ID input, and scan history.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm run start
```

## Notes

- API host is configured in `src/utils/api.jsx` as `https://api.geekcon.uz`.
- Pull-to-refresh for mobile is enabled via `GlobalPullToRefresh`.
# scan_comiccon_geekcon_frontend
