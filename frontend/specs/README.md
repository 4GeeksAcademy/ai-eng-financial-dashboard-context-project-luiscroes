# Frontend Data Contract

This document records the confirmed FastAPI contracts and the approved frontend derivations for the Date Range Filter, Anomaly Alerts, and B2B vs B2C Comparison. It specifies data behavior only; it does not implement requests or components.

**Contract labels:** **Confirmed API** means present in `backend/app/routes.py` and its Pydantic response models. **Frontend requirement** means approved behavior from [`components.md`](components.md), not a capability guaranteed by the API. No response envelopes or fields are added by this document.

## 1. API Endpoint Inventory

All listed routes use `GET`. JSON date fields are ISO date strings (`YYYY-MM-DD`); query dates use the same format. `OperationType` is `"income" | "outcome"`; `Category` is `"suppliers" | "sales" | "operational" | "administrative" | "others"`; `BusinessType` is `"B2B" | "B2C"`; `GroupBy` is `"day" | "week" | "month"`.

| Endpoint | Query parameters | Successful response | Relevant errors |
|---|---|---|---|
| `/api/metrics/facets` | None | One `FacetsResponse` / `MetricsFacets` object: `operation_types: OperationType[]`, `business_types: BusinessType[]`, `categories: Category[]`, `min_date: string`, `max_date: string`. | OpenAPI declares `200`; no parameter-validation `422` is generated for this parameterless route. Network/server errors remain possible. |
| `/api/metrics` | `start_date?: date`, `end_date?: date`, `category?: Category`, `operation_type?: OperationType`; all optional, no declared defaults besides omitted/`null`. | `FinancialMovement[]`; each element has required `create_date: string`, `amount: number`, `operation_type: OperationType`, `category: Category`, `business_type: BusinessType`. | Invalid dates or enum values receive FastAPI validation `422`. The API does not declare a start-before-end cross-field check. |
| `/api/metrics/summary` | `group_by?: GroupBy = "month"`; `start_date?: date`; `end_date?: date`; `category?: Category`; `operation_type?: OperationType`; `business_type?: BusinessType`. Other parameters are optional without a non-null default. | `MetricsSummaryItem[]`; each element has required `period: string`, `income: number`, `outcome: number`, `net: number`. Period key is date, ISO week, or year-month according to grouping. | Invalid date, enum, or grouping values receive FastAPI validation `422`. |
| `/api/metrics/alerts` | `threshold?: number = 0.3`, minimum `0`, **no declared maximum**; `group_by?: GroupBy = "month"`; optional `start_date`, `end_date`, `business_type`. | `AlertsResponse` / `MetricsAlert[]`; each element has required `period: string`, `outcome_total: number`, `baseline_average: number`, `increase_ratio: number`. | Negative threshold, invalid date, group, or business type receive FastAPI validation `422`. No threshold upper bound is declared. |
| `/api/metrics/categories/top` | `operation_type?: OperationType = "outcome"`; `limit?: integer = 5`, minimum `1`, maximum `20`; optional `start_date`, `end_date`, `business_type`. | `TopCategoriesResponse` / `TopCategoryItem[]`; each element has required `category: Category`, `operation_type: OperationType`, `total_amount: number`. | Invalid enum/date, non-integer limit, or limit outside `1..20` receive FastAPI validation `422`. |

The successful array responses above are JSON arrays, not `{ data: ... }` or other envelopes. `delta_pct` and `MetricsComparison` are not used by these three features. `/api/metrics/b2b`, `/api/metrics/b2c`, and `/api/metrics/comparison` exist but are not required for this design: segment queries use `business_type` on `summary` and `categories/top`, and the comparison chart is not a current-vs-previous-period calculation.

OpenAPI models and route definitions are in [`backend/app/routes.py`](../../backend/app/routes.py); router registration is in [`backend/app/main.py`](../../backend/app/main.py). Query-validation errors use FastAPI's `HTTPValidationError` schema (422). Error detail text is not stable UI copy. The routes do not declare custom error response models for unexpected server failures.

## 2. Date Range Filtering

### Confirmed API contract

- `GET /api/metrics/facets` returns the available filter values and unfiltered data boundaries as `min_date` and `max_date`. It takes no date arguments and does not recalculate facets for a selected range.
- `GET /api/metrics` accepts optional `start_date` and `end_date`. Each bound is inclusive: movements satisfy `create_date >= start_date` and/or `create_date <= end_date`.
- `summary`, `categories/top`, and `alerts` also accept optional date bounds. A single bound is valid. The API does not declare `start_date <= end_date` validation.

### Frontend request and interaction contract

- Store both input values as optional strings in `DateRangeFilter` (`start_date?`, `end_date?`). Send a defined value only, formatted `YYYY-MM-DD`; omit an unset key entirely. Never serialize `""`, `null`, or an invented range parameter.
- `App` owns the latest successful facets result and facets loading/error/retry state. Each page owns its own editable draft, applied range, pending request, last successful data, and data loading/error/retry state.
- Editing either date changes only the draft. Apply validates the draft and starts a refresh; the applied range and visible data change only after success. Reject impossible dates, dates outside inclusive facets bounds, and a two-bound range where `start_date > end_date`. Equal dates are valid.
- Clear empties both draft fields and immediately requests unfiltered data for the current view; it is not followed by an Apply requirement. On success, the applied range becomes `{}`. In Dashboard this refreshes `/api/metrics`; in Comparison it refreshes both category lists and both summaries without date parameters.
- On a data refresh failure, preserve the last successful applied range, header period, and data. Keep the attempted range in the draft, show an error and Retry, and have Retry repeat that exact request. On a facets failure, preserve prior facets bounds and applied filters and expose a facets Retry; if bounds have never loaded, date inputs remain disabled.
- An empty successful data response is an empty state, not an error and not permission to keep showing stale values after the request succeeded.

### Requests that use the applied range

- Dashboard: `/api/metrics` uses the dashboard's successfully applied dates. Its `FinancialMovement[]` supplies the current KPIs and existing monthly charts.
- Alerts: the visible-range `/api/metrics/summary` uses the alerts view's applied dates to calculate current outcome totals. A separate unfiltered monthly summary supplies history for the moving baseline; see §3.
- Comparison: both `/api/metrics/categories/top` requests and both `/api/metrics/summary` requests use identical comparison-view dates. The effective start is applied `start_date` or `min_date`; the effective end is applied `end_date` or `max_date`. Both bounds omitted means the complete facets interval; one omitted uses that facet boundary. Omitted query values remain omitted rather than being serialized as empty values.

## 3. Anomaly Alerts

### Confirmed endpoint behavior and limitation

`GET /api/metrics/alerts` is a real endpoint with the parameters and `MetricsAlert` response listed above. `detect_outcome_alerts` groups movements by the requested period, then compares each period's `outcome` with the arithmetic average of **all prior summary periods**. Zero-outcome prior periods are included. It emits an alert only if that cumulative baseline is positive and `increase_ratio > threshold`.

That cumulative baseline is **not** the course-required average of exactly the three immediately preceding complete calendar periods. The endpoint also suppresses zero-baseline cases rather than emitting the approved positive-spend anomaly. The UI must not display this endpoint's results as satisfying the course behavior or imply that its response is a three-period average.

### Approved frontend derivation

Use `/api/metrics/summary?group_by=month` rather than `/api/metrics/alerts` to derive compliant alert rows:

1. Fetch an unfiltered monthly summary for historical lookback, independently of the visible date filter. Fetch a second monthly summary with the visible date bounds for current outcomes. Each effective visible bound is the applied date or its corresponding facets bound; if both are omitted, the full-history summary can serve both roles.
2. Use facets `min_date` and `max_date` as the available history interval. A baseline month is complete only if its first and last calendar dates are within that interval. Exclude a first month when `min_date` is after its first day; do not create history before the minimum or after the maximum.
3. Build the calendar-month sequence between the available bounds. A month omitted from the summary **inside** this interval represents zero movements and contributes outcome `0` when it is eligible as a complete baseline month. Do not invent missing months outside the available interval.
4. For each visible candidate month, require exactly the three immediately preceding complete months. If fewer than three such months exist, do not calculate/show an alert for that candidate. Thus periods near the available history minimum remain ineligible until three full predecessors exist.
5. A selected range may start or end partway through a month. Include a candidate when that month intersects the inclusive effective visible range. Its current `outcome_total` includes only movements inside the selected dates; its baseline remains the three complete prior calendar months from the unfiltered history. Do not annualize or prorate the partial current month. With no bounds, the effective visible range is the facets interval.
6. If `baseline_average > 0`, derive `increase_ratio = (outcome_total - baseline_average) / baseline_average`. Raise an alert only when this value is strictly greater than threshold; equality does not qualify.
7. If baseline and current outcome are both zero, there is no alert. If baseline is zero and current outcome is positive, raise an anomaly and use a frontend display-row `increase_ratio: null`; show `New spend` in the Increase cell rather than infinity. This nullable value is a view-model choice, not an API field.

### Threshold, table, and mapping

- Backend threshold: optional ratio, default `0.3`, minimum `0`, no maximum. This is broader than the UI requirement.
- UI threshold: default `0.30`, minimum `0.01`, maximum `1.00`, step `0.01`. Every valid threshold change recalculates rows from loaded summaries immediately; it does not require Apply or another request. Values outside the range, non-finite values, or values off-step do not change the current threshold.
- The table has exactly four columns: **Period**, **Outcome total**, **Three-period average**, **Increase**.

| Source | Frontend display row / component prop |
|---|---|
| `MetricsSummaryItem.period` | `AnomalyAlertRow.period` and Period cell |
| Visible summary `outcome` for candidate month | `AnomalyAlertRow.outcome_total` |
| Mean of exactly three preceding complete monthly `outcome` values, inserting zero for absent in-range months | `AnomalyAlertRow.baseline_average` |
| Derived ratio for positive baseline; `null` for positive current outcome with zero baseline | `AnomalyAlertRow.increase_ratio`; show `ratio * 100` as a percent or `New spend` for the null case |
| Threshold state (`0.30` initially) | `AlertThresholdControl.value`; valid changes call `onChange`, `AnomalyAlertsSection.onThresholdChange` |

The row view type is specified in [`components.md`](components.md#2-anomaly-alerts). `MetricsAlert` remains the backend response type; do not assert that derived rows were returned by `/api/metrics/alerts`.

### Alert states and edge cases

- Loading: skeleton until required full-history and visible summaries are loaded; do not show stale rows as fresh success. Threshold control is disabled until data is available.
- Success with alerts: render the four cells per row. A zero-baseline positive outcome displays `New spend`.
- Empty: successful calculation with no qualifying alerts displays “No alerts”; if the visible range intersects no candidate month with three eligible predecessors, display “No eligible alert periods in range”.
- Error/partial failure: if either summary fails, preserve last successful rows, show an alert-specific error and Retry the failed request(s). A threshold edit does not erase the failure or turn it into an empty state.
- Edge case A: first `min_date` is day 15. Exclude that partial month as a baseline; candidates remain unavailable until three later complete months precede them.
- Edge case B: one month between the available bounds is missing from the summary. Insert outcome zero and include it in later three-month means.
- Edge case C: range begins mid-month. Use only in-range current outcomes but full prior months for baseline; omit a candidate only if it lacks three complete predecessors.
- Edge case D: zero baseline plus zero current outcome yields no alert; zero baseline plus positive current outcome yields an alert with `New spend`, not `Infinity`.
- Edge case E: ratio exactly equals threshold yields no alert; a strictly higher ratio does.

## 4. B2B vs B2C Comparison

### Requests and confirmed fields

For the comparison view, make these four logical requests using the same applied date range:

1. `GET /api/metrics/categories/top?business_type=B2B&operation_type=<selected>&limit=5[&start_date=...][&end_date=...]`
2. The same category request with `business_type=B2C`.
3. `GET /api/metrics/summary?business_type=B2B&group_by=month[&start_date=...][&end_date=...]`
4. The same summary request with `business_type=B2C`.

The top-category endpoint returns at most five `TopCategoryItem` entries with `category`, `operation_type`, and `total_amount`; it does not return percentages. The summary endpoint returns monthly rows with `period`, `income`, `outcome`, and `net`. Do not set `category` or `operation_type` on summary requests: both income and outcome totals are needed for denominators and the chart. The effective start is the applied `start_date` or facets `min_date`; the effective end is the applied `end_date` or facets `max_date`. Omitted date parameters stay omitted in the request.

### Operation selector and percentages

The table selector offers **Income** and **Outcome**, defaults to Income (`operation_type="income"`), and reloads both top-five lists when changed. The selector affects the tables and their percentages only, not the chart.

For each segment independently:

- Select the matching summary field: `income` for Income or `outcome` for Outcome.
- Sum that field across all monthly summary rows in the same effective date range. This is the denominator for the same segment's selected top-category rows.
- Compute each displayed percentage as `total_amount / segment_operation_total * 100`. The denominator includes all categories, not only the visible top five, so visible percentages need not total 100%.
- If the denominator is zero, percentage is unavailable. If that segment's summary request fails, preserve its successfully loaded category amounts but set their display percentages unavailable; never substitute `0%`. Keep B2B and B2C denominators separate.

### Monthly comparison chart

The chart is a fixed monthly chart, not `/api/metrics/comparison`. It always has four series sourced from summary values:

- `B2B Income` <- B2B summary `income`
- `B2C Income` <- B2C summary `income`
- `B2B Outcome` <- B2B summary `outcome`
- `B2C Outcome` <- B2C summary `outcome`

Align on every calendar month intersecting the effective date range, plus returned period keys; sort ascending by `YYYY-MM`. If a successfully loaded summary omits a month within that range, treat that segment's income and outcome for the month as zero. If a summary request failed, do not zero-fill that failed segment: show the chart error and Retry. If both successful summaries contain no movements/the effective range yields no months, show the chart empty state.

### Comparison props and states

Use the proposed `OperationTypeSelectorProps`, `SegmentCategoryTableProps`, `SegmentComparisonPoint`, `SegmentComparisonChartProps`, `B2BvsB2CComparisonPageProps`, and `DashboardComparisonSwitchProps` in [`components.md`](components.md#3-b2b-vs-b2c-comparison). The App-owned switch selects Dashboard or Comparison without React Router. Keep both pages mounted so their independent applied date ranges and loaded data survive switching.

| State | Tables | Chart |
|---|---|---|
| Loading | Keep category loading scoped to each segment; show category amounts when available. Show matching percentages as pending until that segment's summary succeeds. | Loading until both segment summaries succeed. |
| Success | Show up to five rows per segment and derived percentages. | Show four monthly series with aligned periods. |
| Empty | A successful empty category array gets an empty state for that segment; keep the other segment visible. | Empty state if the effective range has no months or both successful summaries contain no movements. |
| Partial API failure | Category request failure shows that segment's table error and retry. Summary failure preserves loaded category amounts but makes only that segment's percentages unavailable and offers summary retry. | If either summary fails, show chart error/retry; never present failure as a zero series. |

**Comparison edge cases**

1. B2C summary succeeds with a zero selected-operation total: keep returned category amounts and show percentages unavailable, not `0%` or `NaN`.
2. B2B summary fails while B2B top categories succeeded: preserve its amounts, mark its percentages unavailable, and show a chart error because one chart series source failed.
3. A successful segment omits a month included in the effective range: include the month and plot zero for that segment's Income and Outcome.
4. A range starts or ends mid-month: both top-category amounts and summary denominator use only movements inside the inclusive range; the chart includes the intersecting calendar month.
5. The top five account for less than the full operation total: percentages may sum to less than 100%; do not renormalize to the visible five.
6. The B2C category request fails while its summary succeeds: show B2C table error/retry; B2B table and chart may still succeed if both summary requests succeeded.

## 5. Data Transformation and Error Handling

### Explicit response-to-prop mapping

| API response | Transformation | Frontend destination |
|---|---|---|
| `FacetsResponse` | Retain `min_date`, `max_date`, and facet lists; expose facets loading/error/retry separately. | `DateRangeFilter.availableRange`; comparison page `availableRange`; props `facetsLoading`, `facetsError`, `onRetryFacets`. |
| `FinancialMovement[]` from `/api/metrics` | Filter already applied server-side; pass movements to `computeKPIs` and `computeMonthlyData`. | `KPIRow.metrics`; `IncomeOutcomeChart.data`; `ProfitPercentChart.data`; `DashboardHeader.period` from last successful applied range. |
| `MetricsSummaryItem[]` for alerts, unfiltered | Create monthly calendar sequence bounded by facets; add zero for missing months inside history; retain only complete prior months for baseline inputs. | Internal history input to alert derivation; not rendered as raw `MetricsAlert[]`. |
| `MetricsSummaryItem[]` for visible alert range | For each intersecting month, sum only in-range outcome; join to the prior three eligible complete months and derive baseline and ratio. | `AnomalyAlertRow[]` -> `AlertsTable.rows`; `null` ratio renders `New spend`. |
| `TopCategoryItem[]` for one segment | Pair with same-segment summary total for selected operation and effective range; derive `percentage`, or `null` when denominator unavailable/zero. | `CategoryShareRow[]` -> matching `SegmentCategoryTable.rows`. |
| Two `MetricsSummaryItem[]` comparison responses | Align monthly keys; map each segment's `income` and `outcome` to the four named series; successful missing months become zero. | `SegmentComparisonPoint[]` -> `SegmentComparisonChart.points`. |

API success types and parameter interfaces are in [`src/lib/api-types.ts`](../src/lib/api-types.ts) and [`src/lib/param-types.ts`](../src/lib/param-types.ts). Proposed component view types are in [`components.md`](components.md). Keep derived types distinct from the backend wire contract.

### Error-state rules

- Distinguish loading, successful empty, and failed requests; a failed request must never be represented as an empty array or zero-valued series.
- Preserve last successfully loaded data during refresh errors. Keep attempted filter state pending, show an actionable error, and Retry the same request. A successful empty response replaces old data with the correct empty state.
- Keep independent segment/category request failures local to the affected table. A failed summary invalidates that segment's percentages; a failed summary for either segment invalidates the complete comparison chart.
- For the date filter, retain previous facet bounds/applied dates if a later facets retry fails. If facets never loaded, keep date inputs unavailable.
- Treat FastAPI validation `422`, non-success HTTP status, network failure, and response parse failure as errors. Error copy may be user friendly; do not depend on backend validation message text. No API-specific retry guarantee exists: retry is a frontend action that repeats the request.

## 6. Representative Examples

The following are **illustrative, schema-conformant** examples, not promises about generated mock values. Arrays are shown directly because the API has no success envelope.

**Facets**

```json
{
  "operation_types": ["income", "outcome"],
  "business_types": ["B2B", "B2C"],
  "categories": ["administrative", "operational", "others", "sales", "suppliers"],
  "min_date": "2025-10-01",
  "max_date": "2026-09-28"
}
```

**Date-filtered movements request and response shape**

```http
GET /api/metrics?start_date=2026-03-01&end_date=2026-03-31
```

```json
[
  {
    "create_date": "2026-03-12",
    "amount": 1850.5,
    "operation_type": "income",
    "category": "sales",
    "business_type": "B2B"
  }
]
```

**Monthly summary used by charts/derivations**

```http
GET /api/metrics/summary?group_by=month&start_date=2026-03-01&end_date=2026-03-31&business_type=B2B
```

```json
[
  { "period": "2026-03", "income": 1850.5, "outcome": 420.0, "net": 1430.5 }
]
```

**Actual backend alert response shape (cumulative baseline, not course-compliant moving average)**

```json
[
  {
    "period": "2026-03",
    "outcome_total": 900.0,
    "baseline_average": 600.0,
    "increase_ratio": 0.5
  }
]
```

The frontend-required three-period row is derived from summary data. For this example, the three preceding monthly outcomes are `300`, `500`, and `1000`, so `baseline_average = (300 + 500 + 1000) / 3 = 600`. A current outcome of `900` gives `increase_ratio = (900 - 600) / 600 = 0.5`. These are valid summary input rows:

```json
[
  { "period": "2025-12", "income": 1200.0, "outcome": 300.0, "net": 900.0 },
  { "period": "2026-01", "income": 1400.0, "outcome": 500.0, "net": 900.0 },
  { "period": "2026-02", "income": 1800.0, "outcome": 1000.0, "net": 800.0 },
  { "period": "2026-03", "income": 2000.0, "outcome": 900.0, "net": 1100.0 }
]
```

The derived positive-baseline row has this view shape; it is not returned by `/api/metrics/alerts`:

```json
[
  {
    "period": "2026-03",
    "outcome_total": 900.0,
    "baseline_average": 600.0,
    "increase_ratio": 0.5
  }
]
```

When that derived row has zero baseline and positive outcome, the view model uses `"increase_ratio": null` and the table displays `New spend`; that nullable display shape is not a `MetricsAlert` API response.

**Top categories request and response shape**

```http
GET /api/metrics/categories/top?operation_type=income&limit=5&start_date=2026-03-01&end_date=2026-03-31&business_type=B2B
```

```json
[
  { "category": "sales", "operation_type": "income", "total_amount": 1850.5 }
]
```

A percentage such as `100%` is calculated only after summing B2B `income` from the matching March summary response; it is not present in the category response.

## 7. Verification and Traceability

### Testable acceptance criteria

| Requirement | Acceptance criterion | Verification evidence |
|---|---|---|
| Date facets and bounds | Facets supply date bounds; optional query bounds are serialized as ISO dates and are inclusive. Apply alone triggers a range refresh; Clear empties both dates and requests unfiltered data. | `backend/tests/test_routes.py::test_metrics_facets_returns_filter_options_and_date_range`, `test_metrics_endpoint_respects_date_filters`, `test_filter_movements_by_date_includes_range_edges`; future UI tests verify Apply/Clear and serialization. |
| Date validation/resilience | Invalid order/out-of-bounds drafts do not apply; facets and refresh failures preserve last successful filters/data and Retry repeats the failed request. | Future DateRangeFilter/page tests for invalid/equal/boundary dates, refresh failure, retry, and facets failure. |
| Alert contract distinction | The raw alerts route remains identified as cumulative and is never treated as the required moving average. | Inspect `detect_outcome_alerts` in `backend/app/routes.py`; compare with monthly summary response. |
| Three-month anomaly rule | Only candidates with exactly three immediately preceding complete months are evaluated; internal missing months are zero; zero baseline rules, partial visible current months, and strict `>` threshold behave as specified. | Future Vitest utility tests for a known three-month sequence, missing month, partial range, history-min boundary, zero/positive baselines, and threshold equality. Existing `financial-utils.test.ts` is the local calculation test pattern. |
| Threshold control | Default `0.30`, bounds `0.01..1.00`, step `0.01`; a valid change recalculates without a request. | Future component/unit tests for default, endpoints, off-step rejection, immediate recalculation, and request count. API OpenAPI separately confirms backend minimum `0`, default `0.3`, no maximum. |
| Comparison categories and shares | Two top-five requests use B2B/B2C and identical operation/date filters; each percentage denominator uses the same segment, operation and effective date range, includes all categories, and is unavailable after denominator failure/zero. | `backend/tests/test_routes.py::test_top_categories_returns_limited_sorted_categories`; future derivation tests for segment separation, income/outcome, range, zero denominator, top-five sum below 100%, and summary failure. |
| Comparison chart | Chart has four fixed monthly series from summary fields, aligns the full effective calendar range, zero-fills only successful missing months, and renders an error for a failed summary. | `test_metrics_summary_by_month_returns_balances`; future chart transform/component tests for period union/order, gaps, empty range, and one/both summary failures. |
| View navigation | App-owned Dashboard/Comparison switch works without React Router and preserves each view's date/data state while switching. | Future App integration test confirms view selection, no navigation dependency, and state retention. |
| Wire-contract integrity | JSON field names, enums, response array/object shapes and date formats match the OpenAPI components and Phase 2 types. | Regenerate/inspect `app.openapi()` and compare to `api-types.ts`/`param-types.ts`; retain backend `TestClient` endpoint tests. |

### Backend limitations not to ignore

- `/api/metrics/alerts` uses a cumulative average of all prior summary buckets, not a three-bucket moving average; it suppresses zero baselines. It cannot satisfy the approved UI rule as-is.
- `/api/metrics/summary` omits a period if it has no movements. The frontend must add zero buckets only inside the explicitly bounded available historical interval; it must not infer missing history beyond facets bounds.
- `/api/metrics/categories/top` returns amounts only, no percentage, and does not return all category totals when limited to five. The denominator must come from same-filter `summary`, not from the visible top-five subtotal.
- `FacetsResponse` bounds are global to available generated data, not selection-dependent. The API does not enforce date-range ordering; the UI validates it.
- The backend does not provide a B2B-vs-B2C chart response, a percentage field, or a three-period alert response. These are frontend composition/derivation requirements, not existing API features.

## Traceability References

- Approved component behavior: [`components.md`](components.md).
- Wire response types: [`../src/lib/api-types.ts`](../src/lib/api-types.ts).
- Query parameter types: [`../src/lib/param-types.ts`](../src/lib/param-types.ts).
- API routes, Pydantic models and calculations: [`../../backend/app/routes.py`](../../backend/app/routes.py); application registration: [`../../backend/app/main.py`](../../backend/app/main.py).
- Endpoint regression tests: [`../../backend/tests/test_routes.py`](../../backend/tests/test_routes.py).
- Project contract/test rules: [`../../.agents/rules/financial-contract-sync.md`](../../.agents/rules/financial-contract-sync.md), [`../../.agents/rules/affected-layer-tests.md`](../../.agents/rules/affected-layer-tests.md), [`../../.agents/rules/fastapi-routing-response-models.md`](../../.agents/rules/fastapi-routing-response-models.md).
