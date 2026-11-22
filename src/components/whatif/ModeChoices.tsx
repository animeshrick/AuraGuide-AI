import React from "react";
import { Bike, Bus, CarFront, Footprints, House, TrainFront } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CommuteMode } from "@/domain/types";
import type { Dictionary } from "@/i18n";

/** The few ways of travelling offered as big buttons. Anything else can be typed as a question. */
const OPTION_MODES = ["metro", "bus", "bicycle", "walk", "car_ev", "work_from_home"] as const;
export type OptionMode = (typeof OPTION_MODES)[number];

const OPTION_ICONS: Record<OptionMode, LucideIcon> = {
  metro: TrainFront,
  bus: Bus,
  bicycle: Bike,
  walk: Footprints,
  car_ev: CarFront,
  work_from_home: House,
};

interface ModeChoicesProps {
  labelId: string;
  currentMode: CommuteMode;
  activeMode: OptionMode | null;
  disabled: boolean;
  dict: Dictionary;
  onChoose: (mode: OptionMode) => void;
}

/** Large buttons for the other ways this member could travel. */
export const ModeChoices: React.FC<ModeChoicesProps> = ({
  labelId,
  currentMode,
  activeMode,
  disabled,
  dict,
  onChoose,
}) => (
  <div>
    <p id={labelId} className="text-base font-semibold text-slate-900 mb-2">
      {dict.whatIf.pickMode}
    </p>
    <div role="group" aria-labelledby={labelId} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {OPTION_MODES.filter((mode) => mode !== currentMode).map((mode) => {
        const Icon = OPTION_ICONS[mode];
        const selected = activeMode === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChoose(mode)}
            className={`flex items-center justify-center gap-2 min-h-[56px] px-3 py-2 rounded-xl border-2 text-base font-semibold transition disabled:opacity-60 ${
              selected
                ? "bg-sky-700 text-white border-sky-700"
                : "bg-white text-slate-900 border-slate-300 hover:border-sky-600 hover:bg-sky-50"
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
            {dict.whatIf.options[mode]}
          </button>
        );
      })}
    </div>
  </div>
);
