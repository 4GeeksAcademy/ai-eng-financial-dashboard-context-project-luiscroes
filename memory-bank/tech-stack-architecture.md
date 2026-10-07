# Tech Stack and Architecture

## Technologies and Entry Points

- Frontend: React, TypeScript, Vite, Tailwind CSS, and Recharts. The browser entry is `frontend/src/main.tsx`, which mounts `frontend/src/App.tsx`.
- Backend: Python and FastAPI, served by Uvicorn. `backend/app/main.py` creates the app and registers the router defined in `backend/app/routes.py`.

## Data Flow and Boundaries

The frontend fetches `/api/metrics`; Vite proxies `/api` to `http://backend:8000`. The frontend computes KPI and monthly chart data in `frontend/src/lib/financial-utils.ts`; dashboard components receive the computed values through props. FastAPI defines the financial response models and metric endpoints in `backend/app/routes.py`.

## Development and Tests

- The documented development startup is `docker compose up --build` (`README.md`). Compose runs frontend and backend services (`docker-compose.yml`).
- Frontend tests use Vitest through scripts in `frontend/package.json`; financial utility tests are in `frontend/src/lib/financial-utils.test.ts`.
- Backend tests use pytest and FastAPI `TestClient` in `backend/tests/test_routes.py`. The README does not document a backend test command.

Evidence: `README.md`, `docker-compose.yml`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/financial-utils.ts`, `frontend/src/lib/financial-utils.test.ts`, `backend/requirements.txt`, `backend/app/main.py`, `backend/app/routes.py`, `backend/tests/test_routes.py`.