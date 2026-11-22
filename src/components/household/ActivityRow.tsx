import React from "react";
import { Trash2 } from "lucide-react";
import { formatHour } from "@/domain/labels";
import { LIMITS } from "@/domain/limits";
import type { OutdoorActivity } from "@/domain/types";
import { Dictionary, formatMessage } from "@/i18n";
import { INPUT_CLASS, LABEL_CLASS } from "./fieldStyles";
import { NumberField } from "./NumberField";

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
      <label htmlFor={`${id}-desc`} className={LABEL_CLASS}>
        {dict.form.activityDescription}
      </label>
      <input
        id={`${id}-desc`}
        type="text"
        required
        maxLength={LIMITS.activityDescriptionMaxLength}
        value={activity.description}
        placeholder={dict.form.activityDescriptionPlaceholder}
        onChange={(e) => onChange({ description: e.target.value })}
        className={INPUT_CLASS}
      />
    </div>
    <div className="sm:col-span-3">
      <label htmlFor={`${id}-hour`} className={LABEL_CLASS}>
        {dict.form.activityHour}
      </label>
      <select
        id={`${id}-hour`}
        value={activity.preferredHour}
        onChange={(e) => onChange({ preferredHour: Number(e.target.value) })}
        className={INPUT_CLASS}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {formatHour(h)}
          </option>
        ))}
      </select>
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
