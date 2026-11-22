"use client";

import React, { useId } from "react";
import { ArrowRight, Plus, Users } from "lucide-react";
import { LIMITS } from "@/domain/limits";
import type { HouseholdMember, HouseholdProfile } from "@/domain/types";
import { Dictionary, getDictionary, SupportedLanguage } from "@/i18n";
import { DemoPicker } from "./household/DemoPicker";
import { HomeSettings } from "./household/HomeSettings";
import { MemberCard } from "./household/MemberCard";
import { MemberActions, useHouseholdForm } from "./household/useHouseholdForm";

interface HouseholdFormProps {
  language: SupportedLanguage;
  onSubmit: (profile: HouseholdProfile) => void;
  isLoading: boolean;
  /** Values to start from, for example the last profile the person submitted. */
  initialProfile?: HouseholdProfile | null;
}

/** The button that sends the form, with a spinner while the plan is being written. */
const SubmitButton: React.FC<{ isLoading: boolean; dict: Dictionary }> = ({ isLoading, dict }) => (
  <div className="pt-2">
    <button
      type="submit"
      disabled={isLoading}
      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-sky-700 to-teal-700 hover:from-sky-800 hover:to-teal-800 text-white font-bold text-base shadow-lg shadow-sky-600/25 flex items-center justify-center gap-3 transition disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <span
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>{dict.form.generating}</span>
        </>
      ) : (
        <>
          <span>{dict.form.generatePlan}</span>
          <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </>
      )}
    </button>
  </div>
);

/** The list of member cards and the Add member button. */
const MembersSection: React.FC<{
  uid: string;
  members: HouseholdMember[];
  version: number;
  dict: Dictionary;
  onAdd: () => void;
  actions: MemberActions;
}> = ({ uid, members, version, dict, onAdd, actions }) => {
  const atMemberLimit = members.length >= LIMITS.maxMembers;
  return (
    <section
      aria-labelledby={`${uid}-members`}
      className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id={`${uid}-members`}
            className="text-lg font-bold text-slate-900 flex items-center gap-2"
          >
            <Users className="w-5 h-5 text-sky-700" aria-hidden="true" />
            {dict.form.members} ({members.length})
          </h2>
          <p className="text-xs text-slate-600">{dict.form.membersHint}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={atMemberLimit}
          title={atMemberLimit ? dict.form.maxMembers : undefined}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-400 text-sky-800 hover:bg-sky-50 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          {dict.form.addMember}
        </button>
      </div>

      <ul className="space-y-4">
        {members.map((member, index) => (
          <MemberCard
            key={member.id}
            uid={uid}
            index={index}
            member={member}
            canRemove={members.length > 1}
            version={version}
            dict={dict}
            actions={actions}
          />
        ))}
      </ul>
    </section>
  );
};

/** The household profile form: city, home settings and each member's day. */
export const HouseholdForm: React.FC<HouseholdFormProps> = ({
  language,
  onSubmit,
  isLoading,
  initialProfile,
}) => {
  const dict = getDictionary(language);
  const uid = useId();
  const form = useHouseholdForm(initialProfile);
  const { city, cookingFuel, usesIncenseOrCoils, hasAirPurifier, members, version } = form.values;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const profile = form.buildProfile(language);
    if (profile) onSubmit(profile);
  };

  return (
    <form onSubmit={handleSubmit} aria-busy={isLoading} className="space-y-8">
      <DemoPicker headingId={`${uid}-demo`} dict={dict} onPick={form.loadDemo} />

      <HomeSettings
        uid={uid}
        dict={dict}
        city={city}
        cookingFuel={cookingFuel}
        usesIncenseOrCoils={usesIncenseOrCoils}
        hasAirPurifier={hasAirPurifier}
        onCityChange={form.setCity}
        onCookingFuelChange={form.setCookingFuel}
        onIncenseChange={form.setUsesIncenseOrCoils}
        onPurifierChange={form.setHasAirPurifier}
      />

      <MembersSection
        uid={uid}
        members={members}
        version={version}
        dict={dict}
        onAdd={form.addMember}
        actions={form}
      />

      <SubmitButton isLoading={isLoading} dict={dict} />
    </form>
  );
};
