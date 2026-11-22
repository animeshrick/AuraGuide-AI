import React from "react";
import { INPUT_CLASS, LABEL_CLASS } from "./fieldStyles";

interface NumberFieldProps {
  id: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  /** Whole numbers are rounded before they reach `onChange`. */
  integer?: boolean;
  onChange: (value: number) => void;
}

/**
 * A labelled number input. It is uncontrolled so a half-typed value (an empty
 * field, a lone minus sign) does not fight the state; only finite numbers are passed on.
 * Give it a new `key` to show a value loaded from elsewhere.
 */
export const NumberField: React.FC<NumberFieldProps> = ({
  id,
  label,
  defaultValue,
  min,
  max,
  step,
  integer = false,
  onChange,
}) => (
  <div>
    <label htmlFor={id} className={LABEL_CLASS}>
      {label}
    </label>
    <input
      id={id}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      min={min}
      max={max}
      step={step}
      required
      defaultValue={defaultValue}
      onChange={(e) => {
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(integer ? Math.round(n) : n);
      }}
      className={INPUT_CLASS}
    />
  </div>
);
