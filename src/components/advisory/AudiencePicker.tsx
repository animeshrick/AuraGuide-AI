import React from "react";
import { ADVISORY_AUDIENCES, AdvisoryAudience } from "@/domain/types";
import type { Dictionary } from "@/i18n";

interface AudiencePickerProps {
  name: string;
  value: AdvisoryAudience;
  dict: Dictionary;
  onChange: (audience: AdvisoryAudience) => void;
}

/** Radio buttons, styled as pills, for who the advisory is written for. */
export const AudiencePicker: React.FC<AudiencePickerProps> = ({ name, value, dict, onChange }) => (
  <fieldset>
    <legend className="text-xs font-medium text-slate-800 mb-2">{dict.advisory.audience}</legend>
    <div className="flex flex-wrap gap-2">
      {ADVISORY_AUDIENCES.map((a) => (
        <label
          key={a}
          className={`cursor-pointer text-sm px-3 py-1.5 rounded-lg border transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-700 ${
            value === a
              ? "bg-sky-700 text-white border-sky-700"
              : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={a}
            checked={value === a}
            onChange={() => onChange(a)}
            className="sr-only"
          />
          {dict.advisory.audiences[a]}
        </label>
      ))}
    </div>
  </fieldset>
);
