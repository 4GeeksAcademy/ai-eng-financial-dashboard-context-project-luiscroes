# Tests for the Affected Layer

## Purpose

Keep changes covered by the existing tests for the affected frontend or backend layer.

## Scope

Descriptive paths: `frontend/src/lib/**`, `backend/app/**`, `backend/tests/**`.

## Rule

When changing frontend financial calculations, add or update the corresponding Vitest utility tests. When changing backend API behavior or filters, add or update the corresponding FastAPI `TestClient` endpoint tests.

## Repository Evidence

- `frontend/src/lib/financial-utils.test.ts` uses Vitest for financial calculations and edge cases.
- `frontend/package.json` defines the frontend test scripts.
- `backend/tests/test_routes.py` uses `TestClient` to check endpoint status, payloads, filters, and ordering.