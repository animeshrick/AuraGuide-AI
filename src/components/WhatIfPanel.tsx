"use client";

import React, { useId, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { staysAtHome } from "@/domain/modes";
import type { HouseholdProfile } from "@/domain/types";
import { Dictionary, formatMessage, SupportedLanguage } from "@/i18n";
import { LabelledSelect } from "./LabelledSelect";
import { StatusBanner } from "./StatusBanner";
import { CARD, SECTION_HEADING } from "./styles";
import { ModeChoices, OptionMode } from "./whatif/ModeChoices";
import { QuestionForm } from "./whatif/QuestionForm";
import { useWhatIf } from "./whatif/useWhatIf";
import { WhatIfAnswer } from "./whatif/WhatIfAnswer";

interface WhatIfPanelProps {
  profile: HouseholdProfile;
  language: SupportedLanguage;
  dict: Dictionary;
}

const NOTICE = "rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950";

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
      <div>
        <h2 id={`${uid}-h`} className={SECTION_HEADING}>
          <MessageCircleQuestion className="w-5 h-5 text-sky-700" aria-hidden="true" />
          {dict.sections.whatIfTitle}
        </h2>
        <p className="text-base text-slate-800 mt-1 leading-relaxed">{dict.whatIf.intro}</p>
      </div>

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
      {member && !canChange && (
        <p className={NOTICE}>
          {formatMessage(dict.whatIf.unmatched.no_commute, { name: member.name })}
        </p>
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

      {error && (
        <StatusBanner
          tone="error"
          title={dict.errors.title}
          onDismiss={clearError}
          dismissLabel={dict.errors.dismiss}
        >
          {dict.errors[error]}
        </StatusBanner>
      )}

      <div aria-live="polite" aria-atomic="true">
        {result && !result.matched && (
          <p className={NOTICE}>
            {formatMessage(dict.whatIf.unmatched[result.reason], { name: result.memberName })}
          </p>
        )}
        {result && result.matched && <WhatIfAnswer result={result} dict={dict} />}
      </div>
    </section>
  );
};
