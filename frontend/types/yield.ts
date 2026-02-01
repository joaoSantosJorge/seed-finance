// ============ Yield Metrics ============
export interface YieldMetrics {
  // Current
  currentAPY: number;
  currentAPYTrend: number;

  // Historical (by period)
  periodYield: bigint;
  periodAPY: number;

  // Breakdown
  invoiceYield: bigint;
  treasuryYield: bigint;

  // Projections
  projectedAnnualYield: bigint;

  // Comparison benchmarks
  benchmarks: YieldBenchmark[];
}

export interface YieldBenchmark {
  name: string;
  apy: number;
}

export interface FormattedYieldMetrics {
  currentAPY: string;
  currentAPYTrend: string;
  periodYield: string;
  periodAPY: string;
  invoiceYield: string;
  treasuryYield: string;
  projectedAnnualYield: string;
  benchmarks: YieldBenchmark[];
}

// ============ Chart Data ============
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface YieldChartData {
  invoiceYield: TimeSeriesPoint[];
  treasuryYield: TimeSeriesPoint[];
  total: TimeSeriesPoint[];
}

export interface PoolHistoryData {
  tvl: TimeSeriesPoint[];
  utilization: TimeSeriesPoint[];
  sharePrice: TimeSeriesPoint[];
}

export type TimePeriod = '7d' | '30d' | '90d' | '1y' | 'all';
