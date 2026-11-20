import React, { useId, useMemo } from "react";
import { Info, Moon, ShieldAlert, ShieldCheck, Sprout, Sun, SunDim } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PlantLight, suggestPlants } from "@/domain/plants";
import { HouseholdProfile } from "@/domain/types";
import { Dictionary } from "@/i18n";
import { CARD, SECTION_HEADING } from "./styles";

interface PlantsPanelProps {
  profile: HouseholdProfile;
  dict: Dictionary;
}

const LIGHT_ICONS: Record<PlantLight, LucideIcon> = {
  low: Moon,
  bright: SunDim,
  sun: Sun,
};

/**
 * Easy house plants that suit the household. The card says plainly, before the list, that plants
 * do not clean smog out of a room, so nobody relies on them for that.
 */
export const PlantsPanel: React.FC<PlantsPanelProps> = ({ profile, dict }) => {
  const headingId = useId();
  const t = dict.plants;
  const { plants, notes } = useMemo(() => suggestPlants(profile), [profile]);

  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <div>
        <h2 id={headingId} className={SECTION_HEADING}>
          <Sprout className="w-5 h-5 text-emerald-700" aria-hidden="true" />
          {t.title}
        </h2>
        <p className="text-base text-slate-800 mt-1 leading-relaxed">{t.intro}</p>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="text-base font-bold text-sky-950">{t.honestTitle}</h3>
          <p className="text-base text-sky-950 mt-1 leading-relaxed">{t.honest}</p>
        </div>
      </div>

      {notes.length > 0 && (
        <ul className="space-y-1 text-base text-slate-900">
          {notes.map((note) => (
            <li key={note} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
              {t.notes[note]}
            </li>
          ))}
        </ul>
      )}

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map((plant) => {
          const LightIcon = LIGHT_ICONS[plant.light];
          const SafeIcon = plant.childSafe ? ShieldCheck : ShieldAlert;
          const info = t.plants[plant.id];
          return (
            <li key={plant.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-bold text-slate-900">{info.name}</h3>
              <p className="text-base text-slate-800 mt-1 leading-relaxed">{info.tip}</p>
              <p className="flex items-start gap-2 text-sm text-slate-800 mt-3">
                <LightIcon className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                {t.light[plant.light]}
              </p>
              <p className="flex items-start gap-2 text-sm text-slate-800 mt-1">
                <SafeIcon
                  className={`w-4 h-4 shrink-0 mt-0.5 ${plant.childSafe ? "text-emerald-700" : "text-rose-700"}`}
                  aria-hidden="true"
                />
                {plant.childSafe ? t.safeYes : t.safeNo}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
