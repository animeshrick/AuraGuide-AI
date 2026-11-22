import React from "react";
import { Plus, Sun } from "lucide-react";
import { LIMITS } from "@/domain/limits";
import type { HouseholdMember } from "@/domain/types";
import type { Dictionary } from "@/i18n";
import { ActivityRow } from "./ActivityRow";
import type { MemberActions } from "./useHouseholdForm";

interface ActivityListProps {
  id: string;
  member: HouseholdMember;
  memberLabel: string;
  version: number;
  dict: Dictionary;
  actions: Pick<MemberActions, "addActivity" | "updateActivity" | "removeActivity">;
}

/** A member's regular outdoor activities, with add and remove buttons. */
export const ActivityList: React.FC<ActivityListProps> = ({
  id,
  member,
  memberLabel,
  version,
  dict,
  actions,
}) => (
  <fieldset className="pt-2 border-t border-slate-200/60 space-y-3">
    <legend className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
      <Sun className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
      {dict.form.outdoorActivity}
    </legend>
    <p className="text-xs text-slate-600">{dict.form.outdoorHint}</p>

    {member.outdoorActivities.length === 0 && (
      <p className="text-xs text-slate-600 italic">{dict.form.noActivities}</p>
    )}

    {member.outdoorActivities.map((activity, index) => (
      <ActivityRow
        key={index}
        id={`${id}-act-${index}`}
        index={index}
        memberLabel={memberLabel}
        activity={activity}
        version={version}
        dict={dict}
        onChange={(updates) => actions.updateActivity(member.id, index, updates)}
        onRemove={() => actions.removeActivity(member.id, index)}
      />
    ))}

    {member.outdoorActivities.length < LIMITS.maxActivitiesPerMember && (
      <button
        type="button"
        onClick={() => actions.addActivity(member.id)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 text-slate-800 hover:bg-white text-xs font-medium transition"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        {dict.form.addActivity}
      </button>
    )}
  </fieldset>
);
