import { RiCheckLine, RiFileCopyLine, RiShareLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";

export type CopyFeedbackState = "idle" | "copied" | "failed";
export type ShareFeedbackState = "idle" | "shared" | "copied" | "failed";

type Props = {
  canShareCurrentUrl: boolean;
  copyFeedback: CopyFeedbackState;
  onCopyQrValue: () => void;
  onReset: () => void;
  onScanAnother: () => void;
  onShareCurrentUrl: () => void;
  onStart: () => void;
  qrValue: string | null;
  shareFeedback: ShareFeedbackState;
  startButtonLabel: string;
};

export function GameOfLifeActionBar({
  canShareCurrentUrl,
  copyFeedback,
  onCopyQrValue,
  onReset,
  onScanAnother,
  onShareCurrentUrl,
  onStart,
  qrValue,
  shareFeedback,
  startButtonLabel,
}: Props) {
  const copyButtonLabel =
    copyFeedback === "copied"
      ? "Copied"
      : copyFeedback === "failed"
        ? "Retry"
        : "Copy";
  const CopyButtonIcon =
    copyFeedback === "copied" ? RiCheckLine : RiFileCopyLine;
  const shareButtonLabel =
    shareFeedback === "shared"
      ? "Shared"
      : shareFeedback === "copied"
        ? "Link copied"
        : shareFeedback === "failed"
          ? "Retry"
          : canShareCurrentUrl
            ? "Share"
            : "Sharing unavailable";
  const ShareButtonIcon =
    shareFeedback === "shared" || shareFeedback === "copied"
      ? RiCheckLine
      : RiShareLine;

  return (
    <div className="shrink-0 px-3 sm:px-4">
      <div className="flex flex-wrap gap-3 lg:justify-center">
        <Button
          type="button"
          onClick={onStart}
          variant="aurora"
          className="h-auto px-5 py-2.5 text-sm font-semibold"
        >
          {startButtonLabel}
        </Button>

        <Button
          type="button"
          onClick={onReset}
          variant="glass"
          className="h-auto px-5 py-2.5 text-sm font-semibold"
        >
          Reset
        </Button>

        <Button
          type="button"
          onClick={onScanAnother}
          variant="quiet"
          className="h-auto px-5 py-2.5 text-sm font-semibold"
        >
          New
        </Button>

        <div className="relative min-w-40 max-w-80 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 lg:w-80 lg:flex-none">
          <p className="truncate pr-10 font-mono text-xs leading-6 text-slate-300">
            {qrValue ?? "No QR captured yet."}
          </p>
          <div className="absolute inset-y-0 right-2 flex items-center">
            <Button
              type="button"
              onClick={onCopyQrValue}
              variant="quiet"
              className="h-8 min-w-8 rounded-full bg-slate-900/88 px-0 text-slate-200 hover:bg-slate-800"
              disabled={!qrValue}
              aria-label={copyButtonLabel}
              title={copyButtonLabel}
            >
              <CopyButtonIcon className="size-4" />
            </Button>
          </div>
        </div>

        <Button
          type="button"
          onClick={onShareCurrentUrl}
          variant="quiet"
          className="size-11 shrink-0 rounded-full border-white/10 bg-slate-950/70 text-slate-200 hover:bg-slate-900/88"
          disabled={!canShareCurrentUrl}
          aria-label={shareButtonLabel}
          title={shareButtonLabel}
        >
          <ShareButtonIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
