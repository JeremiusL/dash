export interface DrillResult {
  accuracyPct: number | null;
}

export interface DrillProps {
  params: Record<string, number>;
  onFinish: (result: DrillResult) => void;
}
