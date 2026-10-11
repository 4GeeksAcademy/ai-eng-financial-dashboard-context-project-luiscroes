/** Allowed values for a financial movement's operation_type field. */
export type OperationType = "income" | "outcome";

/** Categories returned by the financial metrics API. */
export type Category =
  | "suppliers"
  | "sales"
  | "operational"
  | "administrative"
  | "others";

/** Customer segments used to filter or group financial metrics. */
export type BusinessType = "B2B" | "B2C";

/** Time buckets accepted by summary and alerts endpoints. */
export type GroupBy = "day" | "week" | "month";

/** One movement returned by the metrics endpoints. */
export interface FinancialMovement {
  /** Calendar date in ISO 8601 form (YYYY-MM-DD). */
  create_date: string;
  /** Movement amount in the API's monetary units. */
  amount: number;
  /** Whether the amount is revenue or expenditure. */
  operation_type: OperationType;
  /** Financial category assigned to the movement. */
  category: Category;
  /** B2B or B2C customer segment. */
  business_type: BusinessType;
}

/** Filter options and the unfiltered movement date bounds. */
export interface MetricsFacets {
  operation_types: OperationType[];
  business_types: BusinessType[];
  categories: Category[];
  /** Earliest available movement date, inclusive, in YYYY-MM-DD form. */
  min_date: string;
  /** Latest available movement date, inclusive, in YYYY-MM-DD form. */
  max_date: string;
}

/** Summary totals for one day, ISO week, or calendar month. */
export interface MetricsSummaryItem {
  /** YYYY-MM-DD, YYYY-Www, or YYYY-MM, depending on group_by. */
  period: string;
  /** Sum of income amounts in the period. */
  income: number;
  /** Sum of outcome amounts in the period. */
  outcome: number;
  /** Net amount: income minus outcome. */
  net: number;
}

/** Total amount for one category and operation type. */
export interface TopCategoryItem {
  category: Category;
  operation_type: OperationType;
  /** Sum of movement amounts; the API does not return a percentage field. */
  total_amount: number;
}

/** Net values for the requested period and the immediately preceding period. */
export interface MetricsComparison {
  /** Net amount (income minus outcome) in the requested date range. */
  current_period: number;
  /** Net amount in the immediately preceding range of equal duration. */
  previous_period: number;
  /** Difference between current_period and previous_period. */
  delta_abs: number;
  /** Percentage change relative to the absolute previous net; null if it is zero. */
  delta_pct: number | null;
}

/** One outcome increase detected against the historical baseline. */
export interface MetricsAlert {
  /** Period label in the requested grouping. */
  period: string;
  /** Outcome total for the alert period. */
  outcome_total: number;
  /** Average outcome total across all preceding periods, including zero-outcome periods. */
  baseline_average: number;
  /** Relative increase as a ratio (for example, 0.3 means 30%). */
  increase_ratio: number;
}

/** Alias for the exact JSON object returned by GET /api/metrics/facets. */
export type FacetsResponse = MetricsFacets;

/** Alias for one entry in the JSON array returned by GET /api/metrics/alerts. */
export type AlertEntry = MetricsAlert;

/** GET /api/metrics/alerts returns an array, not an envelope object. */
export type AlertsResponse = AlertEntry[];

/** Alias for one entry in the JSON array returned by GET /api/metrics/categories/top. */
export type CategoryEntry = TopCategoryItem;

/** GET /api/metrics/categories/top returns an array, not an envelope object. */
export type TopCategoriesResponse = CategoryEntry[];