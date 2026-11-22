import React from "react";

interface LabelledSelectProps<T extends string | number> {
  id: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

const SELECT =
  "w-full min-h-[48px] px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-base";

/**
 * A large, labelled drop-down used in the results panels. Values keep their
 * type: numbers come back as numbers.
 */
export function LabelledSelect<T extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  className,
}: LabelledSelectProps<T>) {
  const toValue = (raw: string): T => (typeof value === "number" ? Number(raw) : raw) as T;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-base font-semibold text-slate-900 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(toValue(e.target.value))}
        className={SELECT}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
