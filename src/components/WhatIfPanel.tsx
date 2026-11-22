"use client";

import React, { useId, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { staysAtHome } from "@/domain/modes";
import type { HouseholdProfile } from "@/domain/types";
import { Dictionary, formatMessage, SupportedLanguage } from "@/i18n";
import { LabelledSelect } from "./LabelledSelect";
import { SectionHeader } from "./SectionHeader";
import { RequestErrorBanner } from "./StatusBanner";
import { CARD, NOTICE } from "./styles";
import { ModeChoices, OptionMode } from "./whatif/ModeChoices";
import { QuestionForm } from "./whatif/QuestionForm";
import { useWhatIf } from "./whatif/useWhatIf";
import { WhatIfResultView } from "./whatif/WhatIfAnswer";

interface WhatIfPanelProps {
  profile: HouseholdProfile;
  language: SupportedLanguage;
  dict: Dictionary;
}

/** Shown when the chosen member does not travel, so there is no trip to change. */
const NoCommuteNotice: React.FC<{ name: string; dict: Dictionary }> = ({ name, dict }) => (
  <p className={NOTICE}>{formatMessage(dict.whatIf.unmatched.no_commute, { name })}</p>
);

/** "What if I travel a different way?": pick a member and a mode, or type a question. */
export const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ profile, language, dict }) => {
  const uid = useId();
  const [memberId, setMemberId] = useState(profile.members[0]?.id ?? "");
  const [activeMode, setActiveMode] = useState<OptionMode | null>(null);
  const { loading, result, error, ask, reset, clearError } = useWhatIf(profile, language);

  const member = profile.members.find((m) => m.id === memberId) ?? profile.members[0];
  const canChange = !!member && !staysAtHome(member.commuteMode) && member.commuteDistanceKm > 0;

  const chooseMember = (id: string) => {
    // An answer about one person must not stay on screen under another person's name.
    reset();
    setMemberId(id);
    setActiveMode(null);
  };

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

      {member && canChange && (
        <ModeChoices
          labelId={`${uid}-pick`}
          currentMode={member.commuteMode}
          activeMode={activeMode}
          disabled={loading}
          dict={dict}
          onChoose={chooseMode}
        />
      )}
      {member && !canChange && <NoCommuteNotice name={member.name} dict={dict} />}

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
