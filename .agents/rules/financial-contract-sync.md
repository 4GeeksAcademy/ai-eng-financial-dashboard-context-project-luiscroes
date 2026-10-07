# Financial Contract Synchronization

## Purpose

Prevent drift between the financial movement API contract and its frontend type.

## Scope

Descriptive paths: `frontend/src/App.tsx`, `frontend/src/lib/financial-types.ts`, `backend/app/routes.py`, `backend/tests/test_routes.py`.

## Rule

Keep financial movement JSON field names, allowed values, and date representation consistent between backend responses and frontend types. When changing the backend response contract, update the frontend type and relevant endpoint tests in the same change.

## Repository Evidence

- `frontend/src/lib/financial-types.ts` defines `FinancialMovement` and its allowed value unions.
- `frontend/src/App.tsx` consumes `/api/metrics` as `FinancialMovement[]`.
- `backend/app/routes.py` defines the Pydantic `FinancialMovement` model and the `/api/metrics` response model.
- `backend/tests/test_routes.py` verifies API response behavior and filters.