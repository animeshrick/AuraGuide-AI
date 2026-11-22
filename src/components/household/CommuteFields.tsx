import React from "react";
import { LIMITS } from "@/domain/limits";
import type { HouseholdMember } from "@/domain/types";
import type { Dictionary } from "@/i18n";
import { NumberField } from "./NumberField";

interface CommuteFieldsProps {
  id: string;
  member: HouseholdMember;
  version: number;
  dict: Dictionary;
  onChange: (updates: Partial<HouseholdMember>) => void;
}

/** Distance and time of a member's daily commute. */
export const CommuteFields: React.FC<CommuteFieldsProps> = ({
  id,
  member,
  version,
  dict,
  onChange,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
    <NumberField
      key={`${version}-dist`}
      id={`${id}-dist`}
      label={dict.form.commuteDist}
      defaultValue={member.commuteDistanceKm}
      min={0}
      max={LIMITS.maxCommuteDistanceKm}
      step={0.5}
      onChange={(commuteDistanceKm) => onChange({ commuteDistanceKm })}
    />
    <NumberField
      key={`${version}-time`}
      id={`${id}-time`}
      label={dict.form.commuteTime}
      defaultValue={member.commuteTimeMinutes}
      min={0}
      max={LIMITS.maxCommuteMinutes}
      step={1}
      integer
      onChange={(commuteTimeMinutes) => onChange({ commuteTimeMinutes })}
    />
  </div>
);
