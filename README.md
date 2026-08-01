# Medical Roadmap Study

Tablet-first 16:10 study app prototype for Medical Roadmap.

## Run

```bash
npm install
npm run dev -- --port 5173
```

Open `http://localhost:5173`.

## Production

```bash
npm run build
npm start
```

The production server serves `dist/` and proxies `/medischedule-api` and `/mentoring-api` so the app can run on Render as a Node web service.

## Render

This repo includes `render.yaml`.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Runtime: Node 20+
- Set `APP_ADMIN_TOKEN` in Render. The same value is used as the tablet unlock/logout password.
- Set `MEDISCHEDULE_TOKEN`, `MENTORING_TOKEN`, `MEDIWEEKLY_TOKEN`, and `MEDIPENALTY_TOKEN` on the `medical-studycat-api` Web Service for each enabled integration. A missing or expired value causes the corresponding proxy endpoints to return `401`.
- The production build uses relative API paths such as `/app-api`, so the web app and realtime API run from the same Render service.

## Integrations

- Schedule: `VITE_MEDISCHEDULE_API_BASE` defaults to the local Vite proxy for `https://medischedule.kr/api`.
- Mentoring: `VITE_MENTORING_API_BASE` defaults to the local Vite proxy for `https://mentoring-api-6l1a.onrender.com`.
- For web deployments, keep integration credentials on the Node proxy with the server environment variables above. The `VITE_*_TOKEN` and browser storage options are intended only for direct/native or local development connections.
- App realtime: `VITE_APP_API_BASE` points to the Node server `/app-api`. It stores live student status, admin messages, reward settings, and streams updates with SSE.
- Native Android builds need `VITE_APP_API_BASE` to be a deployed HTTPS URL, for example `https://medical-studycat.onrender.com/app-api`.
- Optional admin protection: set `APP_ADMIN_TOKEN` on the server, then enter the same value in the admin login `app realtime token` field.
- Family app sync: Studycat publishes student study reports to `/app-api/family/report`; parent apps read `/app-api/family/snapshot` and `/app-api/family/events`.
- Optional parent protection: set `APP_PARENT_TOKEN` on the server and `VITE_STUDYCAT_PARENT_TOKEN` in the parent app.
