export interface IndexAdjustmentResult {
  /** False when the data needed for this month's increase hasn't been published yet. */
  available: boolean;
  /** The % increase (e.g. 1.5 = +1.5%). Never interannual. */
  percentage: number | null;
  newRentAmount: number | null;
  /** First "YYYY-MM" whose index is still unpublished, when not available. */
  missingMonth?: string | null;
}
