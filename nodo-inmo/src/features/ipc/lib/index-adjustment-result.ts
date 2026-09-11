export interface IndexAdjustmentResult {
  /** False when the data needed for this month's increase hasn't been published yet. */
  available: boolean;
  /** The single-month % increase (e.g. 1.5 = +1.5%). Never accumulated/interannual. */
  percentage: number | null;
  newRentAmount: number | null;
}
