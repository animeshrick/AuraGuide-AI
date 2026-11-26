import React from "react";
import { Trash2 } from "lucide-react";
import { formatHour } from "@/domain/labels";
import { LIMITS } from "@/domain/limits";
import type { OutdoorActivity } from "@/domain/types";
import type { Dictionary } from "@/i18n";
import { formatMessage } from "@/i18n";
import { INPUT_CLASS, LABEL_CLASS } from "./fieldStyles";
import { NumberField } from "./NumberField";
import { TextField } from "./TextField";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface ActivityRowProps {
  id: string;
  index: number;
  memberLabel: string;
  activity: OutdoorActivity;
  /** Changes when a sample household is loaded, so the number field shows the new value. */
  version: number;
  dict: Dictionary;
  onChange: (updates: Partial<OutdoorActivity>) => void;
  onRemove: () => void;
}

/** A labelled drop-down of the 24 hours of the day. */
const HourSelect: React.FC<{
  id: string;
  label: string;
  value: number;
  onChange: (hour: number) => void;
}> = ({ id, label, value, onChange }) => (
  <div>
    <label htmlFor={id} className={LABEL_CLASS}>
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={INPUT_CLASS}
    >
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {formatHour(h)}
        </option>
      ))}
    </select>
  </div>
);

/** One outdoor activity: what it is, when, and for how long. */
export const ActivityRow: React.FC<ActivityRowProps> = ({
  id,
  index,
  memberLabel,
  activity,
  version,
  dict,
  onChange,
  onRemove,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end rounded-lg bg-white border border-slate-200 p-3">
    <div className="sm:col-span-5">
      <TextField
        id={`${id}-desc`}
        label={dict.form.activityDescription}
        value={activity.description}
        maxLength={LIMITS.activityDescriptionMaxLength}
        placeholder={dict.form.activityDescriptionPlaceholder}
        onChange={(description) => onChange({ description })}
      />
    </div>
    <div className="sm:col-span-3">
      <HourSelect
        id={`${id}-hour`}
        label={dict.form.activityHour}
        value={activity.preferredHour}
        onChange={(preferredHour) => onChange({ preferredHour })}
      />
    </div>
    <div className="sm:col-span-3">
      <NumberField
        key={`${version}-${index}-mins`}
        id={`${id}-mins`}
        label={dict.form.activityDuration}
        defaultValue={activity.durationMinutes}
        min={LIMITS.minActivityMinutes}
        max={LIMITS.maxActivityMinutes}
        step={5}
        integer
        onChange={(durationMinutes) => onChange({ durationMinutes })}
      />
    </div>
    <div className="sm:col-span-1 flex sm:justify-end">
      <button
        type="button"
        onClick={onRemove}
        className="text-slate-600 hover:text-rose-700 p-2 rounded transition"
        aria-label={formatMessage(dict.form.removeActivity, { n: index + 1, name: memberLabel })}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  </div>
);
