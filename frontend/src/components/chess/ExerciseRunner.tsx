import { useEffect, useState, type ComponentType } from "react";
import type { DayPlan, ExerciseType } from "../../data/chessCurriculum";
import type { DrillProps, DrillResult } from "./types";
import { SquareColorDrill } from "./drills/SquareColorDrill";
import { LineAttackDrill } from "./drills/LineAttackDrill";
import { KnightSightDrill } from "./drills/KnightSightDrill";
import { PieceTrackingDrill } from "./drills/PieceTrackingDrill";
import { PositionRecallDrill } from "./drills/PositionRecallDrill";
import { NotationReplayDrill } from "./drills/NotationReplayDrill";
import { BlindfoldPuzzleDrill } from "./drills/BlindfoldPuzzleDrill";
import { BlindfoldGameDrill } from "./drills/BlindfoldGameDrill";

const DRILLS: Record<ExerciseType, ComponentType<DrillProps>> = {
  "square-color": SquareColorDrill,
  "line-attack": LineAttackDrill,
  "knight-sight": KnightSightDrill,
  "piece-tracking": PieceTrackingDrill,
  "position-recall": PositionRecallDrill,
  "notation-replay": NotationReplayDrill,
  "blindfold-puzzle": BlindfoldPuzzleDrill,
  "blindfold-game": BlindfoldGameDrill,
};

const TARGET_SEC = 20 * 60;

interface ExerciseRunnerProps {
  plan: DayPlan;
  onComplete: (result: DrillResult & { timeSpentSec: number; exerciseType: string }) => void;
  onCancel?: () => void;
}

export function ExerciseRunner({ plan, onComplete, onCancel }: ExerciseRunnerProps) {
  const [startedAt] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  function handleFinish(result: DrillResult) {
    const timeSpentSec = Math.round((Date.now() - startedAt) / 1000);
    onComplete({ ...result, timeSpentSec, exerciseType: plan.exerciseType });
  }

  const Drill = DRILLS[plan.exerciseType];
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  return (
    <div className="pixel-panel chess-runner">
      <div className="row chess-runner-header">
        <div>
          <div className="chess-runner-title">
            Day {plan.day}: {plan.title}
          </div>
          <div className="muted">{plan.skillFocus}</div>
        </div>
        <div className={`chess-timer ${elapsedSec >= TARGET_SEC ? "chess-timer--over" : ""}`}>
          {mm}:{ss} / 20:00
        </div>
      </div>
      <p className="chess-instructions">{plan.instructions}</p>
      {Drill ? <Drill key={plan.day} params={plan.params} onFinish={handleFinish} /> : <p className="muted">Unknown exercise type.</p>}
      {onCancel && (
        <button className="pixel-btn" type="button" onClick={onCancel}>
          Back
        </button>
      )}
    </div>
  );
}
