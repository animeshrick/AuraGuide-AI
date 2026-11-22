import React from "react";
import { Trash2 } from "lucide-react";
import { LIMITS } from "@/domain/limits";
import { staysAtHome } from "@/domain/modes";
import type { HouseholdMember } from "@/domain/types";
import { Dictionary, formatMessage } from "@/i18n";
import { ActivityList } from "./ActivityList";
import { CheckboxCard } from "./CheckboxCard";
import { CommuteFields } from "./CommuteFields";
import { INPUT_CLASS, LABEL_CLASS } from "./fieldStyles";
import { ModeSelect } from "./ModeSelect";
import { NumberField } from "./NumberField";
import { SensitivityPicker } from "./SensitivityPicker";
import type { MemberActions } from "./useHouseholdForm";

interface MemberCardProps {
  uid: string;
  index: number;
  member: HouseholdMember;
  canRemove: boolean;
  version: number;
  dict: Dictionary;
  actions: MemberActions;
}

/** The member's number, with a remove button when there is more than one member. */
const MemberHeader: React.FC<{
  heading: string;
  label: string;
  canRemove: boolean;
  dict: Dictionary;
  onRemove: () => void;
}> = ({ heading, label, canRemove, dict, onRemove }) => (
  <div className="flex items-center justify-between">
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{heading}</h3>
    {canRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="text-slate-600 hover:text-rose-700 p-1 rounded transition"
        aria-label={formatMessage(dict.form.removeMember, { name: label })}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

/** Name, age and how the member spends the day. */
const MemberBasics: React.FC<{
  id: string;
  member: HouseholdMember;
  version: number;
  dict: Dictionary;
  onChange: (updates: Partial<HouseholdMember>) => void;
  registerNameInput: (el: HTMLInputElement | null) => void;
}> = ({ id: mid, member, version, dict, onChange, registerNameInput }) => (
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
    <div className="sm:col-span-2">
      <label htmlFor={`${mid}-name`} className={LABEL_CLASS}>
        {dict.form.memberName}
      </label>
      <input
        id={`${mid}-name`}
        ref={registerNameInput}
        type="text"
        required
        maxLength={LIMITS.memberNameMaxLength}
        value={member.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className={INPUT_CLASS}
      />
    </div>
    <NumberField
      key={`${version}-age`}
      id={`${mid}-age`}
      label={dict.form.age}
      defaultValue={member.age}
      min={0}
      max={LIMITS.maxAge}
      step={1}
      integer
      onChange={(age) => onChange({ age })}
    />
    <ModeSelect
      id={`${mid}-mode`}
      value={member.commuteMode}
      dict={dict}
      onChange={(commuteMode) => onChange({ commuteMode })}
    />
  </div>
);

/** Everything about one household member: who they are, their day and their health. */
export const MemberCard: React.FC<MemberCardProps> = ({
  uid,
  index,
  member,
  canRemove,
  version,
  dict,
  actions,
}) => {
  const mid = `${uid}-${member.id}`;
  const heading = formatMessage(dict.form.memberNumber, { n: index + 1 });
  const label = member.name.trim() || heading;
  const update = (updates: Partial<HouseholdMember>) => actions.updateMember(member.id, updates);

  return (
    <li className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4">
      <MemberHeader
        heading={heading}
        label={label}
        canRemove={canRemove}
        dict={dict}
        onRemove={() => actions.removeMember(member.id)}
      />
      <MemberBasics
        id={mid}
        member={member}
        version={version}
        dict={dict}
        onChange={update}
        registerNameInput={(el) => actions.registerNameInput(member.id, el)}
      />

      {!staysAtHome(member.commuteMode) && (
        <CommuteFields id={mid} member={member} version={version} dict={dict} onChange={update} />
      )}

      <SensitivityPicker
        dict={dict}
        selected={member.sensitivities}
        onToggle={(sens) => actions.toggleMemberSensitivity(member.id, sens)}
      />

      <CheckboxCard
        id={`${mid}-smokes`}
        title={dict.form.smokes}
        hint={dict.form.smokesHint}
        checked={member.smokes === true}
        onChange={(checked) => update({ smokes: checked ? true : undefined })}
        className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
      />

      <ActivityList
        id={mid}
        member={member}
        memberLabel={label}
        version={version}
        dict={dict}
        actions={actions}
      />
    </li>
  );
};
