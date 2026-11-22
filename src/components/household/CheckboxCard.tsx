import React from "react";
import { CHECKBOX_CLASS } from "./fieldStyles";

interface CheckboxCardProps {
  id?: string;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/** A checkbox shown as a card, with a title and a short explanation. */
export const CheckboxCard: React.FC<CheckboxCardProps> = ({
  id,
  title,
  hint,
  checked,
  onChange,
  className = "p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50",
}) => (
  <label htmlFor={id} className={`flex items-start gap-3 cursor-pointer transition ${className}`}>
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={CHECKBOX_CLASS}
    />
    <span>
      <span className="text-sm font-semibold text-slate-900 block">{title}</span>
      <span className="text-xs text-slate-600 block">{hint}</span>
    </span>
  </label>
);
