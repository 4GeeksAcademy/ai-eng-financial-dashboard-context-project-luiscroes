import type { BusinessType, GroupBy, OperationType } from "./api-types";

/** Optional inclusive date bounds used by metrics query parameters. */
export interface DateRangeFilter {
  /** Start date in ISO 8601 form (YYYY-MM-DD), inclusive. */
  start_date?: string;
  /** End date in ISO 8601 form (YYYY-MM-DD), inclusive. */
  end_date?: string;
}

/** Query parameters accepted by GET /api/metrics/alerts. */
export interface AlertsParams extends DateRangeFilter {
  /**
   * Relative increase threshold as a ratio. The backend minimum is 0, its
   * default is 0.3, and OpenAPI declares no maximum. The course UI requirement
   * is narrower: 0.01 through 1.0, default 0.3; that UI constraint is not an
   * API constraint.
   *
   * The course's three-period moving average is a behavioral requirement; the
   * API schema does not guarantee it. The current backend compares against
   * the average of all preceding periods.
   */
  threshold?: number;
  /** Time bucket; backend default is "month". */
  group_by?: GroupBy;
  /** Restrict alerts to one segment; omitted means both segments. */
  business_type?: BusinessType;
}

/** Query parameters accepted by GET /api/metrics/categories/top. */
export interface TopCategoriesParams extends DateRangeFilter {
  /** Operation to rank; backend default is "outcome". */
  operation_type?: OperationType;
  /**
   * Maximum number of returned categories. Must be an integer from 1 to 20;
   * backend default is 5.
   */
  limit?: number;
  /** Restrict totals to one segment; omitted means both segments. */
  business_type?: BusinessType;
}