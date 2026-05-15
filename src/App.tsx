import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface BodyRecord {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPercent?: number;
  skeletalMuscleMassKg?: number;
}

interface DraftRecord {
  date: string;
  weightKg: string;
  bodyFatPercent: string;
  skeletalMuscleMassKg: string;
}

type MetricKey = "weightKg" | "bodyFatPercent" | "skeletalMuscleMassKg";

interface MetricConfig {
  key: MetricKey;
  averageKey: `${MetricKey}Average`;
  trendKey: `${MetricKey}Trend`;
  label: string;
  shortLabel: string;
  unit: "kg" | "%";
  accent: string;
  accentMuted: string;
  glow: string;
  minDomain?: number;
  maxDomain?: number;
  betterDirection: "down" | "up" | "neutral";
  emptyText: string;
}

interface ChartPoint {
  date: string;
  dayIndex: number;
  weightKg: number;
  bodyFatPercent?: number;
  skeletalMuscleMassKg?: number;
  weightKgAverage?: number;
  bodyFatPercentAverage?: number;
  skeletalMuscleMassKgAverage?: number;
  weightKgTrend?: number;
  bodyFatPercentTrend?: number;
  skeletalMuscleMassKgTrend?: number;
}

interface MetricSummary {
  latestDate?: string;
  latestValue?: number;
  sevenDayAverage?: number;
  latestTrend?: number;
  trendDeviation?: number;
  averageDeviation?: number;
  shortTermChange?: number;
  trendSlope?: number;
  recentVariability?: number;
  previousVariability?: number;
  sampleCount: number;
}

type ActiveSection = "analysis" | "entry";
type AnalyticsViewMode = "focus" | "analytics";
type TimeRange = "all" | "month" | "twoWeeks" | "week";
type Tone = "positive" | "negative" | "neutral";
type BadgeTone = "positive" | "warning" | "neutral";

interface StatusBadge {
  label: string;
  tone: BadgeTone;
  explanation: string;
  response: string;
}

interface SupportingMetricRow {
  label: string;
  meaning: string;
  value: string;
  tone: Tone;
}

interface HealthInsight {
  badges: StatusBadge[];
  supportingRows: SupportingMetricRow[];
  paragraph: string;
}

interface RangeOption {
  value: TimeRange;
  label: string;
  days?: number;
}

const STORAGE_KEY = "single-file-inbody-records";
const DAY_MS = 24 * 60 * 60 * 1000;

const metricConfigs: MetricConfig[] = [
  {
    key: "weightKg",
    averageKey: "weightKgAverage",
    trendKey: "weightKgTrend",
    label: "체중",
    shortLabel: "Weight",
    unit: "kg",
    accent: "#d8e7ff",
    accentMuted: "#84a8e8",
    glow: "rgba(132, 168, 232, 0.28)",
    betterDirection: "down",
    emptyText: "선택한 기간에 체중 기록이 없습니다.",
  },
  {
    key: "bodyFatPercent",
    averageKey: "bodyFatPercentAverage",
    trendKey: "bodyFatPercentTrend",
    label: "체지방률",
    shortLabel: "Fat",
    unit: "%",
    accent: "#d8c9ff",
    accentMuted: "#a999e5",
    glow: "rgba(169, 153, 229, 0.24)",
    minDomain: 0,
    maxDomain: 80,
    betterDirection: "down",
    emptyText: "선택한 기간에 체지방률 기록이 없습니다.",
  },
  {
    key: "skeletalMuscleMassKg",
    averageKey: "skeletalMuscleMassKgAverage",
    trendKey: "skeletalMuscleMassKgTrend",
    label: "골격근량",
    shortLabel: "Muscle",
    unit: "kg",
    accent: "#c6ead9",
    accentMuted: "#88c6aa",
    glow: "rgba(136, 198, 170, 0.22)",
    betterDirection: "up",
    emptyText: "선택한 기간에 골격근량 기록이 없습니다.",
  },
];

const timeRangeOptions: RangeOption[] = [
  { value: "all", label: "전체" },
  { value: "month", label: "1개월", days: 30 },
  { value: "twoWeeks", label: "2주", days: 14 },
  { value: "week", label: "7일", days: 7 },
];

const getTodayInputValue = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const createDraft = (): DraftRecord => ({
  date: getTodayInputValue(),
  weightKg: "",
  bodyFatPercent: "",
  skeletalMuscleMassKg: "",
});

const createId = (): string => {
  if ("randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const parseDate = (date: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
};

const hasValidOptionalMetric = (
  value: number | undefined,
  min: number,
  max: number,
): boolean =>
  value === undefined ||
  (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);

const isRecord = (value: unknown): value is BodyRecord => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<BodyRecord>;

  return (
    typeof record.id === "string" &&
    typeof record.date === "string" &&
    parseDate(record.date) !== null &&
    typeof record.weightKg === "number" &&
    Number.isFinite(record.weightKg) &&
    record.weightKg > 0 &&
    record.weightKg <= 500 &&
    hasValidOptionalMetric(record.bodyFatPercent, 0, 80) &&
    hasValidOptionalMetric(record.skeletalMuscleMassKg, 1, 200)
  );
};

const sortRecords = (records: BodyRecord[]): BodyRecord[] =>
  [...records].sort((a, b) => {
    const aTime = parseDate(a.date) ?? 0;
    const bTime = parseDate(b.date) ?? 0;
    return aTime - bTime;
  });

const loadRecords = (): BodyRecord[] => {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? sortRecords(parsed.filter(isRecord)) : [];
  } catch {
    return [];
  }
};

const validateDraft = (draft: DraftRecord): string | null => {
  if (parseDate(draft.date) === null) {
    return "날짜를 YYYY-MM-DD 형식으로 입력해 주세요.";
  }

  const weightKg = Number(draft.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
    return "체중은 현실적인 kg 숫자로 입력해 주세요.";
  }

  if (draft.bodyFatPercent.trim() !== "") {
    const bodyFatPercent = Number(draft.bodyFatPercent);
    if (!Number.isFinite(bodyFatPercent) || bodyFatPercent < 0 || bodyFatPercent > 80) {
      return "체지방률은 0에서 80 사이 숫자로 입력해 주세요.";
    }
  }

  if (draft.skeletalMuscleMassKg.trim() !== "") {
    const skeletalMuscleMassKg = Number(draft.skeletalMuscleMassKg);
    if (
      !Number.isFinite(skeletalMuscleMassKg) ||
      skeletalMuscleMassKg <= 0 ||
      skeletalMuscleMassKg > 200
    ) {
      return "골격근량은 현실적인 kg 숫자로 입력해 주세요.";
    }
  }

  return null;
};

const draftToRecord = (draft: DraftRecord, id = createId()): BodyRecord => ({
  id,
  date: draft.date,
  weightKg: Number(draft.weightKg),
  bodyFatPercent:
    draft.bodyFatPercent.trim() === "" ? undefined : Number(draft.bodyFatPercent),
  skeletalMuscleMassKg:
    draft.skeletalMuscleMassKg.trim() === ""
      ? undefined
      : Number(draft.skeletalMuscleMassKg),
});

const recordToDraft = (record: BodyRecord): DraftRecord => ({
  date: record.date,
  weightKg: String(record.weightKg),
  bodyFatPercent:
    record.bodyFatPercent === undefined ? "" : String(record.bodyFatPercent),
  skeletalMuscleMassKg:
    record.skeletalMuscleMassKg === undefined ? "" : String(record.skeletalMuscleMassKg),
});

const hasDateConflict = (
  records: BodyRecord[],
  selectedDate: string,
  editingId: string | null,
): boolean =>
  records.some((record) => record.date === selectedDate && record.id !== editingId);

const isFiniteNumber = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value);

const roundMetric = (value: number): number => Number(value.toFixed(2));

const getMetricValue = (record: BodyRecord | ChartPoint, metric: MetricConfig): number | undefined =>
  record[metric.key];

const average = (values: number[]): number | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const averageAbsoluteDelta = (values: number[]): number | undefined => {
  if (values.length < 2) {
    return undefined;
  }

  return average(values.slice(1).map((value, index) => Math.abs(value - values[index])));
};

const getRegression = (points: { dayIndex: number; value: number }[]) => {
  if (points.length < 2) {
    return undefined;
  }

  const count = points.length;
  const sumX = points.reduce((sum, point) => sum + point.dayIndex, 0);
  const sumY = points.reduce((sum, point) => sum + point.value, 0);
  const sumXY = points.reduce((sum, point) => sum + point.dayIndex * point.value, 0);
  const sumXX = points.reduce((sum, point) => sum + point.dayIndex ** 2, 0);
  const denominator = count * sumXX - sumX ** 2;

  if (denominator === 0) {
    return undefined;
  }

  const slope = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;
  return { slope, intercept };
};

const buildChartData = (records: BodyRecord[]): ChartPoint[] => {
  if (records.length === 0) {
    return [];
  }

  const sorted = sortRecords(records);
  const firstDate = parseDate(sorted[0].date) ?? 0;
  const basePoints: ChartPoint[] = sorted.map((record) => {
    const recordDate = parseDate(record.date) ?? firstDate;

    return {
      date: record.date,
      dayIndex: Math.round((recordDate - firstDate) / DAY_MS),
      weightKg: record.weightKg,
      bodyFatPercent: record.bodyFatPercent,
      skeletalMuscleMassKg: record.skeletalMuscleMassKg,
    };
  });

  const enrichedPoints = basePoints.map((point, index) => {
    const nextPoint: ChartPoint = { ...point };
    const movingWindow = basePoints.slice(Math.max(0, index - 6), index + 1);

    metricConfigs.forEach((metric) => {
      const windowAverage = average(
        movingWindow.map((item) => getMetricValue(item, metric)).filter(isFiniteNumber),
      );

      if (windowAverage !== undefined) {
        nextPoint[metric.averageKey] = roundMetric(windowAverage);
      }
    });

    return nextPoint;
  });

  metricConfigs.forEach((metric) => {
    const regression = getRegression(
      basePoints
        .map((point) => ({ dayIndex: point.dayIndex, value: getMetricValue(point, metric) }))
        .filter((point): point is { dayIndex: number; value: number } =>
          isFiniteNumber(point.value),
        ),
    );

    if (regression === undefined) {
      return;
    }

    enrichedPoints.forEach((point) => {
      point[metric.trendKey] = roundMetric(
        regression.slope * point.dayIndex + regression.intercept,
      );
    });
  });

  return enrichedPoints;
};

const filterChartDataByRange = (chartData: ChartPoint[], range: TimeRange): ChartPoint[] => {
  const rangeOption = timeRangeOptions.find((option) => option.value === range);

  if (chartData.length === 0 || rangeOption?.days === undefined) {
    return chartData;
  }

  const latestTime = parseDate(chartData[chartData.length - 1].date);
  if (latestTime === null) {
    return chartData;
  }

  const cutoffTime = latestTime - (rangeOption.days - 1) * DAY_MS;
  return chartData.filter((point) => {
    const pointTime = parseDate(point.date);
    return pointTime !== null && pointTime >= cutoffTime;
  });
};

const getVisibleValues = (points: ChartPoint[], metric: MetricConfig): number[] =>
  points
    .flatMap((point) => [point[metric.key], point[metric.averageKey], point[metric.trendKey]])
    .filter(isFiniteNumber);

const getYAxisDomain = (
  values: number[],
  metric: MetricConfig,
): [number, number] | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const minPadding = metric.unit === "%" ? 1 : 0.5;
  const singlePointPadding = metric.unit === "%" ? 2 : Math.max(1, Math.abs(min) * 0.02);
  const padding = spread === 0 ? singlePointPadding : Math.max(spread * 0.16, minPadding);
  const lower =
    metric.minDomain === undefined ? min - padding : Math.max(metric.minDomain, min - padding);
  const upper =
    metric.maxDomain === undefined ? max + padding : Math.min(metric.maxDomain, max + padding);

  return [Number(lower.toFixed(1)), Number(upper.toFixed(1))];
};

const buildMetricSummary = (chartData: ChartPoint[], metric: MetricConfig): MetricSummary => {
  const pointsWithValue = chartData.filter((point) => isFiniteNumber(point[metric.key]));

  if (pointsWithValue.length === 0) {
    return { sampleCount: 0 };
  }

  const latestPoint = pointsWithValue[pointsWithValue.length - 1];
  const latestValue = latestPoint[metric.key];
  const priorPoint =
    [...pointsWithValue]
      .reverse()
      .find((point) => latestPoint.dayIndex - point.dayIndex >= 7) ?? pointsWithValue[0];
  const latestTrend = latestPoint[metric.trendKey];
  const latestAverage = latestPoint[metric.averageKey];
  const priorValue = priorPoint[metric.key];
  const metricValues = pointsWithValue.map((point) => point[metric.key]).filter(isFiniteNumber);
  const recentValues = metricValues.slice(-7);
  const previousValues = metricValues.slice(-14, -7);
  const regression = getRegression(
    pointsWithValue
      .map((point) => ({ dayIndex: point.dayIndex, value: point[metric.key] }))
      .filter((point): point is { dayIndex: number; value: number } =>
        isFiniteNumber(point.value),
      ),
  );

  return {
    latestDate: latestPoint.date,
    latestValue,
    sevenDayAverage: latestAverage,
    latestTrend,
    trendDeviation:
      latestTrend === undefined || latestValue === undefined
        ? undefined
        : latestValue - latestTrend,
    averageDeviation:
      latestAverage === undefined || latestValue === undefined
        ? undefined
        : latestValue - latestAverage,
    shortTermChange:
      latestValue === undefined || priorValue === undefined ? undefined : latestValue - priorValue,
    trendSlope: regression?.slope,
    recentVariability: averageAbsoluteDelta(recentValues),
    previousVariability: averageAbsoluteDelta(previousValues),
    sampleCount: pointsWithValue.length,
  };
};

const formatMetric = (
  value: number | undefined,
  metric: Pick<MetricConfig, "unit">,
  digits = 1,
): string => {
  if (!isFiniteNumber(value)) {
    return "-";
  }

  return metric.unit === "%" ? `${value.toFixed(digits)}%` : `${value.toFixed(digits)} kg`;
};

const formatSignedMetric = (
  value: number | undefined,
  metric: Pick<MetricConfig, "unit">,
  digits = 1,
): string => {
  if (!isFiniteNumber(value)) {
    return "-";
  }

  const prefix = value > 0 ? "+" : "";
  return metric.unit === "%"
    ? `${prefix}${value.toFixed(digits)}%`
    : `${prefix}${value.toFixed(digits)} kg`;
};

const getChangeClassName = (
  value: number | undefined,
  metric: MetricConfig,
): Tone => {
  if (!isFiniteNumber(value) || Math.abs(value) < 0.01 || metric.betterDirection === "neutral") {
    return "neutral";
  }

  const isPositiveDirection =
    (metric.betterDirection === "down" && value < 0) ||
    (metric.betterDirection === "up" && value > 0);

  return isPositiveDirection ? "positive" : "negative";
};

const getStabilityThreshold = (metric: MetricConfig): number => {
  if (metric.key === "bodyFatPercent") {
    return 0.25;
  }

  return metric.key === "skeletalMuscleMassKg" ? 0.15 : 0.2;
};

const getTrendThreshold = (metric: MetricConfig): number =>
  metric.key === "skeletalMuscleMassKg" ? 0.14 : 0.22;

const getVariabilityThreshold = (metric: MetricConfig): number =>
  metric.key === "bodyFatPercent" ? 0.32 : 0.24;

const getWeeklyTrendChange = (summary: MetricSummary): number | undefined =>
  isFiniteNumber(summary.trendSlope) ? summary.trendSlope * 7 : undefined;

const getTrendDirection = (
  summary: MetricSummary,
  metric: MetricConfig,
): "down" | "up" | "flat" | "unknown" => {
  const weeklyTrend = getWeeklyTrendChange(summary);

  if (!isFiniteNumber(weeklyTrend)) {
    return "unknown";
  }

  const threshold = getTrendThreshold(metric);

  if (weeklyTrend < -threshold) {
    return "down";
  }

  if (weeklyTrend > threshold) {
    return "up";
  }

  return "flat";
};

type TrendStrength = "flat" | "gentle" | "clear" | "sharp" | "unknown";
type StabilityState = "stable" | "mixed" | "volatile" | "unknown";
type PositionState = "below" | "near" | "above" | "unknown";
type ConfidenceState = "low" | "medium" | "high";
type MetricContext = "weight" | "bodyFat" | "skeletalMuscle";

interface CrossMetricSignal {
  key: string;
  label: string;
  explanation: string;
  response: string;
  paragraph: string;
  score: number;
  relatedMetrics: MetricKey[];
}

interface HealthInterpretation {
  metricContext: MetricContext;
  direction: "down" | "up" | "flat" | "unknown";
  trendStrength: TrendStrength;
  shortTermDirection: "down" | "up" | "flat" | "unknown";
  trendPosition: PositionState;
  averagePosition: PositionState;
  stability: StabilityState;
  variabilityShift: "expanding" | "narrowing" | "steady" | "unknown";
  consistency: "high" | "medium" | "low" | "unknown";
  confidence: ConfidenceState;
  weeklyTrend?: number;
  crossSignals: CrossMetricSignal[];
  hasData: boolean;
  hasEnoughData: boolean;
}

interface BadgeCandidate extends StatusBadge {
  score: number;
}

const getMetricContext = (metric: MetricConfig): MetricContext => {
  if (metric.key === "bodyFatPercent") {
    return "bodyFat";
  }

  return metric.key === "skeletalMuscleMassKg" ? "skeletalMuscle" : "weight";
};

const getPositionState = (value: number | undefined, threshold: number): PositionState => {
  if (!isFiniteNumber(value)) {
    return "unknown";
  }

  if (Math.abs(value) <= threshold) {
    return "near";
  }

  return value < 0 ? "below" : "above";
};

const getTrendStrength = (
  weeklyTrend: number | undefined,
  metric: MetricConfig,
): TrendStrength => {
  if (!isFiniteNumber(weeklyTrend)) {
    return "unknown";
  }

  const absoluteTrend = Math.abs(weeklyTrend);
  const threshold = getTrendThreshold(metric);

  if (absoluteTrend <= threshold) {
    return "flat";
  }

  if (absoluteTrend <= threshold * 1.8) {
    return "gentle";
  }

  if (absoluteTrend <= threshold * 3.2) {
    return "clear";
  }

  return "sharp";
};

const getShortTermDirection = (
  value: number | undefined,
  metric: MetricConfig,
): "down" | "up" | "flat" | "unknown" => {
  if (!isFiniteNumber(value)) {
    return "unknown";
  }

  if (Math.abs(value) <= getStabilityThreshold(metric)) {
    return "flat";
  }

  return value < 0 ? "down" : "up";
};

const getStabilityState = (summary: MetricSummary, metric: MetricConfig): StabilityState => {
  if (!isFiniteNumber(summary.recentVariability)) {
    return "unknown";
  }

  const threshold = getVariabilityThreshold(metric);

  if (summary.recentVariability <= threshold) {
    return "stable";
  }

  if (
    summary.recentVariability >= threshold * 1.55 ||
    (isFiniteNumber(summary.previousVariability) &&
      summary.recentVariability > summary.previousVariability * 1.25)
  ) {
    return "volatile";
  }

  return "mixed";
};

const getVariabilityShift = (summary: MetricSummary): HealthInterpretation["variabilityShift"] => {
  if (
    !isFiniteNumber(summary.recentVariability) ||
    !isFiniteNumber(summary.previousVariability)
  ) {
    return "unknown";
  }

  if (summary.recentVariability > summary.previousVariability * 1.25) {
    return "expanding";
  }

  if (summary.recentVariability < summary.previousVariability * 0.75) {
    return "narrowing";
  }

  return "steady";
};

const getConsistencyState = (
  stability: StabilityState,
  trendPosition: PositionState,
  averagePosition: PositionState,
): HealthInterpretation["consistency"] => {
  if (stability === "unknown") {
    return "unknown";
  }

  if (stability === "stable" && trendPosition === "near" && averagePosition === "near") {
    return "high";
  }

  if (stability === "volatile") {
    return "low";
  }

  return "medium";
};

const getConfidenceState = (summary: MetricSummary): ConfidenceState => {
  if (summary.sampleCount < 3) {
    return "low";
  }

  if (
    summary.sampleCount >= 8 &&
    isFiniteNumber(summary.latestTrend) &&
    isFiniteNumber(summary.sevenDayAverage) &&
    isFiniteNumber(summary.recentVariability)
  ) {
    return "high";
  }

  return summary.sampleCount >= 5 ? "medium" : "low";
};

const toBadgeTone = (tone: Tone): BadgeTone => (tone === "negative" ? "warning" : tone);

const getBadgeToneFromChange = (
  value: number | undefined,
  metric: MetricConfig,
): BadgeTone => toBadgeTone(getChangeClassName(value, metric));

const getDirectionText = (direction: HealthInterpretation["direction"]): string => {
  if (direction === "down") {
    return "하락";
  }

  if (direction === "up") {
    return "상승";
  }

  return "횡보";
};

const getTrendStrengthText = (strength: TrendStrength): string => {
  if (strength === "gentle") {
    return "완만한";
  }

  if (strength === "clear") {
    return "뚜렷한";
  }

  if (strength === "sharp") {
    return "급격한";
  }

  return "평탄한";
};

const getPositionText = (position: PositionState, target: "trend" | "average"): string => {
  const targetText = target === "trend" ? "추세선" : "7일 평균";

  if (position === "below") {
    return `${targetText}보다 낮은 위치`;
  }

  if (position === "above") {
    return `${targetText}보다 높은 위치`;
  }

  if (position === "near") {
    return `${targetText}에 가까운 위치`;
  }

  return `${targetText} 비교 대기`;
};

const buildCrossMetricSignals = (
  summaries: Record<MetricKey, MetricSummary>,
): CrossMetricSignal[] => {
  const signals: CrossMetricSignal[] = [];
  const weight = summaries.weightKg;
  const bodyFat = summaries.bodyFatPercent;
  const muscle = summaries.skeletalMuscleMassKg;
  const weightWeeklyTrend = getWeeklyTrendChange(weight);
  const bodyFatWeeklyTrend = getWeeklyTrendChange(bodyFat);
  const muscleWeeklyTrend = getWeeklyTrendChange(muscle);
  const weightThreshold = getTrendThreshold(metricConfigs[0]);
  const bodyFatThreshold = getTrendThreshold(metricConfigs[1]);
  const muscleThreshold = getTrendThreshold(metricConfigs[2]);

  if (
    weight.sampleCount >= 3 &&
    muscle.sampleCount >= 3 &&
    (isFiniteNumber(weight.shortTermChange) || isFiniteNumber(weightWeeklyTrend)) &&
    (isFiniteNumber(muscle.shortTermChange) || isFiniteNumber(muscleWeeklyTrend))
  ) {
    const weightDown =
      (isFiniteNumber(weight.shortTermChange) &&
        weight.shortTermChange < -getStabilityThreshold(metricConfigs[0])) ||
      (isFiniteNumber(weightWeeklyTrend) && weightWeeklyTrend < -weightThreshold);
    const muscleStable =
      (!isFiniteNumber(muscle.shortTermChange) ||
        muscle.shortTermChange >= -getStabilityThreshold(metricConfigs[2])) &&
      (!isFiniteNumber(muscleWeeklyTrend) || muscleWeeklyTrend >= -muscleThreshold);

    if (weightDown && muscleStable) {
      signals.push({
        key: "muscle-preservation",
        label: "근육 보존 흐름",
        explanation: "체중은 낮아지는 방향인데 골격근량 변화는 안정 범위에 머뭅니다.",
        response: "체중 변화만 단독으로 읽기보다 골격근량의 동반 저하 여부를 함께 확인하는 해석이 적절합니다.",
        paragraph: "체중 하락 흐름 안에서 골격근량은 비교적 보존되는 패턴입니다.",
        score: 96,
        relatedMetrics: ["weightKg", "skeletalMuscleMassKg"],
      });
    }
  }

  if (
    weight.sampleCount >= 3 &&
    bodyFat.sampleCount >= 3 &&
    isFiniteNumber(bodyFatWeeklyTrend) &&
    bodyFatWeeklyTrend < -bodyFatThreshold
  ) {
    const weightMovement = isFiniteNumber(weightWeeklyTrend)
      ? Math.abs(weightWeeklyTrend) / weightThreshold
      : 0;
    const bodyFatMovement = Math.abs(bodyFatWeeklyTrend) / bodyFatThreshold;

    if (!isFiniteNumber(weightWeeklyTrend) || bodyFatMovement > weightMovement * 1.15) {
      signals.push({
        key: "composition-efficiency",
        label: "체성분 효율 우세",
        explanation: "체지방률 하락 신호가 체중 변화보다 상대적으로 뚜렷합니다.",
        response: "체중의 절대 변화보다 체지방률과 평균선의 동행 여부를 함께 보는 편이 적절합니다.",
        paragraph: "체지방률 변화가 체중 변화보다 더 선명해 체성분 쪽 해석 비중이 커진 상태입니다.",
        score: 94,
        relatedMetrics: ["weightKg", "bodyFatPercent"],
      });
    }
  }

  return signals;
};

const buildHealthInterpretation = (
  summary: MetricSummary,
  metric: MetricConfig,
  summaries: Record<MetricKey, MetricSummary>,
): HealthInterpretation => {
  const weeklyTrend = getWeeklyTrendChange(summary);
  const direction = getTrendDirection(summary, metric);
  const trendPosition = getPositionState(summary.trendDeviation, getStabilityThreshold(metric));
  const averagePosition = getPositionState(
    summary.averageDeviation,
    getStabilityThreshold(metric),
  );
  const stability = getStabilityState(summary, metric);
  const crossSignals = buildCrossMetricSignals(summaries).filter((signal) =>
    signal.relatedMetrics.includes(metric.key),
  );

  return {
    metricContext: getMetricContext(metric),
    direction,
    trendStrength: getTrendStrength(weeklyTrend, metric),
    shortTermDirection: getShortTermDirection(summary.shortTermChange, metric),
    trendPosition,
    averagePosition,
    stability,
    variabilityShift: getVariabilityShift(summary),
    consistency: getConsistencyState(stability, trendPosition, averagePosition),
    confidence: getConfidenceState(summary),
    weeklyTrend,
    crossSignals,
    hasData: summary.latestValue !== undefined,
    hasEnoughData: summary.sampleCount >= 3,
  };
};

const buildInsufficientBadges = (
  summary: MetricSummary,
  metric: MetricConfig,
): StatusBadge[] => {
  if (summary.latestValue === undefined) {
    return [
      {
        label: "분석 대기",
        tone: "neutral",
        explanation: `${metric.label} 기록이 아직 없어 추세와 변동성을 계산하지 않았습니다.`,
        response: "기록이 입력되면 현재값, 7일 평균, 추세선 위치를 함께 해석합니다.",
      },
      {
        label: "표본 부족",
        tone: "neutral",
        explanation: "비교할 측정 구간이 없어 신뢰도 있는 상태 판단을 보류합니다.",
        response: "최소 3개 이상의 기록이 쌓인 뒤 방향성과 변동폭을 읽는 편이 적절합니다.",
      },
    ];
  }

  return [
    {
      label: "기준 형성 중",
      tone: "neutral",
      explanation: `${metric.label} 표본이 아직 적어 7일 평균과 회귀 추세의 안정성이 낮습니다.`,
      response: "현재 값은 기준점으로만 보고, 다음 기록이 쌓인 뒤 방향성을 해석하는 편이 적절합니다.",
    },
    {
      label: "신뢰도 낮음",
      tone: "neutral",
      explanation: "단기 변화와 추세선 중 어느 쪽이 우세한지 판단할 데이터가 부족합니다.",
      response: "지금은 상태 결론보다 측정 간격과 입력 누락 여부를 먼저 확인하는 구간입니다.",
    },
  ];
};

const buildTrendCandidate = (
  interpretation: HealthInterpretation,
  summary: MetricSummary,
  metric: MetricConfig,
): BadgeCandidate => {
  const directionText = getDirectionText(interpretation.direction);

  if (interpretation.direction === "flat") {
    const label =
      interpretation.consistency === "high" ? "횡보 안정화 상태" : "횡보 흐름 관찰";

    return {
      label,
      tone: "neutral",
      explanation: `${metric.label} 회귀 추세가 뚜렷한 상승이나 하락 없이 평탄하게 유지됩니다.`,
      response: "현재 구간은 단일 값보다 평균선 주변에서 벗어나는지 여부가 더 중요합니다.",
      score: interpretation.consistency === "high" ? 84 : 72,
    };
  }

  if (interpretation.direction === "unknown" || !isFiniteNumber(interpretation.weeklyTrend)) {
    return {
      label: "추세 판단 대기",
      tone: "neutral",
      explanation: "회귀 추세를 안정적으로 읽기에는 비교 가능한 기록이 부족합니다.",
      response: "지금은 변화 방향보다 기록 누락 없이 기준선을 만드는 데 초점을 두는 해석이 적절합니다.",
      score: 40,
    };
  }

  const strengthText = getTrendStrengthText(interpretation.trendStrength);
  const weeklyTrendText = formatSignedMetric(interpretation.weeklyTrend, metric);
  const tone = getBadgeToneFromChange(interpretation.weeklyTrend, metric);
  const label =
    interpretation.trendStrength === "sharp"
      ? `급격한 ${directionText} 흐름`
      : `${strengthText} ${directionText} 흐름`;
  const response =
    tone === "warning"
      ? "방향 자체보다 다음 기록에서 평균선과 추세선 이탈이 이어지는지 확인하는 편이 적절합니다."
      : "단일 측정값보다 7일 평균이 같은 방향으로 따라오는지 함께 읽으면 됩니다.";

  return {
    label,
    tone,
    explanation: `${metric.label} 회귀 추세가 7일 기준 ${weeklyTrendText} 움직이며 ${strengthText} ${directionText} 쪽으로 기울어 있습니다.`,
    response,
    score: interpretation.trendStrength === "sharp" ? 90 : 82,
  };
};

const buildVariabilityCandidate = (
  interpretation: HealthInterpretation,
  summary: MetricSummary,
  metric: MetricConfig,
): BadgeCandidate => {
  if (!isFiniteNumber(summary.recentVariability) || interpretation.stability === "unknown") {
    return {
      label: "변동성 대기",
      tone: "neutral",
      explanation: "최근 측정값 사이의 흔들림을 비교할 표본이 아직 충분하지 않습니다.",
      response: "변동폭 판단은 여러 기록의 간격이 확보된 뒤 해석하는 편이 적절합니다.",
      score: 36,
    };
  }

  const variabilityText = formatMetric(summary.recentVariability, metric, 2);

  if (interpretation.stability === "stable") {
    return {
      label: interpretation.consistency === "high" ? "추세선 근접 유지" : "변동폭 안정적",
      tone: "neutral",
      explanation: `최근 측정값 간 평균 변동폭이 ${variabilityText} 수준으로 낮게 유지됩니다.`,
      response: "작은 차이는 측정 잡음으로 두고 7일 평균과 추세선의 위치를 중심으로 해석하면 됩니다.",
      score: interpretation.consistency === "high" ? 86 : 74,
    };
  }

  if (interpretation.stability === "volatile") {
    return {
      label:
        interpretation.variabilityShift === "expanding"
          ? "단기 변동 확대"
          : "변동성 확대 구간",
      tone: "warning",
      explanation: `최근 측정값의 흔들림이 ${variabilityText} 수준으로 커져 안정 범위를 벗어났습니다.`,
      response: "수분, 염분, 측정 시간 차이의 영향을 먼저 확인하고 평균선 반응을 함께 보는 것이 적절합니다.",
      score: 92,
    };
  }

  return {
    label: "변동성 혼재",
    tone: "neutral",
    explanation: `최근 변동폭은 ${variabilityText}로 안정과 확대 신호가 함께 나타납니다.`,
    response: "이번 값 하나보다 다음 기록에서 변동폭이 줄어드는지 확인하는 해석이 적절합니다.",
    score: 62,
  };
};

const buildPositionCandidate = (
  interpretation: HealthInterpretation,
  summary: MetricSummary,
  metric: MetricConfig,
): BadgeCandidate => {
  const toneSource = isFiniteNumber(summary.averageDeviation)
    ? summary.averageDeviation
    : summary.trendDeviation;
  const tone = getBadgeToneFromChange(toneSource, metric);
  const averageText = getPositionText(interpretation.averagePosition, "average");
  const trendText = getPositionText(interpretation.trendPosition, "trend");

  if (
    interpretation.averagePosition === "near" &&
    interpretation.trendPosition === "near"
  ) {
    return {
      label: "기준선 근접",
      tone: "neutral",
      explanation: `현재 ${metric.label} 값이 7일 평균과 회귀 추세선 모두에 가깝습니다.`,
      response: "이 구간은 큰 의미를 부여하기보다 기준선에서 벗어나는 변화가 생기는지 보는 편이 적절합니다.",
      score: 80,
    };
  }

  if (
    interpretation.averagePosition === "unknown" &&
    interpretation.trendPosition === "unknown"
  ) {
    return {
      label: "기준선 대기",
      tone: "neutral",
      explanation: "현재 값과 비교할 7일 평균 또는 추세선이 충분히 형성되지 않았습니다.",
      response: "기준선이 형성될 때까지 현재 값은 단독 기록으로만 해석하는 편이 적절합니다.",
      score: 34,
    };
  }

  const label =
    interpretation.averagePosition === "below" || interpretation.trendPosition === "below"
      ? "기준선 하단 위치"
      : "기준선 상단 위치";

  return {
    label,
    tone,
    explanation: `현재 값은 ${averageText}이고 ${trendText}입니다.`,
    response: "기준선 이탈은 한 번의 값보다 다음 기록에서 같은 위치가 반복되는지로 해석해야 합니다.",
    score: tone === "warning" ? 78 : 76,
  };
};

const buildStatusBadges = (
  interpretation: HealthInterpretation,
  summary: MetricSummary,
  metric: MetricConfig,
): StatusBadge[] => {
  if (!interpretation.hasData || !interpretation.hasEnoughData) {
    return buildInsufficientBadges(summary, metric);
  }

  const candidates: BadgeCandidate[] = [
    buildTrendCandidate(interpretation, summary, metric),
    buildVariabilityCandidate(interpretation, summary, metric),
    buildPositionCandidate(interpretation, summary, metric),
    ...interpretation.crossSignals.map((signal) => ({
      label: signal.label,
      tone: "positive" as const,
      explanation: signal.explanation,
      response: signal.response,
      score: signal.score,
    })),
  ];
  const selected: BadgeCandidate[] = [];
  const seenLabels = new Set<string>();

  [...candidates]
    .sort((a, b) => b.score - a.score)
    .forEach((candidate) => {
      if (selected.length >= 3 || seenLabels.has(candidate.label)) {
        return;
      }

      selected.push(candidate);
      seenLabels.add(candidate.label);
    });

  return selected.map(({ score: _score, ...badge }) => badge);
};

const getDeviationMeaning = (
  value: number | undefined,
  metric: MetricConfig,
  comparison: "trend" | "average",
): string => {
  if (!isFiniteNumber(value)) {
    return "비교 데이터 부족";
  }

  if (Math.abs(value) <= getStabilityThreshold(metric)) {
    return comparison === "trend" ? "추세선 근접" : "안정 범위 유지";
  }

  if (comparison === "trend") {
    return value < 0 ? "추세선보다 낮음" : "추세선보다 높음";
  }

  return value < 0 ? "최근 평균 이하" : "최근 평균 이상";
};

const getShortTermMeaning = (
  value: number | undefined,
  metric: MetricConfig,
): string => {
  if (!isFiniteNumber(value)) {
    return "7일 비교 부족";
  }

  if (Math.abs(value) <= getStabilityThreshold(metric)) {
    return "변화폭 제한적";
  }

  return value < 0 ? "최근 하락 흐름" : "최근 상승 흐름";
};

const buildSupportingRows = (
  summary: MetricSummary,
  metric: MetricConfig,
): SupportingMetricRow[] => [
  {
    label: "추세선 위치",
    meaning: getDeviationMeaning(summary.trendDeviation, metric, "trend"),
    value: formatSignedMetric(summary.trendDeviation, metric),
    tone: getChangeClassName(summary.trendDeviation, metric),
  },
  {
    label: "최근 평균 위치",
    meaning: getDeviationMeaning(summary.averageDeviation, metric, "average"),
    value: formatSignedMetric(summary.averageDeviation, metric),
    tone: getChangeClassName(summary.averageDeviation, metric),
  },
  {
    label: "7일 변화",
    meaning: getShortTermMeaning(summary.shortTermChange, metric),
    value: formatSignedMetric(summary.shortTermChange, metric),
    tone: getChangeClassName(summary.shortTermChange, metric),
  },
  {
    label: "7일 평균",
    meaning: summary.sevenDayAverage === undefined ? "계산 대기" : "평균 기준값",
    value: formatMetric(summary.sevenDayAverage, metric),
    tone: "neutral",
  },
];

const buildTrendSentence = (summary: MetricSummary, metric: MetricConfig): string => {
  const direction = getTrendDirection(summary, metric);
  const weeklyTrend = getWeeklyTrendChange(summary);
  const shortTerm = summary.shortTermChange;

  if (summary.sampleCount < 3 || direction === "unknown" || !isFiniteNumber(weeklyTrend)) {
    return `${metric.label}은 아직 장기 추세 판단을 위한 표본이 적습니다.`;
  }

  const shortTermPhrase = !isFiniteNumber(shortTerm)
    ? "최근 7일 비교는 대기 중입니다"
    : Math.abs(shortTerm) <= getStabilityThreshold(metric)
      ? "최근 7일 변화폭은 제한적입니다"
      : `최근 7일에는 ${formatMetric(Math.abs(shortTerm), metric)} ${
          shortTerm < 0 ? "낮아졌습니다" : "높아졌습니다"
        }`;

  if (direction === "flat") {
    return `장기 추세선은 횡보에 가깝고, ${shortTermPhrase}.`;
  }

  const intensity = Math.abs(weeklyTrend) <= getTrendThreshold(metric) * 1.8 ? "완만한" : "뚜렷한";
  const directionText = direction === "down" ? "하락" : "상승";

  return `장기 추세선은 ${intensity} ${directionText} 방향이며, ${shortTermPhrase}.`;
};

const buildPositionSentence = (summary: MetricSummary, metric: MetricConfig): string => {
  if (summary.latestValue === undefined || summary.sevenDayAverage === undefined) {
    return "7일 평균선은 추가 기록이 쌓이면 더 안정적으로 해석됩니다.";
  }

  const averageMeaning = getDeviationMeaning(summary.averageDeviation, metric, "average");
  const trendMeaning = getDeviationMeaning(summary.trendDeviation, metric, "trend");

  if (averageMeaning === "안정 범위 유지" && trendMeaning === "추세선 근접") {
    return "현재 값은 7일 평균과 추세선에 가까워 안정 범위에 있습니다.";
  }

  return `현재 값은 ${averageMeaning}이고, ${trendMeaning} 상태입니다.`;
};

const buildVariabilitySentence = (summary: MetricSummary, metric: MetricConfig): string => {
  if (!isFiniteNumber(summary.recentVariability)) {
    return "최근 변동성은 추가 기록 후 더 명확해집니다.";
  }

  if (summary.recentVariability <= getVariabilityThreshold(metric)) {
    return "최근 변동폭은 크지 않아 비교적 안정적인 흐름입니다.";
  }

  if (
    isFiniteNumber(summary.previousVariability) &&
    summary.recentVariability > summary.previousVariability * 1.25
  ) {
    return "최근 변동폭이 이전 구간보다 커지는 경향입니다.";
  }

  return "최근 데이터에서는 일시적 변동 가능성이 관찰됩니다.";
};

const buildCrossMetricSentence = (
  summaries: Record<MetricKey, MetricSummary>,
): string | undefined => {
  const weight = summaries.weightKg;
  const bodyFat = summaries.bodyFatPercent;
  const muscle = summaries.skeletalMuscleMassKg;
  const weightThreshold = getStabilityThreshold(metricConfigs[0]);
  const bodyFatTrend = getWeeklyTrendChange(bodyFat);

  if (
    weight.sampleCount >= 3 &&
    muscle.sampleCount >= 3 &&
    isFiniteNumber(weight.shortTermChange) &&
    isFiniteNumber(muscle.shortTermChange) &&
    weight.shortTermChange < -weightThreshold
  ) {
    if (muscle.shortTermChange >= -getStabilityThreshold(metricConfigs[2])) {
      return "체중 하락 구간에서 골격근량은 큰 이탈 없이 유지되고 있습니다.";
    }

    return "체중 하락과 함께 골격근량도 낮아지는 흐름이 함께 보입니다.";
  }

  if (
    weight.sampleCount >= 3 &&
    bodyFat.sampleCount >= 3 &&
    isFiniteNumber(weight.shortTermChange) &&
    isFiniteNumber(bodyFatTrend) &&
    weight.shortTermChange < -weightThreshold &&
    bodyFatTrend < -getTrendThreshold(metricConfigs[1])
  ) {
    return "체중과 체지방률이 같은 방향으로 낮아지는 흐름입니다.";
  }

  return undefined;
};

const buildInsightParagraph = (
  summary: MetricSummary,
  metric: MetricConfig,
  summaries: Record<MetricKey, MetricSummary>,
): string => {
  if (summary.latestValue === undefined) {
    return `${metric.label} 기록이 입력되면 현재값, 7일 평균, 추세선 위치를 함께 해석합니다.`;
  }

  if (summary.sampleCount < 3) {
    return `${metric.label}은 초기 기준을 형성하는 단계입니다. 이후 기록이 쌓이면 7일 평균과 추세선 대비 위치가 함께 해석됩니다.`;
  }

  const crossMetricSentence = buildCrossMetricSentence(summaries);

  return [
    buildTrendSentence(summary, metric),
    buildPositionSentence(summary, metric),
    crossMetricSentence ?? buildVariabilitySentence(summary, metric),
  ].join(" ");
};

const buildInterpretationParagraph = (
  summary: MetricSummary,
  metric: MetricConfig,
  interpretation: HealthInterpretation,
): string => {
  if (summary.latestValue === undefined) {
    return `${metric.label} 기록이 아직 없어 상태 판단을 보류합니다. 기록이 입력되면 현재값, 7일 평균, 회귀 추세선의 관계를 함께 해석합니다.`;
  }

  if (summary.sampleCount < 3) {
    return `${metric.label}은 초기 기준을 형성하는 단계입니다. 현재 값은 단독 기록으로만 보고, 추세와 변동성 판단은 표본이 더 쌓인 뒤 해석하는 편이 적절합니다.`;
  }

  const directionText = getDirectionText(interpretation.direction);
  const strengthText = getTrendStrengthText(interpretation.trendStrength);
  const positionSentence =
    interpretation.averagePosition === "near" && interpretation.trendPosition === "near"
      ? "현재 값은 7일 평균과 추세선에 가까운 범위입니다."
      : `현재 값은 ${getPositionText(interpretation.averagePosition, "average")}이고 ${getPositionText(
          interpretation.trendPosition,
          "trend",
        )}입니다.`;
  const trendSentence =
    interpretation.direction === "flat"
      ? `${metric.label}은 회귀 추세가 횡보에 가깝고 ${positionSentence}`
      : `${metric.label}은 ${strengthText} ${directionText} 방향의 회귀 흐름이며 ${positionSentence}`;
  const stabilitySentence =
    interpretation.stability === "volatile"
      ? "최근 변동폭이 커져 이번 값은 측정 조건 차이와 함께 읽는 편이 적절합니다."
      : interpretation.stability === "stable"
        ? "최근 변동폭은 안정적이어서 단일 값보다 평균선과 추세선의 동행 여부가 더 유효합니다."
        : "최근 변동성은 혼재되어 다음 기록에서 기준선 이탈이 반복되는지 확인해야 합니다.";
  const crossMetricSentence = interpretation.crossSignals[0]?.paragraph;

  return [trendSentence, crossMetricSentence ?? stabilitySentence].join(" ");
};

const buildHealthInsight = (
  summary: MetricSummary,
  metric: MetricConfig,
  summaries: Record<MetricKey, MetricSummary>,
): HealthInsight => {
  const interpretation = buildHealthInterpretation(summary, metric, summaries);

  return {
    badges: buildStatusBadges(interpretation, summary, metric),
    supportingRows: buildSupportingRows(summary, metric),
    paragraph: buildInterpretationParagraph(summary, metric, interpretation),
  };
};

const getTooltipLabel = (dataKey: unknown, metric: MetricConfig): string => {
  if (dataKey === metric.averageKey) {
    return "7일 평균";
  }

  if (dataKey === metric.trendKey) {
    return "추세선";
  }

  return metric.label;
};

function App(): JSX.Element {
  const [records, setRecords] = useState<BodyRecord[]>(loadRecords);
  const [draft, setDraft] = useState<DraftRecord>(createDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<ActiveSection>("analysis");
  const [analyticsViewMode, setAnalyticsViewMode] =
    useState<AnalyticsViewMode>("focus");
  const [hasCompletedInitialFocus, setHasCompletedInitialFocus] = useState(false);
  const [activeMetricKey, setActiveMetricKey] = useState<MetricKey>("weightKg");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const activeMetric =
    metricConfigs.find((metric) => metric.key === activeMetricKey) ?? metricConfigs[0];
  const sortedRecords = useMemo(() => sortRecords(records), [records]);
  const chartData = useMemo(() => buildChartData(sortedRecords), [sortedRecords]);
  const visibleChartData = useMemo(
    () => filterChartDataByRange(chartData, timeRange),
    [chartData, timeRange],
  );
  const visibleValues = useMemo(
    () => getVisibleValues(visibleChartData, activeMetric),
    [activeMetric, visibleChartData],
  );
  const visibleMetricValues = useMemo(
    () => visibleChartData.map((point) => point[activeMetric.key]).filter(isFiniteNumber),
    [activeMetric, visibleChartData],
  );
  const yAxisDomain = useMemo(
    () => getYAxisDomain(visibleValues, activeMetric),
    [activeMetric, visibleValues],
  );
  const metricSummaries = useMemo(() => {
    const summaries = {} as Record<MetricKey, MetricSummary>;

    metricConfigs.forEach((metric) => {
      summaries[metric.key] = buildMetricSummary(chartData, metric);
    });

    return summaries;
  }, [chartData]);
  const metricSummary = metricSummaries[activeMetric.key];
  const healthInsight = useMemo(
    () => buildHealthInsight(metricSummary, activeMetric, metricSummaries),
    [activeMetric, metricSummaries, metricSummary],
  );
  const latestRecord = sortedRecords[sortedRecords.length - 1];
  const newestRecords = useMemo(() => [...sortedRecords].reverse(), [sortedRecords]);
  const hasVisibleChart = visibleChartData.length > 0 && visibleMetricValues.length > 0;
  const isEditing = editingId !== null;
  const isFocusMode = activeSection === "analysis" && analyticsViewMode === "focus";

  useEffect(() => {
    if (!isFocusMode || hasCompletedInitialFocus) {
      return undefined;
    }

    const completeInitialFocus = (): void => {
      setAnalyticsViewMode("analytics");
      setHasCompletedInitialFocus(true);
    };
    const timerId = window.setTimeout(completeInitialFocus, 15000);

    window.addEventListener("pointerdown", completeInitialFocus, { once: true });
    window.addEventListener("keydown", completeInitialFocus, { once: true });

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("pointerdown", completeInitialFocus);
      window.removeEventListener("keydown", completeInitialFocus);
    };
  }, [hasCompletedInitialFocus, isFocusMode]);

  useEffect(() => {
    if (!isFocusMode || !hasCompletedInitialFocus) {
      return undefined;
    }

    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        setAnalyticsViewMode("analytics");
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [hasCompletedInitialFocus, isFocusMode]);

  const openAnalyticsMode = (): void => {
    setActiveSection("analysis");
    setAnalyticsViewMode("analytics");
    setHasCompletedInitialFocus(true);
  };

  const openEntrySection = (): void => {
    setActiveSection("entry");
    setAnalyticsViewMode("analytics");
    setHasCompletedInitialFocus(true);
  };

  const enterFocusMode = (): void => {
    setActiveSection("analysis");
    setAnalyticsViewMode("focus");
    setHasCompletedInitialFocus(true);
    window.scrollTo({ top: 0 });
  };

  const exitFocusMode = (): void => {
    setAnalyticsViewMode("analytics");
    setHasCompletedInitialFocus(true);
  };

  const handleChartKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      enterFocusMode();
    }
  };

  const saveRecord = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const validationError = validateDraft(draft);
    if (validationError !== null) {
      setError(validationError);
      return;
    }

    const nextRecord = draftToRecord(draft, editingId ?? undefined);
    if (hasDateConflict(records, nextRecord.date, editingId)) {
      setError("A record for this date already exists. Edit that record first.");
      return;
    }

    setRecords((current) =>
      sortRecords(current.filter((record) => record.id !== nextRecord.id).concat(nextRecord)),
    );
    setDraft(createDraft());
    setEditingId(null);
    setError("");
  };

  const editRecord = (record: BodyRecord): void => {
    setDraft(recordToDraft(record));
    setEditingId(record.id);
    openEntrySection();
    setError("");
  };

  const cancelEdit = (): void => {
    setDraft(createDraft());
    setEditingId(null);
    setError("");
  };

  const deleteRecord = (id: string): void => {
    setRecords((current) => current.filter((record) => record.id !== id));

    if (editingId === id) {
      cancelEdit();
    }
  };

  const clearRecords = (): void => {
    setRecords([]);
    setDraft(createDraft());
    setEditingId(null);
    setError("");
  };

  return (
    <main className={`app ${isFocusMode ? "is-focus-mode" : "is-analytics-mode"}`}>
      <header className="top-nav">
        <button
          className="brand-button"
          type="button"
          onClick={openAnalyticsMode}
        >
          <span className="brand-kicker">BODY METRICS OS</span>
          <span>Analytics System</span>
        </button>
        <nav className="nav-tabs" aria-label="Primary workflows">
          <button
            type="button"
            className={activeSection === "analysis" ? "is-active" : ""}
            onClick={openAnalyticsMode}
          >
            Analytics
          </button>
          <button
            type="button"
            className={activeSection === "entry" ? "is-active" : ""}
            onClick={openEntrySection}
          >
            Records
          </button>
        </nav>
      </header>

      {activeSection === "analysis" && (
        <section
          className={`analysis-section ${isFocusMode ? "is-focus-mode" : ""}`}
          aria-label="Trend Analysis"
        >
          <div className="analytics-shell">
            <section
              className={`panel chart-panel ${
                isFocusMode ? "chart-panel-focus" : "chart-panel-analytics"
              }`}
              style={{ "--metric-glow": activeMetric.glow } as React.CSSProperties}
            >
              <div className="panel-heading chart-heading">
                <div>
                  <p className="section-label">Health Intelligence</p>
                  <h1>{activeMetric.label} 추세 분석</h1>
                  <p className="heading-copy">
                    실측값, 7일 이동평균, 장기 추세선을 같은 기준으로 비교합니다.
                  </p>
                </div>
                <div className="chart-controls" aria-label="그래프 설정">
                  <div className="metric-switcher" aria-label="분석 지표">
                    {metricConfigs.map((metric) => (
                      <button
                        type="button"
                        className={metric.key === activeMetric.key ? "is-active" : ""}
                        key={metric.key}
                        onClick={() => setActiveMetricKey(metric.key)}
                      >
                        <span
                          className="metric-dot"
                          style={{ backgroundColor: metric.accentMuted }}
                        />
                        {metric.label}
                      </button>
                    ))}
                  </div>
                  <div className="segmented-control compact" aria-label="기간">
                    {timeRangeOptions.map((option) => (
                      <button
                        type="button"
                        className={option.value === timeRange ? "is-active" : ""}
                        key={option.value}
                        onClick={() => setTimeRange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="metric-pills" aria-label="최근 지표">
                {metricConfigs.map((metric) => (
                  <MetricPill
                    key={metric.key}
                    metric={metric}
                    value={latestRecord?.[metric.key]}
                    isActive={metric.key === activeMetric.key}
                    onClick={() => setActiveMetricKey(metric.key)}
                  />
                ))}
              </div>

              {isFocusMode && (
                <div className="focus-summary-panel" aria-label="현재 지표 요약">
                  <div>
                    <span>{metricSummary.latestDate ?? "기록 없음"}</span>
                    <strong>{formatMetric(metricSummary.latestValue, activeMetric)}</strong>
                    <small>{activeMetric.label}</small>
                  </div>
                  <button type="button" onClick={exitFocusMode}>
                    분석 레이어 보기
                  </button>
                </div>
              )}

              {!hasVisibleChart && (
                <div
                  className={`chart-empty ${isFocusMode ? "" : "is-interactive"}`}
                  role={isFocusMode ? undefined : "button"}
                  tabIndex={isFocusMode ? undefined : 0}
                  aria-label={isFocusMode ? undefined : "그래프 집중 모드 열기"}
                  onClick={isFocusMode ? undefined : enterFocusMode}
                  onKeyDown={isFocusMode ? undefined : handleChartKeyDown}
                >
                  <span>{activeMetric.emptyText}</span>
                  {!isFocusMode && (
                    <small className="chart-focus-hint">그래프를 선택해 집중 모드로 보기</small>
                  )}
                </div>
              )}

              {hasVisibleChart && (
                <div
                  className={`chart-box ${isFocusMode ? "is-focus" : "is-interactive"}`}
                  role={isFocusMode ? undefined : "button"}
                  tabIndex={isFocusMode ? undefined : 0}
                  aria-label={isFocusMode ? undefined : "그래프 집중 모드 열기"}
                  onClick={isFocusMode ? undefined : enterFocusMode}
                  onKeyDown={isFocusMode ? undefined : handleChartKeyDown}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={visibleChartData}
                      margin={{ top: 18, right: 18, bottom: 0, left: 2 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#7b8291", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tick={{ fill: "#7b8291", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={58}
                        unit={activeMetric.unit}
                        domain={yAxisDomain}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(13, 15, 20, 0.94)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          borderRadius: 14,
                          color: "#f6f7fb",
                          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
                        }}
                        labelStyle={{ color: "#a7adba" }}
                        formatter={(value: unknown, name: unknown) => {
                          const numeric = typeof value === "number" ? value : Number(value);

                          return [
                            Number.isFinite(numeric)
                              ? formatMetric(numeric, activeMetric, 2)
                              : String(value),
                            getTooltipLabel(name, activeMetric),
                          ];
                        }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ color: "#9299a7", fontSize: 13, paddingTop: 8 }}
                      />
                      <Line
                        type="monotone"
                        dataKey={activeMetric.key}
                        name={activeMetric.label}
                        stroke={activeMetric.accent}
                        strokeWidth={3}
                        dot={{
                          r: 3.4,
                          fill: "#0d0f14",
                          stroke: activeMetric.accent,
                          strokeWidth: 2,
                        }}
                        activeDot={{ r: 5, strokeWidth: 0, fill: activeMetric.accent }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey={activeMetric.averageKey}
                        name="7일 평균"
                        stroke="#f0f2f5"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey={activeMetric.trendKey}
                        name="추세선"
                        stroke={activeMetric.accentMuted}
                        strokeWidth={2}
                        strokeDasharray="7 7"
                        dot={false}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {!isFocusMode && (
                    <span className="chart-focus-hint">그래프를 선택해 집중 모드로 보기</span>
                  )}
                </div>
              )}
            </section>

            <aside className="analytics-grid" aria-label="Analytics metrics">
              <article className="panel insight-panel primary-status" aria-label="오늘 측정값">
                <p className="section-label">오늘 측정값</p>
                <div className="today-value">
                  <span>{metricSummary.latestDate ?? "기록 없음"}</span>
                  <strong>{formatMetric(metricSummary.latestValue, activeMetric)}</strong>
                  <small>{activeMetric.label}</small>
                </div>
              </article>

              <article className="panel insight-panel status-panel">
                <div className="analysis-block">
                  <p className="analysis-block-title">핵심 상태</p>
                  <div className="status-badges" aria-label="핵심 상태">
                    {healthInsight.badges.map((badge, index) => (
                      <StatusBadgeItem badge={badge} index={index} key={badge.label} />
                    ))}
                  </div>
                </div>

                <div className="analysis-block supporting-metrics">
                  <p className="analysis-block-title">보조 지표</p>
                  <div className="insight-list">
                    {healthInsight.supportingRows.map((row) => (
                      <InsightRow
                        key={row.label}
                        label={row.label}
                        meaning={row.meaning}
                        value={row.value}
                        tone={row.tone}
                      />
                    ))}
                  </div>
                </div>
              </article>

              <article className="panel insight-panel interpretation-panel">
                <div className="analysis-block insight-copy">
                  <p className="analysis-block-title">인사이트</p>
                  <p>{healthInsight.paragraph}</p>
                </div>
              </article>
            </aside>
          </div>
        </section>
      )}

      {activeSection === "entry" && (
        <section className="entry-section" aria-label="Data Entry">
          <article className="panel entry-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Data Entry</p>
                <h1>{isEditing ? "기록 수정" : "기록 입력"}</h1>
              </div>
            </div>
            <form className="record-form" onSubmit={saveRecord}>
              <label>
                날짜
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </label>
              <label>
                체중 kg
                <input
                  inputMode="decimal"
                  placeholder="예: 88.4"
                  value={draft.weightKg}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, weightKg: event.target.value }))
                  }
                />
              </label>
              <label>
                체지방률 %
                <input
                  inputMode="decimal"
                  placeholder="예: 27.0"
                  value={draft.bodyFatPercent}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, bodyFatPercent: event.target.value }))
                  }
                />
              </label>
              <label>
                골격근량 kg
                <input
                  inputMode="decimal"
                  placeholder="예: 34.2"
                  value={draft.skeletalMuscleMassKg}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      skeletalMuscleMassKg: event.target.value,
                    }))
                  }
                />
              </label>
              {error !== "" && <p className="error">{error}</p>}
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  {isEditing ? "수정 저장" : "기록 추가"}
                </button>
                {isEditing && (
                  <button className="secondary-button" type="button" onClick={cancelEdit}>
                    취소
                  </button>
                )}
              </div>
            </form>
          </article>

          <article className="panel history-panel">
            <div className="panel-heading history-heading">
              <div>
                <p className="section-label">History</p>
                <h1>기록 관리</h1>
              </div>
              <button
                className="danger-button"
                type="button"
                onClick={clearRecords}
                disabled={records.length === 0}
              >
                전체 삭제
              </button>
            </div>
            <div className="records-list">
              {newestRecords.map((record) => (
                <div className="record-row" key={record.id}>
                  <div className="record-main">
                    <strong>{record.date}</strong>
                    <span>
                      {formatMetric(record.weightKg, metricConfigs[0])} · 체지방률{" "}
                      {formatMetric(record.bodyFatPercent, metricConfigs[1])} · 골격근량{" "}
                      {formatMetric(record.skeletalMuscleMassKg, metricConfigs[2])}
                    </span>
                  </div>
                  <div className="record-actions">
                    <button type="button" onClick={() => editRecord(record)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="danger-inline"
                      onClick={() => deleteRecord(record.id)}
                      aria-label={`${record.date} 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              {newestRecords.length === 0 && (
                <p className="empty">아직 기록이 없습니다. 첫 기록을 입력해 주세요.</p>
              )}
            </div>
          </article>
        </section>
      )}
    </main>
  );
}

interface StatusBadgeItemProps {
  badge: StatusBadge;
  index: number;
}

function StatusBadgeItem({ badge, index }: StatusBadgeItemProps): JSX.Element {
  const popoverId = `health-status-popover-${index}`;

  return (
    <span className="status-badge-wrap">
      <button
        type="button"
        className={`status-badge ${badge.tone}`}
        aria-describedby={popoverId}
        aria-label={`${badge.label}. ${badge.explanation} ${badge.response}`}
      >
        {badge.label}
      </button>
      <span className="status-badge-popover" id={popoverId} role="tooltip">
        <span>{badge.explanation}</span>
        <span>{badge.response}</span>
      </span>
    </span>
  );
}

interface MetricPillProps {
  metric: MetricConfig;
  value: number | undefined;
  isActive: boolean;
  onClick: () => void;
}

function MetricPill({ metric, value, isActive, onClick }: MetricPillProps): JSX.Element {
  return (
    <button
      type="button"
      className={`metric-pill ${isActive ? "is-active" : ""}`}
      onClick={onClick}
      style={
        {
          "--pill-accent": metric.accent,
          "--pill-glow": metric.glow,
        } as React.CSSProperties
      }
    >
      <span>{metric.label}</span>
      <strong>{formatMetric(value, metric)}</strong>
    </button>
  );
}

interface InsightRowProps {
  label: string;
  meaning: string;
  value: string;
  tone: Tone;
}

function InsightRow({ label, meaning, value, tone }: InsightRowProps): JSX.Element {
  return (
    <div className={`insight-row ${tone}`}>
      <span>
        <small>{label}</small>
        {meaning}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
