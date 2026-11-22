import React from "react";
import type { CommuteMode } from "@/domain/types";
import type { Dictionary } from "@/i18n";
import { INPUT_CLASS, LABEL_CLASS } from "./fieldStyles";

/** Shown first, because most people looking for a stay-at-home option look at the top. */
const HOME_MODES: CommuteMode[] = ["homemaker", "work_from_home"];

const TRAVEL_MODES: CommuteMode[] = [
  "two_wheeler",
  "auto_rickshaw",
  "metro",
  "bus",
  "car_ice",
  "car_ev",
  "bicycle",
  "walk",
];

interface ModeSelectProps {
  id: string;
  value: CommuteMode;
  dict: Dictionary;
  onChange: (mode: CommuteMode) => void;
}

/** How a member spends the working day: at home, or travelling by one mode. */
export const ModeSelect: React.FC<ModeSelectProps> = ({ id, value, dict, onChange }) => (
  <div>
    <label htmlFor={id} className={LABEL_CLASS}>
      {dict.form.commuteMode}
    </label>
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as CommuteMode)}
      className={INPUT_CLASS}
    >
      <optgroup label={dict.form.modeGroupHome}>
        {HOME_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {dict.modes[mode]}
          </option>
        ))}
      </optgroup>
      <optgroup label={dict.form.modeGroupTravel}>
        {TRAVEL_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {dict.modes[mode]}
          </option>
        ))}
      </optgroup>
    </select>
  </div>
);
