---
name: financial-calculation-guardrails
description: "Use when reviewing or changing financial calculations, financial data contracts, or related tests in this dashboard."
---

# Financial Calculation Guardrails

## Objective and Invocation

Preserve the dashboard's implemented financial behavior and make calculation changes explicit and testable. Invoke this skill when reviewing or changing financial utilities, financial types, API response models, financial summaries, or their tests.

## Required Inputs

- `frontend/src/lib/financial-utils.ts` and `frontend/src/lib/financial-utils.test.ts`
- `frontend/src/lib/financial-types.ts` and the components or API consumer affected by the change
- `backend/app/routes.py` and `backend/tests/test_routes.py` when backend calculations or response contracts are involved
- Relevant files in `memory-bank/` and applicable rules in `.agents/rules/`
- The requested behavior and approval for any change to financial semantics

## Expected Outputs

- The exact existing formula and the source/test evidence for it
- A distinction between confirmed behavior, unspecified policy, and potential cross-layer inconsistency
- The smallest relevant test and validation plan
- Findings or proposed edits limited to the approved scope; never infer missing business policy

## Review Workflow

1. Trace the data from the frontend type through its consumer and, when relevant, to the backend response model and endpoint tests.
2. Record operation classification, aggregation period, formula, rounding, and date interpretation from code and tests before proposing changes.
3. Check empty input, zero income, outcomes greater than income, date boundaries, and the affected response contract where applicable.
4. Compare frontend and backend behavior without assuming that similarly named fields have identical precision or semantics.
5. Label every conclusion as confirmed behavior, unspecified policy, or potential inconsistency.
6. Request approval before any code or test change that changes, constrains, rounds, normalizes, or synchronizes financial results.
7. After approval, make the smallest change, add behavior-focused tests, and run the relevant validation commands below.

## Confirmed Existing Behavior

- `operation_type` is `income` or `outcome`. Frontend KPI totals are summed by that field; the monthly helper aggregates the same two totals. Category and business type do not alter those helper formulas.
- Frontend profit is `totalIncome - totalOutcome`. Profit percentage is `profit / totalIncome * 100` only when income is greater than zero; otherwise it is zero. A negative result is preserved, not clamped. Monthly aggregation follows the same rule. Empty KPI input returns zero metrics; empty monthly input returns no points.
- Frontend monthly keys use the year and month from `new Date(create_date)` via local date getters, sort by the `YYYY-MM` key, and display an `en-US` abbreviated month and year. The helper does not round its calculated totals or percentage. Display formatting separately rounds currency to whole dollars and percentages to one decimal place.
- Backend `FinancialMovement` uses a Python `date`, a `float` amount, and literal unions for operation, category, and business type. The amount model has no positivity constraint.
- Backend summaries group by ISO date, ISO week, or `%Y-%m` month. They calculate `net = income - outcome` and round summary values to two decimals. `calculate_net_value` also rounds to two decimals. Comparison percentage uses the absolute previous net and is `null` when the previous net is zero.
- Mock generation currently produces positive amounts and dates on days 1 through 28, but that sample data does not establish a positivity rule for all financial movements.

## Unspecified Policies and Potential Inconsistencies

- The business meaning and handling of negative movement amounts, refunds, and reversals are unspecified. Never assume all amounts are positive or assign negative amounts a new meaning.
- A required monetary precision or rounding policy is unspecified. Preserve each current path's behavior; do not add rounding or synchronize frontend and backend formulas automatically.
- The intended timezone for grouping API date strings is unspecified. Frontend date-only parsing followed by local getters may group a first-of-month date differently by runtime timezone. Report this as a risk; do not normalize to UTC or local time without approval.
- The frontend computes values without rounding while backend summary and net helpers round to two decimals. This may be intentional or may need product clarification; do not treat it as permission to change either side.
- The memory bank records date-dependent mock years while the dashboard header displays a fixed `2024 - Full Year` label. Treat this as a known presentation mismatch, not a calculation rule.

## Acceptance Criteria

- Every stated invariant is backed by current code, tests, or project documentation.
- Proposed tests assert observable financial results and cover the relevant zero, loss, aggregation, or date behavior without asserting implementation details.
- No new sign, precision, rounding, timezone, or cross-layer consistency policy is introduced implicitly.
- Any change affecting financial semantics has explicit user approval, with frontend/backend contract updates and tests only when included in the approved scope.
- Relevant tests, build/type checks, and diff checks pass; report warnings and any unverified layer.

## Validation Commands

Run checks for the affected layer:

```bash
cd frontend && npm test
cd frontend && npm run build
cd backend && pytest
git diff --check
```

Do not install test dependencies as part of validation without approval.