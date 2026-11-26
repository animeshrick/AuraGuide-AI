import React from "react";
import { INPUT_CLASS, LABEL_CLASS } from "./fieldStyles";

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
  /** A short help line shown under the field and read out with it. */
  hint?: string;
  /** Extra classes for the input, for example a larger size. */
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (value: string) => void;
}

/** A required, labelled text input with an optional hint. */
export const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  value,
  maxLength,
  minLength,
  placeholder,
  autoComplete,
  hint,
  inputClassName = "",
  inputRef,
  onChange,
}) => (
  <div>
    <label htmlFor={id} className={LABEL_CLASS}>
      {label}
    </label>
    <input
      id={id}
      ref={inputRef}
      type="text"
      required
      minLength={minLength}
      maxLength={maxLength}
      autoComplete={autoComplete}
      value={value}
      placeholder={placeholder}
      aria-describedby={hint ? `${id}-hint` : undefined}
      onChange={(e) => onChange(e.target.value)}
      className={`${INPUT_CLASS} ${inputClassName}`.trim()}
    />
    {hint && (
      <p id={`${id}-hint`} className="text-xs text-slate-600 mt-1">
        {hint}
      </p>
    )}
  </div>
);
