# Component Specifications

This document specifies proposed frontend behavior for the date filter, anomaly alerts, and B2B/B2C comparison. It does not implement components, requests, or backend changes.

`Confirmed` describes behavior present in the FastAPI routes and response models. `Proposed` describes the frontend contract required by the course. The UI should use the existing API and derived values without assuming response fields that do not exist.

## Shared Architecture

- `App` is the main application container. It owns `activeView: "dashboard" | "comparison"` and exposes a simple Dashboard / Comparison view switch; do not add or assume React Router. Keep both views mounted and hide the inactive view so each retains its own date filter and loaded data during the app session. The two views have independent date ranges.
- `DashboardPage` and `B2BvsB2CComparisonPage` own their view-specific applied filters and requests. Presentational components receive data and state through props, following the current `KPIRow` and chart patterns.
- Reuse the existing `Card`, `Skeleton`, `KPIRow`, `IncomeOutcomeChart`, and `ProfitPercentChart` patterns. The chart library is Recharts and the current components already distinguish loading from empty data.
- Reuse the Phase 2 types from `src/lib/api-types.ts` and `src/lib/param-types.ts`. Query dates are optional ISO date strings, and successful response dates are also strings in `YYYY-MM-DD` form.
- The course requires a three-period rolling alert baseline and comparison percentages, but neither behavior is fully supplied as such by the current API. The derived calculations below are frontend requirements, not additional backend fields. When implemented, financial derivations belong in testable utilities and follow the affected-layer Vitest rule.

## 1. Date Range Filter

### Contract and responsibilities

**Confirmed backend behavior**

- `GET /api/metrics/facets` takes no query parameters and returns `MetricsFacets`, including `min_date` and `max_date`. These bounds describe the available generated movements; facets are not recalculated for a selected range.
- `GET /api/metrics` accepts optional `start_date` and `end_date` query parameters and filters inclusively at both ends. `/api/metrics/summary`, `/api/metrics/categories/top`, and `/api/metrics/alerts` also accept optional date bounds.
- An omitted bound is allowed. The API does not declare a cross-field constraint requiring `start_date <= end_date`.

**Proposed components**

- `App` loads and owns the latest successful facets response and its loading/error state, exposing an explicit facets retry action to the active page.
- `DashboardPage` owns its draft range, last successfully applied range, pending refresh range, and dashboard data request state.
- `DateRangeFilter` renders two optional date inputs, range validation, Apply and Clear actions, facets feedback, refresh feedback, and explicit retry actions. It does not make requests.
- Existing `DashboardHeader` reflects the applied range. `KPIRow`, `IncomeOutcomeChart`, and `ProfitPercentChart` receive values recomputed from movements filtered by the applied range; keep their existing presentational responsibilities.

**Proposed props**

```ts
import type { FacetsResponse } from "../src/lib/api-types";
import type { DateRangeFilter as DateRange } from "../src/lib/param-types";

interface DateRangeFilterProps {
  draftRange: DateRange;
  appliedRange: DateRange;
  availableRange: Pick<FacetsResponse, "min_date" | "max_date"> | null;
  facetsLoading: boolean;
  facetsError: string | null;
  refreshLoading: boolean;
  refreshError: string | null;
  onDraftChange: (range: DateRange) => void;
  onApply: () => void;
  onClear: () => void;
  onRetryFacets: () => void;
  onRetryData: () => void;
}
```

**State and events**

- `App` owns facets loading/error state and the latest successful bounds. `DashboardPage` owns `draftRange`, `appliedRange`, `pendingRange`, the last successfully loaded dashboard data, and refresh loading/error state. `DateRangeFilter` is controlled by these props; input edits only call `onDraftChange` and never fetch.
- Load facets when the app initializes. On facets failure, preserve the last successful facets bounds and all applied filters, show the facets error, and expose `onRetryFacets`. If facets have never loaded, keep date inputs disabled until retry succeeds.
- Apply validates the draft, then submits only defined `start_date` and `end_date` strings. Do not serialize empty strings or add an unrequested query parameter. The applied range and visible dashboard data change only after that refresh succeeds.
- If a refresh fails, preserve the last successfully applied range, header label, and dashboard data. Keep the attempted range as the pending draft, show the error, and have `onRetryData` repeat that exact request. A later Apply replaces the pending request.
- Clear immediately empties both date fields and requests the unfiltered dashboard, without requiring a separate Apply click. On success, set the applied range to `{}` and refresh all dashboard values. If the refresh fails, retain the last successfully applied range/data while keeping the empty pending draft and offering Retry for that unfiltered request.
- A supplied date must be a real calendar date in `YYYY-MM-DD` form and fall within the inclusive facets bounds. Native date-input `min`/`max` are helpful but do not replace validation before Apply.
- Reject a range when both dates are set and `start_date > end_date`; keep the current applied range and data, explain the validation error, and do not start a request. Equal dates are valid and select that one day.
- After a successful refresh, use `/api/metrics` with the range, then continue using the existing `computeKPIs` and `computeMonthlyData` calculations. Update the header period label only to represent the successfully applied range.

**States and acceptance criteria**

- Loading: distinguish initial facets loading from dashboard refresh loading. Prevent applying dates until initial bounds arrive; during a refresh, keep the last successful dashboard visible with a pending indicator.
- Empty: if a successful response has no usable date bounds, show that filtering is unavailable. Current seeded data normally produces bounds, but the component must not render invalid date attributes.
- Error: facets errors preserve prior bounds/applied filters and expose `onRetryFacets`; dashboard refresh errors preserve prior data and expose `onRetryData`. Do not treat either failure as empty data.
- Empty dashboard result: after a successful filtered request with no movements, render the existing KPI/chart empty behavior, not the prior range's values.
- Invalid range: identify which values are outside the available bounds or when the start is after the end; do not emit `onApply`.
- Boundary: dates equal to `min_date` or `max_date` are valid and included. The backend's date filtering is inclusive.
- Acceptance: edits alone never refresh; Apply refreshes only a valid draft; Clear empties both inputs and refreshes unfiltered data; a failed refresh preserves the last successful applied range/data and Retry repeats the attempted range; a failed facets request preserves filters and has explicit Retry; equal-day and boundary-date ranges work.

**Concrete edge cases**

1. Start and end are the same available boundary date: accept and show movements from that date.
2. Start is one day later than end: show an inline validation message, do not call the page's apply handler, and preserve the prior results.
3. A draft date falls before `min_date` or after `max_date`: reject it even if entered programmatically or a browser ignores the input bounds.
4. Facets load successfully but have no usable range: render a deliberate unavailable state instead of passing empty bounds to date inputs.
5. Applying a valid new range fails: keep prior data/header range visible, retain the attempted draft, and make Retry repeat it.
6. Facets retry fails after bounds loaded once: retain those bounds and the applied range while showing the retry error.

## 2. Anomaly Alerts

### Contract and responsibilities

**Confirmed backend behavior**

- `GET /api/metrics/alerts` accepts optional `threshold` (minimum `0`, default `0.3`, no declared maximum), `group_by` (`day`, `week`, or `month`, default `month`), optional date bounds, and optional `business_type` (`B2B` or `B2C`). It returns an array of `MetricsAlert` with `period`, `outcome_total`, `baseline_average`, and `increase_ratio`.
- The current `detect_outcome_alerts` compares each outcome total with the average of **all preceding periods**, including zero-outcome periods. It only emits an alert when the baseline is positive and `increase_ratio > threshold`.
- This is **not** a three-period moving average. The course UI threshold is narrower than the API: `0.01` through `1.00`, default `0.30`, step `0.01`.
- `GET /api/metrics/summary` returns `MetricsSummaryItem[]` with `period`, `income`, `outcome`, and `net`. It accepts `group_by`, date bounds, and `business_type`, so its `outcome` series can support a frontend rolling calculation.

**Proposed components**

- `AnomalyAlertsSection` coordinates threshold control, request states, and the alert table. The page/container owns threshold, visible date range, full-history summary data, visible-range summary data, and retry state.
- `AlertThresholdControl` is controlled by its parent. It uses a numeric/range control with minimum `0.01`, maximum `1.00`, step `0.01`, and initial value `0.30`. The value is a ratio (`0.30` displays as `30%`). There is no separate Apply action for threshold changes.
- `AlertsTable` renders exactly four columns: Period, Outcome total, Three-period average, and Increase. Display finite `increase_ratio * 100` as a percentage. For zero baseline with positive outcome, display `New spend` in the Increase cell; do not render infinity or imply a numeric API ratio.

**Proposed props**

```ts
interface AnomalyAlertRow {
  period: string;
  outcome_total: number;
  baseline_average: number;
  /** Frontend-derived ratio; null when zero baseline makes a finite ratio undefined. */
  increase_ratio: number | null;
}

interface AlertThresholdControlProps {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

interface AlertsTableProps {
  rows: AnomalyAlertRow[];
}

interface AnomalyAlertsSectionProps {
  rows: AnomalyAlertRow[];
  threshold: number;
  loading: boolean;
  error: string | null;
  onThresholdChange: (value: number) => void;
  onRetry: () => void;
}
```

`AnomalyAlertRow` is a frontend-derived view model with the displayed measurements of an alert; nullable `increase_ratio` is only for zero-baseline presentation and is not an API response type. Do not pass the current `/api/metrics/alerts` result through as if its cumulative `baseline_average` satisfied the course requirement.

**State, data, and interactions**

- Keep threshold state in the page/container, initialized to `0.30`. The control accepts only finite hundredth increments in `[0.01, 1.00]`. Each valid change recalculates rows immediately from loaded summaries; it does not make a new request or wait for Apply. Invalid values do not change the threshold or rows. Display the ratio value as a percentage (`0.30` as `30%`).
- Use monthly calendar periods for the initial feature, matching the backend default; there is no grouping selector. Fetch an unfiltered `/api/metrics/summary?group_by=month` for historical baselines, independently of the visible date range. Fetch a second summary with the visible date bounds for current-period outcomes. With no visible bounds, the same full-history response can serve both purposes.
- Define the available history interval by facets `min_date` and `max_date`. A baseline month is complete only if its first and last calendar days are inside that interval. If `min_date` falls after the first day of its month, exclude that month from baseline history. Do not create periods before the available minimum or after the available maximum.
- Build every calendar month between the first and last available history months. A missing month inside that interval means no movements and contributes an outcome of zero; it is eligible as a baseline month if its entire calendar interval is available. Do not count missing months outside the available history interval.
- For a candidate month, require exactly the three immediately preceding complete calendar months. If fewer than three exist after applying the minimum-date rule, do not calculate an alert for that candidate. The earliest possible alert month is therefore the fourth complete historical month; no shorter or cumulative baseline is substituted.
- A selected range can begin or end partway through a month. Include a candidate if its calendar month intersects the inclusive visible range (omitted bounds use facets bounds); its `outcome_total` is the sum only for dates in the visible range. Its baseline still uses the three complete preceding calendar months from the unfiltered historical summary. Thus a visible partial month is compared as a partial current total against full preceding months, without annualization or prorating.
- When the baseline is positive, calculate `increase_ratio = (outcome_total - baseline_average) / baseline_average` and raise an alert only when `increase_ratio > threshold`. Equality does not alert.
- When baseline is zero and current outcome is zero, do not raise an alert. When baseline is zero and current outcome is positive, raise an anomaly, set the frontend-derived `increase_ratio` to `null`, and display `New spend`; a finite ratio is undefined. This nullable view value is not an API field.
- The current `/api/metrics/alerts` endpoint does **not** implement the required three-period moving average: it uses a cumulative historical average and suppresses alerts when baseline is zero. Never present its results as compliant. The compliant source is the frontend calculation from `/api/metrics/summary`; this specification does not change the backend contract.

**States and acceptance criteria**

- Loading: show a section/table skeleton until both full-history and visible-range summaries load; disable threshold input until data is available. Threshold changes after load recalculate locally without a request.
- Empty: show a no-alerts state when valid summaries produce no qualifying months. If the visible range intersects no month with three eligible preceding complete months, show a distinct “No eligible alert periods in range” state. A partial visible month is still eligible when its three complete predecessors exist.
- Error: if either summary request fails, preserve last successful rows, show an alert-specific error, and expose Retry for the failed request(s). Retry repeats the failed data request(s); a threshold change alone never clears the error or presents failed data as empty.
- Threshold boundary: accept `0.01` and `1.00`, all increments of `0.01` between them, and default to `0.30`; reject out-of-range or off-step values.
- Baseline boundary: with zero baseline and zero current outcome, no alert; with zero baseline and positive outcome, alert with the Increase cell shown as `New spend`.
- Acceptance: each candidate uses exactly its three immediately preceding complete monthly periods; missing months inside available history count as zero; no alert is calculated until three complete predecessors exist; partial visible months use only selected-range outcome totals; rows appear only for months intersecting the visible range; the threshold comparison is strictly greater-than; the four table columns and loading/empty/error states are stable.

**Concrete edge cases**

1. The visible range starts mid-month: use only movements from the selected start date onward for that month's outcome, but use three complete earlier months for its baseline.
2. `min_date` is the 15th of a month: that partial first month is not a baseline period; no candidate can alert until it has three later complete predecessor months.
3. A month between the available minimum and maximum has no summary row: insert it as a zero-outcome month in the calendar sequence and include it in a later baseline.
4. Fewer than three complete months exist before a candidate: omit its alert calculation, including dates near the historical minimum.
5. Baseline and current outcome are both zero: no alert. If baseline is zero and current outcome is positive, raise an anomaly and display `New spend`, not `Infinity`.
6. Increase equals the threshold: no alert; only a strictly greater ratio qualifies.

The current alerts endpoint remains noncompliant with the rolling requirement. The approved frontend behavior uses summary data and the deterministic monthly rules above; any future backend change requires a separate contract review.

## 3. B2B vs B2C Comparison

### Contract and responsibilities

**Confirmed backend behavior**

- `/api/metrics/categories/top` accepts `operation_type` (default `outcome`), `limit` (integer `1..20`, default `5`), optional inclusive date bounds, and optional `business_type`. Its array entries contain only `category`, `operation_type`, and `total_amount`; there is no percentage field.
- `/api/metrics/summary` accepts date bounds, `business_type`, and `group_by`; each entry contains `period`, `income`, `outcome`, and `net`.
- `/api/metrics/b2b` and `/api/metrics/b2c` return movement arrays. `/api/metrics/comparison` compares current versus previous date ranges for one optional business type; it does not directly compare B2B with B2C.

**Proposed components**

- `B2BvsB2CComparisonPage` owns its applied date range, selected table operation type, and request/loading/error state. It loads facets for the shared date filter and coordinates data for both segments.
- `DateRangeFilter` is reused with the same inclusive `min_date`/`max_date` behavior defined above.
- `OperationTypeSelector` provides Income / Outcome choices for both category table requests and their percentages. It defaults to Income.
- `SegmentCategoryTable` is rendered twice, once for `B2B` and once for `B2C`. It presents the top-five entries and a derived percentage for each category; it can retain amounts while marking percentages unavailable if that segment's summary request fails.
- `SegmentComparisonChart` renders four fixed monthly series: B2B Income, B2C Income, B2B Outcome, and B2C Outcome. It follows the existing Recharts components' data-through-props pattern; there is no chart-metric selector.
- `App` owns `activeView: "dashboard" | "comparison"` and renders a simple Dashboard / Comparison switch. Both view components remain mounted, with only the active view shown, so each preserves its independent date filter and loaded data. This explicitly avoids React Router.

**Proposed derived types and props**

```ts
import type {
  FacetsResponse,
  BusinessType,
  Category,
  OperationType,
} from "../src/lib/api-types";

interface CategoryShareRow {
  category: Category;
  operation_type: OperationType;
  total_amount: number;
  /** Derived share of this segment's total for the selected operation type. */
  percentage: number | null;
}

interface OperationTypeSelectorProps {
  value: OperationType;
  onChange: (value: OperationType) => void;
}

interface SegmentCategoryTableProps {
  businessType: BusinessType;
  rows: CategoryShareRow[];
  loading: boolean;
  categoryError: string | null;
  summaryError: string | null;
  onRetryCategories: () => void;
  onRetrySummary: () => void;
}

interface SegmentComparisonPoint {
  period: string;
  b2bIncome: number;
  b2cIncome: number;
  b2bOutcome: number;
  b2cOutcome: number;
}

interface SegmentComparisonChartProps {
  points: SegmentComparisonPoint[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

interface B2BvsB2CComparisonPageProps {
  availableRange: Pick<FacetsResponse, "min_date" | "max_date"> | null;
  facetsLoading: boolean;
  facetsError: string | null;
  onRetryFacets: () => void;
}

type ActiveView = "dashboard" | "comparison";

interface DashboardComparisonSwitchProps {
  value: ActiveView;
  onChange: (view: ActiveView) => void;
}
```

`CategoryShareRow.percentage` and `SegmentComparisonPoint` are proposed frontend-derived types, not backend response models. The comparison page receives facets state from `App` and owns its range draft/applied values, selected operation type, fetched data, pending/error states, and retry callbacks for endpoint requests.

**Data dependencies and derivation**

- Render an Income / Outcome selector above the tables, initially set to `income`. On selection change, reload both category lists and recalculate the matching percentage for each segment. This selector does not change the chart, which always shows both income and outcome series.
- Fetch `/api/metrics/categories/top` twice using the comparison view's same applied `start_date`, `end_date`, selected `operation_type`, and `limit=5`, once per `business_type`. These responses provide category identifiers and `total_amount`; they do not provide percentages.
- Fetch `/api/metrics/summary` twice, once per business type, with the exact same date range and fixed `group_by=month`. If both date bounds are omitted, the effective date range is the full facets interval (`min_date` through `max_date`). For Income, each table denominator is the sum of that segment's `income` over the effective date range. For Outcome, use that segment's `outcome` over the same range. Thus denominator segment, operation, and date range exactly match the category amount.
- Derive each row's percentage as `total_amount / matching_segment_operation_total * 100`. The denominator covers all categories for that segment and operation type, not only the top five, so visible percentages need not sum to 100%.
- If a segment's summary request fails, preserve its successfully fetched category amounts and show every percentage in that segment as unavailable (`null`); never substitute `0%`. If its denominator is successfully computed as zero, likewise show unavailable percentage. Never divide by zero or display `NaN`/`Infinity`.
- The chart uses only monthly summary fields `income` and `outcome`, yielding four named series: `B2B Income`, `B2C Income`, `B2B Outcome`, `B2C Outcome`. It has no metric selector and does not use `/api/metrics/comparison`.
- Align chart data on the union of monthly `period` keys from both successful summaries and all calendar months intersecting the effective date range (facets bounds when no range is applied). Sort ascending by year-month. For a successful response, a missing month within that range means no movements and is plotted as zero for that segment's income and outcome. Do not replace a failed summary with zero data.
- Do not use `MetricsComparison` for the B2B/B2C chart: its current/previous values describe two time ranges within one query, not two business segments.

**States and acceptance criteria**

- Loading: category and summary requests may finish independently per segment. Keep table loading scoped to category requests; show category amounts as they arrive. Until its matching summary is ready, show that segment's percentages as loading/unavailable. The chart loads until both summary requests finish.
- Empty: show an empty state for a segment with a successful empty category response while keeping its counterpart visible. Show an empty chart when the selected range contains no months or both successful summaries contain no movements; otherwise render all range months, including zero-valued missing months.
- Error: a category request failure shows that table's error and retry. A summary failure preserves already loaded category amounts, marks only the affected segment's percentages unavailable, and provides summary retry. If either summary for the chart fails, show a chart error/retry instead of zero-filling the failed segment.
- Boundary dates: apply the view's date range inclusively to both segment top-category and summary requests. Dates equal to facet bounds are valid. The comparison view keeps its own range when switching views.
- Acceptance: the view switch is an App-owned Dashboard / Comparison control with no router; tables start in Income mode and let users select Outcome; both segment lists request at most five categories with identical applied dates; each percentage uses that segment's selected operation total across the same dates; a failed summary never becomes 0%; the chart always has the four monthly Income/Outcome series; successful missing months align to zero; failed series display an error; loading/empty/error states remain distinct.

**Concrete edge cases**

1. A segment has zero total for the selected operation type: retain category amounts, but display unavailable percentages rather than zero or a division result.
2. One segment's summary request fails after its categories load: retain amounts for that table, show unavailable percentages with a retry, and show chart error because the missing summary cannot be treated as zeros.
3. A successful segment's summary omits a month included in the range: add that month to the chart and plot zero for its Income and Outcome series.
4. The date range begins or ends mid-month: percentage denominator and category rows use only in-range movement totals; chart still includes that intersecting calendar month. With no bounds, use the full facets interval for both percentage denominators and chart months.
5. The top five cover less than the segment's full operation total: percentages may sum to less than 100%; do not renormalize to the visible rows.
6. A category request fails for B2C while B2B succeeds: show the B2C retry/error state and keep B2B results and chart available if both summaries succeeded.

**Resolved product decisions**

- Category percentages are the share of the same segment's total for the selected operation type over the applied inclusive date range. The API returns no percentage field; the UI derives this value from top-category amounts and summary totals.
- The comparison chart uses fixed monthly aggregation and always shows Income and Outcome for both segments. The Income / Outcome selector controls the category tables only and defaults to Income.
- The page is reached through the App-owned Dashboard / Comparison view switch. No router is introduced.

## Evidence References

- Frontend structure and current request/state ownership: `src/App.tsx`, `src/components/dashboard/dashboard-header.tsx`, `src/components/dashboard/kpi-row.tsx`, `src/components/dashboard/income-outcome-chart.tsx`, `src/components/dashboard/profit-percent-chart.tsx`.
- Existing visual/loading primitives and formatting/calculation patterns: `src/components/ui/card.tsx`, `src/components/ui/skeleton.tsx`, `src/lib/financial-utils.ts`.
- Typed contracts: `src/lib/api-types.ts`, `src/lib/param-types.ts`.
- FastAPI response models, route parameters, filtering, aggregation, and alert calculation: `../backend/app/routes.py`.
- Applicable project rules: `../.agents/rules/financial-contract-sync.md`, `../.agents/rules/affected-layer-tests.md`, and `../.agents/rules/fastapi-routing-response-models.md`.