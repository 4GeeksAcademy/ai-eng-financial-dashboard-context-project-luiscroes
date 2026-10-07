# FastAPI Routing and Response Models

## Purpose

Keep API endpoint registration and response schemas consistent with the existing FastAPI structure.

## Scope

Descriptive path: `backend/app/**`.

## Rule

Add API endpoints to the existing `APIRouter` in `backend/app/routes.py` and declare response models for metrics responses. Keep router registration in `backend/app/main.py`.

## Repository Evidence

- `backend/app/main.py` creates the FastAPI app and includes the router from `backend.app.routes`.
- `backend/app/routes.py` defines the `APIRouter`, Pydantic response models, and `response_model` declarations for metrics endpoints.