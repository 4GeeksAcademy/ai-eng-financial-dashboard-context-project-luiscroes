# Current State

## Data and Interface

- The metrics endpoints generate 360 mock movements with seed `42` (30 for each of 12 months). The amount/category/type generation is seeded, while the movement years are derived from `date.today()`: months earlier than the current month use the current year; the current and later months use the previous year. Each movement day is selected from 1 through 28.
- The frontend currently consumes `/api/metrics`, computes KPI totals and monthly values, and displays those KPIs and charts. Its header period is fixed to `2024 - Full Year`.
- Consequently, the displayed year label is not derived from the date-dependent mock movement dates.

## Existing Backend Endpoints

In addition to `/health` and `/api/metrics`, `backend/app/routes.py` currently defines `/api/metrics/facets`, `/api/metrics/summary`, `/api/metrics/categories/top`, `/api/metrics/comparison`, `/api/metrics/alerts`, `/api/metrics/b2b`, and `/api/metrics/b2c`.

Evidence: `backend/app/routes.py`, `backend/tests/test_routes.py`, `frontend/src/App.tsx`, `frontend/src/components/dashboard/dashboard-header.tsx`, `frontend/src/components/dashboard/kpi-row.tsx`, `frontend/src/components/dashboard/income-outcome-chart.tsx`, `frontend/src/components/dashboard/profit-percent-chart.tsx`.