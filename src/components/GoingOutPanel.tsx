import React, { useId, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { formatHour } from "@/domain/labels";
import type { OutingAdvice, OutingDuration, OutingMode } from "@/domain/outing";
import { OUTING_DURATIONS, OUTING_MODES, outingModeFor, planOuting } from "@/domain/outing";
import type { HourlyAirQuality, HouseholdProfile } from "@/domain/types";
import type { Dictionary } from "@/i18n";
import { LabelledSelect } from "./LabelledSelect";
import { OutingAdviceView } from "./outing/OutingAdviceView";
import { SectionHeader } from "./SectionHeader";
import { CARD, NOTICE } from "./styles";

interface GoingOutPanelProps {
  profile: HouseholdProfile;
  hourly: readonly HourlyAirQuality[];
  dict: Dictionary;
}

const DEFAULT_HOUR = 8;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: formatHour(hour),
}));

/** The advice for the chosen trip, or a note when there is no air data for that hour. */
const OutingResult: React.FC<{
  advice: OutingAdvice | null;
  memberName: string;
  hour: number;
  dict: Dictionary;
}> = ({ advice, memberName, hour, dict }) =>
  advice ? (
    <OutingAdviceView advice={advice} memberName={memberName} time={formatHour(hour)} dict={dict} />
  ) : (
    <p className={NOTICE}>{dict.outing.noData}</p>
  );

/**
 * "I have to go out at this time." Live, with no submit button: the person, the hour, the length
 * of the trip and the way of travelling are chosen, and the verdict and steps follow at once.
 */
export const GoingOutPanel: React.FC<GoingOutPanelProps> = ({ profile, hourly, dict }) => {
  const uid = useId();
  const t = dict.outing;

  const [memberId, setMemberId] = useState(profile.members[0]?.id ?? "");
  const [hour, setHour] = useState(DEFAULT_HOUR);
  const [duration, setDuration] = useState<OutingDuration>("medium");
  // Null until the person picks one, so the way of travelling follows the chosen member.
  const [modeChoice, setModeChoice] = useState<OutingMode | null>(null);

  const member = profile.members.find((m) => m.id === memberId) ?? profile.members[0];
  const mode = modeChoice ?? (member ? outingModeFor(member.commuteMode) : "on_foot");

  const advice = useMemo(
    () => (member ? planOuting({ member, hourly, hour, duration, mode }) : null),
    [member, hourly, hour, duration, mode]
  );

  if (!member) return null;

  return (
    <section aria-labelledby={`${uid}-h`} className={`${CARD} space-y-5`}>
      <SectionHeader id={`${uid}-h`} icon={Clock} title={t.title} intro={t.intro} largeIntro />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LabelledSelect
          id={`${uid}-who`}
          label={t.who}
          value={member.id}
          options={profile.members.map((m) => ({ value: m.id, label: m.name }))}
          onChange={(id) => {
            setMemberId(id);
            setModeChoice(null);
          }}
        />
        <LabelledSelect
          id={`${uid}-when`}
          label={t.when}
          value={hour}
          options={HOUR_OPTIONS}
          onChange={setHour}
        />
        <LabelledSelect
          id={`${uid}-long`}
          label={t.duration}
          value={duration}
          options={OUTING_DURATIONS.map((d) => ({ value: d, label: t.durations[d] }))}
          onChange={setDuration}
        />
        <LabelledSelect
          id={`${uid}-how`}
          label={t.how}
          value={mode}
          options={OUTING_MODES.map((m) => ({ value: m, label: t.modes[m] }))}
          onChange={setModeChoice}
        />
      </div>

      <div aria-live="polite" aria-atomic="true" className="space-y-4">
        <OutingResult advice={advice} memberName={member.name} hour={hour} dict={dict} />
      </div>
    </section>
  );
};
