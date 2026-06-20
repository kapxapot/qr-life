import { RiDragMove2Line, RiPencilLine } from "@remixicon/react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";

export type GameOfLifeInteractionMode = "edit" | "pan";

type Props = {
  interactionMode: GameOfLifeInteractionMode;
  onInteractionModeChange: (nextMode: GameOfLifeInteractionMode) => void;
};

const MODE_OPTIONS = [
  {
    icon: RiDragMove2Line,
    label: "Pan",
    value: "pan",
  },
  {
    icon: RiPencilLine,
    label: "Edit",
    value: "edit",
  },
] as const satisfies readonly {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: GameOfLifeInteractionMode;
}[];

export function GameOfLifeModeSwitch({
  interactionMode,
  onInteractionModeChange,
}: Props) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1 rounded-full border border-white/12 bg-slate-950/94 p-1 shadow-[0_18px_40px_-24px_rgba(8,145,178,0.7)] backdrop-blur-sm">
      {MODE_OPTIONS.map(({ icon: Icon, label, value }) => {
        const isActive = interactionMode === value;

        return (
          <Button
            key={value}
            type="button"
            variant={isActive ? "aurora" : "glass"}
            aria-pressed={isActive}
            aria-label={label}
            onClick={() => {
              onInteractionModeChange(value);
            }}
            className="size-7 p-0 sm:size-11"
          >
            <Icon className="size-4 sm:size-6" />
          </Button>
        );
      })}
    </div>
  );
}
