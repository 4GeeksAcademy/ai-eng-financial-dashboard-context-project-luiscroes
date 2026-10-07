# Phase 2 Engineering Findings

## Proposed Rules

### 1. Keep the Frontend/Backend Financial Contract Synchronized

- **Priority:** MUST HAVE
- **Scope:** Financial movement API fields and allowed values shared by the frontend and backend.
- **Repository evidence:** `frontend/src/lib/financial-types.ts` defines `FinancialMovement`, including ISO-date string `create_date` and literal unions. `frontend/src/App.tsx` consumes `/api/metrics`. `backend/app/routes.py` defines the Pydantic model and the endpoint response model; `backend/tests/test_routes.py` verifies endpoint behavior.
- **Required behavior:** Preserve JSON field names, value sets, and date representation across both sides. When changing the backend response, update the frontend types and relevant endpoint tests in the same change.
- **Prevents:** Contract drift that breaks frontend filtering or calculations at runtime.
- **Recommended application type:** AutoAttached
- **Recommended globs:** `frontend/src/App.tsx`; `frontend/src/lib/financial-types.ts`; `backend/app/routes.py`; `backend/tests/test_routes.py`.

### 2. Follow the Existing FastAPI Routing and Response-Model Pattern

- **Priority:** USEFUL
- **Scope:** Backend API endpoint registration and response schemas.
- **Repository evidence:** `backend/app/main.py` creates the FastAPI application and includes the router. `backend/app/routes.py` defines an `APIRouter`, Pydantic models, and `response_model` declarations for metrics endpoints.
- **Required behavior:** Add API endpoints to the existing router and declare response models for metrics responses; keep router registration in `backend/app/main.py`.
- **Prevents:** Endpoints that are not registered with the app or metrics responses that bypass the established schema contract.
- **Recommended application type:** AutoAttached
- **Recommended glob:** `backend/app/**`.

### 3. Test Changes Using the Existing Suite for the Affected Layer

- **Priority:** USEFUL
- **Scope:** Frontend financial calculations and backend API behavior.
- **Repository evidence:** `frontend/src/lib/financial-utils.test.ts` uses Vitest for calculations and edge cases; `frontend/package.json` defines the test scripts. `backend/tests/test_routes.py` uses FastAPI `TestClient` for status, payload, filtering, and ordering checks.
- **Required behavior:** Extend the Vitest utility tests when changing financial calculations; extend the `TestClient` endpoint tests when changing API behavior or filters.
- **Prevents:** Regressions in calculations and API behavior that existing tests already exercise.
- **Recommended application type:** AutoAttached
- **Recommended globs:** `frontend/src/lib/**`; `backend/app/**`; `backend/tests/**`.

## Not Rules

The repository evidence does not justify global quote/semicolon formatting rules, mandatory component tests, coverage thresholds, a runtime validation library, or arbitrary dependency and file-organization restrictions.

## Operational Caution

This is not a coding rule: Phase 1 found that the backend `/health` and `/api/metrics` endpoints responded directly, and the frontend root returned HTTP 200, while Vite `/api/metrics` returned HTTP 502 and the frontend container timed out connecting to `backend:8000`. The runtime observations are recorded in `verification.md`; the proxy and service configuration are in `frontend/vite.config.ts` and `docker-compose.yml`. The evidence points to an inter-container networking issue in that environment. A repository code or configuration defect was not proven.