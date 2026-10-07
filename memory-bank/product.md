# Product

## Purpose

The application is a financial metrics dashboard. Its current interface presents a financial overview with total income, total outcome, profit, profit margin, and monthly income/outcome and profit-margin charts.

## Domain Concepts

- A financial movement has a creation date, amount, operation type, category, and business type.
- Operation types are `income` and `outcome`.
- Categories are `suppliers`, `sales`, `operational`, `administrative`, and `others`.
- Business types are `B2B` and `B2C`.

Evidence: `README.md`, `frontend/src/App.tsx`, `frontend/src/components/dashboard/kpi-row.tsx`, `frontend/src/components/dashboard/income-outcome-chart.tsx`, `frontend/src/components/dashboard/profit-percent-chart.tsx`, `frontend/src/lib/financial-types.ts`, `backend/app/routes.py`.