import {
  formatLifeBounds,
  type LifeDebugSnapshot,
} from "@/lib/game-of-life-debug";

type Props = {
  debugSnapshot: LifeDebugSnapshot;
};

export function GameOfLifeDebugPanel({ debugSnapshot }: Props) {
  return (
    <div className="rounded-2xl border border-white/12 bg-slate-950/92 px-3 py-2 font-mono text-[0.65rem] leading-5 text-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.9)]">
      <p className="text-[0.55rem] uppercase tracking-[0.24em] text-slate-400">
        Autofit Debug
      </p>
      <p>All: {debugSnapshot.universeLiveCount}</p>
      <p>Gliders: {debugSnapshot.gliderCount}</p>
      <p>Fit live: {debugSnapshot.autofitLiveCount}</p>
      <p>Span: {debugSnapshot.viewportBaseSpan}</p>
      <p>Auto span: {debugSnapshot.autofitTargetSpan ?? "n/a"}</p>
      <p>All box: {formatLifeBounds(debugSnapshot.universeBounds)}</p>
      <p>Fit box: {formatLifeBounds(debugSnapshot.autofitBounds)}</p>
    </div>
  );
}
