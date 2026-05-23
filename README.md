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

## Integrations

- Schedule: `VITE_MEDISCHEDULE_API_BASE` defaults to the local Vite proxy for `https://medischedule.kr/api`.
- Mentoring: `VITE_MENTORING_API_BASE` defaults to the local Vite proxy for `https://mentoring-api-6l1a.onrender.com`.
- If the mentoring API requires auth, set `VITE_MENTORING_TOKEN` or save a token in `localStorage` under `medical-study-mentor-token`.
