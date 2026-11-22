import React from "react";
import { Check } from "lucide-react";
import type { HealthSensitivity } from "@/domain/types";
import type { Dictionary } from "@/i18n";
import { LABEL_CLASS } from "./fieldStyles";

const SENSITIVITIES: HealthSensitivity[] = [
  "none",
  "asthma",
  "cardiac",
  "pregnant",
  "infant",
  "elderly",
  "outdoor_worker",
];

interface SensitivityPickerProps {
  dict: Dictionary;
  selected: readonly HealthSensitivity[];
  onToggle: (sensitivity: HealthSensitivity) => void;
}

/** Toggle buttons for a member's health sensitivities. */
export const SensitivityPicker: React.FC<SensitivityPickerProps> = ({
  dict,
  selected,
  onToggle,
}) => (
  <fieldset>
    <legend className={`${LABEL_CLASS} mb-1.5`}>{dict.form.sensitivities}</legend>
    <div className="flex flex-wrap gap-1.5">
      {SENSITIVITIES.map((sens) => {
        const isOn = selected.includes(sens);
        return (
          <button
            key={sens}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(sens)}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition font-medium ${
              isOn
                ? "bg-sky-700 text-white border-sky-700"
                : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
            }`}
          >
            {isOn && <Check className="w-3 h-3" aria-hidden="true" />}
            {dict.form.sensitivityOptions[sens]}
          </button>
        );
      })}
    </div>
  </fieldset>
);
