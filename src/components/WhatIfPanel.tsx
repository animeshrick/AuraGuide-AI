"use client";

import React, { useId, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { staysAtHome } from "@/domain/modes";
import type { HouseholdMember, HouseholdProfile } from "@/domain/types";
import type { Dictionary, SupportedLanguage } from "@/i18n";
import { formatMessage } from "@/i18n";
import { LabelledSelect } from "./LabelledSelect";
import { SectionHeader } from "./SectionHeader";
import { RequestErrorBanner } from "./StatusBanner";
import { CARD, NOTICE } from "./styles";
import type { OptionMode } from "./whatif/ModeChoices";
import { ModeChoices } from "./whatif/ModeChoices";
import { QuestionForm } from "./whatif/QuestionForm";
import { useWhatIf } from "./whatif/useWhatIf";
import { WhatIfResultView } from "./whatif/WhatIfAnswer";

interface WhatIfPanelProps {
  profile: HouseholdProfile;
  language: SupportedLanguage;
  dict: Dictionary;
}

/**
 * The other ways this member could travel, or a note that they have no trip to
 * change because they stay at home or travel no distance.
 */
const TravelOptions: React.FC<{
  labelId: string;
  member: HouseholdMember;
  activeMode: OptionMode | null;
  disabled: boolean;
  dict: Dictionary;
  onChoose: (mode: OptionMode) => void;
}> = ({ labelId, member, activeMode, disabled, dict, onChoose }) => {
  const hasTrip = !staysAtHome(member.commuteMode) && member.commuteDistanceKm > 0;
  if (!hasTrip) {
    return (
      <p className={NOTICE}>
        {formatMessage(dict.whatIf.unmatched.no_commute, { name: member.name })}
      </p>
    );
  }
  return (
    <ModeChoices
      labelId={labelId}
      currentMode={member.commuteMode}
      activeMode={activeMode}
      disabled={disabled}
      dict={dict}
      onChoose={onChoose}
    />
  );
};

/** Which member the question is about. `onChange` runs before the choice changes. */
function useChosenMember(profile: HouseholdProfile, onChange: () => void) {
  const [memberId, setMemberId] = useState(profile.members[0]?.id ?? "");
  const member = profile.members.find((m) => m.id === memberId) ?? profile.members[0];
  const chooseMember = (id: string) => {
    onChange();
    setMemberId(id);
  };
  return { memberId, member, chooseMember };
}

/** "What if I travel a different way?": pick a member and a mode, or type a question. */
export const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ profile, language, dict }) => {
  const uid = useId();
  const [activeMode, setActiveMode] = useState<OptionMode | null>(null);
  const { loading, result, error, ask, reset, clearError } = useWhatIf(profile, language);
  const { memberId, member, chooseMember } = useChosenMember(profile, () => {
    // An answer about one person must not stay on screen under another person's name.
    reset();
    setActiveMode(null);
  });

  const chooseMode = (mode: OptionMode) => {
    if (!member) return;
    setActiveMode(mode);
    const question = formatMessage(dict.whatIf.optionQuestion, {
      name: member.name,
      mode: dict.whatIf.options[mode],
    });
    void ask(question, memberId, mode);
  };

  return (
    <section aria-labelledby={`${uid}-h`} className={`${CARD} space-y-6`}>
      <SectionHeader
        id={`${uid}-h`}
        icon={MessageCircleQuestion}
        title={dict.sections.whatIfTitle}
        intro={dict.whatIf.intro}
        largeIntro
      />

      <LabelledSelect
        id={`${uid}-who`}
        label={dict.whatIf.who}
        value={memberId}
        options={profile.members.map((m) => ({ value: m.id, label: m.name }))}
        onChange={chooseMember}
        className="max-w-sm"
      />

      {member && (
        <TravelOptions
          labelId={`${uid}-pick`}
          member={member}
          activeMode={activeMode}
          disabled={loading}
          dict={dict}
          onChoose={chooseMode}
        />
      )}

      <QuestionForm
        id={`${uid}-q`}
        loading={loading}
        dict={dict}
        onAsk={(question) => {
          setActiveMode(null);
          void ask(question, memberId);
        }}
      />

      <RequestErrorBanner error={error} dict={dict} onDismiss={clearError} />

      <div aria-live="polite" aria-atomic="true">
        {result && <WhatIfResultView result={result} dict={dict} />}
      </div>
    </section>
  );
};
