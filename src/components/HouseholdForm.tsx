"use client";

import React, { useId, useState } from "react";
import { Users, Plus, Trash2, Sparkles, MapPin, ArrowRight, Sun } from "lucide-react";
import {
  CommuteMode,
  CookingFuel,
  HealthSensitivity,
  HouseholdMember,
  HouseholdProfile,
  OutdoorActivity,
} from "@/domain/types";
import { formatHour } from "@/domain/labels";
import { formatMessage, getDictionary, SupportedLanguage } from "@/i18n";

interface HouseholdFormProps {
  language: SupportedLanguage;
  onSubmit: (profile: HouseholdProfile) => void;
  isLoading: boolean;
  /** Values to start from, for example the last profile the person submitted. */
  initialProfile?: HouseholdProfile | null;
}

type DemoKey = "demoDelhi" | "demoKolkata" | "demoPatna";

const MAX_MEMBERS = 10;
const MAX_ACTIVITIES = 5;

const COMMUTE_MODES: CommuteMode[] = [
  "two_wheeler",
  "auto_rickshaw",
  "metro",
  "bus",
  "car_ice",
  "car_ev",
  "bicycle",
  "walk",
  "work_from_home",
];

const SENSITIVITIES: HealthSensitivity[] = [
  "none",
  "asthma",
  "cardiac",
  "pregnant",
  "infant",
  "elderly",
  "outdoor_worker",
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-sky-600 focus:ring-1 focus:ring-sky-600";
const LABEL_CLASS = "block text-xs font-medium text-slate-800 mb-1";

const DEFAULT_PROFILE: HouseholdProfile = {
  city: "New Delhi",
  cookingFuel: "lpg",
  usesIncenseOrCoils: true,
  hasAirPurifier: false,
  members: [
    {
      id: "mem_1",
      name: "Rajesh",
      age: 40,
      sensitivities: ["none"],
      commuteMode: "two_wheeler",
      commuteDistanceKm: 12,
      commuteTimeMinutes: 40,
      outdoorActivities: [],
    },
    {
      id: "mem_2",
      name: "Meera",
      age: 38,
      sensitivities: ["asthma"],
      commuteMode: "metro",
      commuteDistanceKm: 8,
      commuteTimeMinutes: 30,
      outdoorActivities: [{ description: "Morning walk", preferredHour: 7, durationMinutes: 30 }],
    },
  ],
};

const DEMO_HOUSEHOLDS: { key: DemoKey; profile: HouseholdProfile }[] = [
  {
    key: "demoDelhi",
    profile: {
      city: "New Delhi",
      cookingFuel: "lpg",
      usesIncenseOrCoils: true,
      hasAirPurifier: false,
      members: [
        {
          id: "m1",
          name: "Rajesh (Father)",
          age: 42,
          sensitivities: ["none"],
          commuteMode: "two_wheeler",
          commuteDistanceKm: 14,
          commuteTimeMinutes: 45,
          outdoorActivities: [],
        },
        {
          id: "m2",
          name: "Sunita (Mother)",
          age: 38,
          sensitivities: ["asthma"],
          commuteMode: "auto_rickshaw",
          commuteDistanceKm: 6,
          commuteTimeMinutes: 25,
          outdoorActivities: [
            {
              description: "Morning yoga in balcony",
              preferredHour: 7,
              durationMinutes: 30,
            },
          ],
        },
        {
          id: "m3",
          name: "Aarav (Toddler)",
          age: 2,
          sensitivities: ["infant"],
          commuteMode: "work_from_home",
          commuteDistanceKm: 0,
          commuteTimeMinutes: 0,
          outdoorActivities: [
            {
              description: "Park play time",
              preferredHour: 10,
              durationMinutes: 45,
            },
          ],
        },
        {
          id: "m4",
          name: "Dada Ji (Grandfather)",
          age: 72,
          sensitivities: ["elderly", "cardiac"],
          commuteMode: "work_from_home",
          commuteDistanceKm: 0,
          commuteTimeMinutes: 0,
          outdoorActivities: [
            {
              description: "Morning park walk",
              preferredHour: 6,
              durationMinutes: 45,
            },
          ],
        },
      ],
    },
  },
  {
    key: "demoKolkata",
    profile: {
      city: "Kolkata",
      cookingFuel: "lpg",
      usesIncenseOrCoils: true,
      hasAirPurifier: true,
      members: [
        {
          id: "m1",
          name: "Ananya (Working Parent)",
          age: 36,
          sensitivities: ["none"],
          commuteMode: "car_ice",
          commuteDistanceKm: 18,
          commuteTimeMinutes: 50,
          outdoorActivities: [],
        },
        {
          id: "m2",
          name: "Rishi (School Student)",
          age: 10,
          sensitivities: ["asthma"],
          commuteMode: "bus",
          commuteDistanceKm: 8,
          commuteTimeMinutes: 35,
          outdoorActivities: [
            {
              description: "Afternoon football",
              preferredHour: 16,
              durationMinutes: 60,
            },
          ],
        },
      ],
    },
  },
  {
    key: "demoPatna",
    profile: {
      city: "Patna",
      cookingFuel: "biomass",
      usesIncenseOrCoils: true,
      hasAirPurifier: false,
      members: [
        {
          id: "m1",
          name: "Manoj (Vendor / Field Worker)",
          age: 45,
          sensitivities: ["outdoor_worker"],
          commuteMode: "bicycle",
          commuteDistanceKm: 10,
          commuteTimeMinutes: 40,
          outdoorActivities: [
            {
              description: "Morning roadside stall setup",
              preferredHour: 6,
              durationMinutes: 90,
            },
          ],
        },
        {
          id: "m2",
          name: "Pooja (Expecting Mother)",
          age: 26,
          sensitivities: ["pregnant"],
          commuteMode: "work_from_home",
          commuteDistanceKm: 0,
          commuteTimeMinutes: 0,
          outdoorActivities: [],
        },
      ],
    },
  },
];

function nextMemberId(members: HouseholdMember[]): string {
  const used = new Set(members.map((m) => m.id));
  let n = members.length + 1;
  while (used.has(`mem_${n}`)) n += 1;
  return `mem_${n}`;
}

export const HouseholdForm: React.FC<HouseholdFormProps> = ({
  language,
  onSubmit,
  isLoading,
  initialProfile,
}) => {
  const dict = getDictionary(language);
  const uid = useId();
  const start = initialProfile ?? DEFAULT_PROFILE;

  const [city, setCity] = useState(start.city);
  const [cookingFuel, setCookingFuel] = useState<CookingFuel>(start.cookingFuel);
  const [usesIncenseOrCoils, setUsesIncenseOrCoils] = useState(start.usesIncenseOrCoils);
  const [hasAirPurifier, setHasAirPurifier] = useState(start.hasAirPurifier);
  const [members, setMembers] = useState<HouseholdMember[]>(start.members);
  // Number fields are not controlled, so a new value from a sample household needs a fresh field.
  const [version, setVersion] = useState(0);

  const loadDemo = (demo: (typeof DEMO_HOUSEHOLDS)[number]) => {
    setCity(demo.profile.city);
    setCookingFuel(demo.profile.cookingFuel);
    setUsesIncenseOrCoils(demo.profile.usesIncenseOrCoils);
    setHasAirPurifier(demo.profile.hasAirPurifier);
    setMembers(demo.profile.members);
    setVersion((v) => v + 1);
  };

  const addMember = () => {
    setMembers((prev) =>
      prev.length >= MAX_MEMBERS
        ? prev
        : [
            ...prev,
            {
              id: nextMemberId(prev),
              name: "",
              age: 30,
              sensitivities: ["none"],
              commuteMode: "metro",
              commuteDistanceKm: 10,
              commuteTimeMinutes: 30,
              outdoorActivities: [],
            },
          ]
    );
  };

  const removeMember = (id: string) => {
    setMembers((prev) => (prev.length <= 1 ? prev : prev.filter((m) => m.id !== id)));
  };

  const updateMember = (id: string, updates: Partial<HouseholdMember>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const toggleSensitivity = (memberId: string, sens: HealthSensitivity) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        if (sens === "none") return { ...m, sensitivities: ["none"] };
        const without = m.sensitivities.filter((s) => s !== "none");
        const next = without.includes(sens) ? without.filter((s) => s !== sens) : [...without, sens];
        return { ...m, sensitivities: next.length === 0 ? ["none"] : next };
      })
    );
  };

  const addActivity = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId && m.outdoorActivities.length < MAX_ACTIVITIES
          ? {
              ...m,
              outdoorActivities: [
                ...m.outdoorActivities,
                { description: "", preferredHour: 7, durationMinutes: 30 },
              ],
            }
          : m
      )
    );
  };

  const updateActivity = (memberId: string, index: number, updates: Partial<OutdoorActivity>) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              outdoorActivities: m.outdoorActivities.map((a, i) =>
                i === index ? { ...a, ...updates } : a
              ),
            }
          : m
      )
    );
  };

  const removeActivity = (memberId: string, index: number) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, outdoorActivities: m.outdoorActivities.filter((_, i) => i !== index) }
          : m
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onSubmit({
      city: city.trim(),
      cookingFuel,
      usesIncenseOrCoils,
      hasAirPurifier,
      members: members.map((m) => ({
        ...m,
        name: m.name.trim(),
        // Commuting numbers mean nothing for someone who stays home.
        commuteDistanceKm: m.commuteMode === "work_from_home" ? 0 : m.commuteDistanceKm,
        commuteTimeMinutes: m.commuteMode === "work_from_home" ? 0 : m.commuteTimeMinutes,
        outdoorActivities: m.outdoorActivities.map((a) => ({
          ...a,
          description: a.description.trim(),
        })),
      })),
      language,
    });
  };

  const cityId = `${uid}-city`;
  const fuelId = `${uid}-fuel`;

  return (
    <form onSubmit={handleSubmit} aria-busy={isLoading} className="space-y-8">
      <section
        aria-labelledby={`${uid}-demo`}
        className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-4 sm:p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
            <div>
              <h2 id={`${uid}-demo`} className="text-sm font-semibold text-sky-950">
                {dict.form.loadDemo}
              </h2>
              <p className="text-xs text-sky-900">{dict.form.demoHint}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_HOUSEHOLDS.map((demo) => (
              <button
                key={demo.key}
                type="button"
                onClick={() => loadDemo(demo)}
                className="text-xs bg-white text-sky-900 hover:bg-sky-100/70 border border-sky-300 font-medium px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                {dict.form[demo.key]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby={`${uid}-baseline`}
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6"
      >
        <h2
          id={`${uid}-baseline`}
          className="text-lg font-bold text-slate-900 flex items-center gap-2"
        >
          <MapPin className="w-5 h-5 text-sky-700" aria-hidden="true" />
          {dict.form.baselineHeading}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor={cityId} className={LABEL_CLASS}>
              {dict.form.city}
            </label>
            <input
              id={cityId}
              type="text"
              required
              minLength={2}
              maxLength={100}
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={dict.form.cityPlaceholder}
              aria-describedby={`${cityId}-hint`}
              className={`${INPUT_CLASS} px-4 py-2.5 rounded-xl`}
            />
            <p id={`${cityId}-hint`} className="text-xs text-slate-600 mt-1">
              {dict.form.cityHint}
            </p>
          </div>

          <div>
            <label htmlFor={fuelId} className={LABEL_CLASS}>
              {dict.form.cookingFuel}
            </label>
            <select
              id={fuelId}
              value={cookingFuel}
              onChange={(e) => setCookingFuel(e.target.value as CookingFuel)}
              aria-describedby={`${fuelId}-hint`}
              className={`${INPUT_CLASS} px-4 py-2.5 rounded-xl`}
            >
              <option value="lpg">{dict.form.cookingLPG}</option>
              <option value="electric">{dict.form.cookingElectric}</option>
              <option value="biomass">{dict.form.cookingBiomass}</option>
            </select>
            <p id={`${fuelId}-hint`} className="text-xs text-slate-600 mt-1">
              {dict.form.cookingHint}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
            <input
              type="checkbox"
              checked={usesIncenseOrCoils}
              onChange={(e) => setUsesIncenseOrCoils(e.target.checked)}
              className="mt-1 w-4 h-4 text-sky-700 rounded border-slate-300 focus:ring-sky-600"
            />
            <span>
              <span className="text-sm font-semibold text-slate-900 block">
                {dict.form.incenseCoil}
              </span>
              <span className="text-xs text-slate-600 block">{dict.form.incenseHint}</span>
            </span>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
            <input
              type="checkbox"
              checked={hasAirPurifier}
              onChange={(e) => setHasAirPurifier(e.target.checked)}
              className="mt-1 w-4 h-4 text-sky-700 rounded border-slate-300 focus:ring-sky-600"
            />
            <span>
              <span className="text-sm font-semibold text-slate-900 block">
                {dict.form.purifier}
              </span>
              <span className="text-xs text-slate-600 block">{dict.form.purifierHint}</span>
            </span>
          </label>
        </div>
      </section>

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
            onClick={addMember}
            disabled={members.length >= MAX_MEMBERS}
            title={members.length >= MAX_MEMBERS ? dict.form.maxMembers : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-400 text-sky-800 hover:bg-sky-50 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {dict.form.addMember}
          </button>
        </div>

        <ul className="space-y-4">
          {members.map((member, idx) => {
            const mid = `${uid}-${member.id}`;
            const label = member.name.trim() || formatMessage(dict.form.memberNumber, { n: idx + 1 });
            return (
              <li
                key={member.id}
                className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {formatMessage(dict.form.memberNumber, { n: idx + 1 })}
                  </h3>
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      className="text-slate-600 hover:text-rose-700 p-1 rounded transition"
                      aria-label={formatMessage(dict.form.removeMember, { name: label })}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor={`${mid}-name`} className={LABEL_CLASS}>
                      {dict.form.memberName}
                    </label>
                    <input
                      id={`${mid}-name`}
                      type="text"
                      required
                      maxLength={50}
                      value={member.name}
                      onChange={(e) => updateMember(member.id, { name: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor={`${mid}-age`} className={LABEL_CLASS}>
                      {dict.form.age}
                    </label>
                    <input
                      key={`${version}-age`}
                      id={`${mid}-age`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={120}
                      step={1}
                      required
                      defaultValue={member.age}
                      onChange={(e) => {
                        const n = e.target.valueAsNumber;
                        if (Number.isFinite(n)) updateMember(member.id, { age: Math.round(n) });
                      }}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor={`${mid}-mode`} className={LABEL_CLASS}>
                      {dict.form.commuteMode}
                    </label>
                    <select
                      id={`${mid}-mode`}
                      value={member.commuteMode}
                      onChange={(e) =>
                        updateMember(member.id, { commuteMode: e.target.value as CommuteMode })
                      }
                      className={INPUT_CLASS}
                    >
                      {COMMUTE_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {dict.modes[mode]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {member.commuteMode !== "work_from_home" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                    <div>
                      <label htmlFor={`${mid}-dist`} className={LABEL_CLASS}>
                        {dict.form.commuteDist}
                      </label>
                      <input
                        key={`${version}-dist`}
                        id={`${mid}-dist`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={200}
                        step={0.5}
                        required
                        defaultValue={member.commuteDistanceKm}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber;
                          if (Number.isFinite(n)) updateMember(member.id, { commuteDistanceKm: n });
                        }}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${mid}-time`} className={LABEL_CLASS}>
                        {dict.form.commuteTime}
                      </label>
                      <input
                        key={`${version}-time`}
                        id={`${mid}-time`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={300}
                        step={1}
                        required
                        defaultValue={member.commuteTimeMinutes}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber;
                          if (Number.isFinite(n))
                            updateMember(member.id, { commuteTimeMinutes: Math.round(n) });
                        }}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                )}

                <fieldset>
                  <legend className={`${LABEL_CLASS} mb-1.5`}>{dict.form.sensitivities}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {SENSITIVITIES.map((sens) => {
                      const selected = member.sensitivities.includes(sens);
                      return (
                        <button
                          key={sens}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleSensitivity(member.id, sens)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${
                            selected
                              ? "bg-sky-700 text-white border-sky-700"
                              : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                          }`}
                        >
                          {dict.form.sensitivityOptions[sens]}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="pt-2 border-t border-slate-200/60 space-y-3">
                  <legend className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                    <Sun className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                    {dict.form.outdoorActivity}
                  </legend>
                  <p className="text-xs text-slate-600">{dict.form.outdoorHint}</p>

                  {member.outdoorActivities.length === 0 && (
                    <p className="text-xs text-slate-600 italic">{dict.form.noActivities}</p>
                  )}

                  {member.outdoorActivities.map((activity, ai) => {
                    const aid = `${mid}-act-${ai}`;
                    return (
                      <div
                        key={ai}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end rounded-lg bg-white border border-slate-200 p-3"
                      >
                        <div className="sm:col-span-5">
                          <label htmlFor={`${aid}-desc`} className={LABEL_CLASS}>
                            {dict.form.activityDescription}
                          </label>
                          <input
                            id={`${aid}-desc`}
                            type="text"
                            required
                            maxLength={100}
                            value={activity.description}
                            placeholder={dict.form.activityDescriptionPlaceholder}
                            onChange={(e) =>
                              updateActivity(member.id, ai, { description: e.target.value })
                            }
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label htmlFor={`${aid}-hour`} className={LABEL_CLASS}>
                            {dict.form.activityHour}
                          </label>
                          <select
                            id={`${aid}-hour`}
                            value={activity.preferredHour}
                            onChange={(e) =>
                              updateActivity(member.id, ai, {
                                preferredHour: Number(e.target.value),
                              })
                            }
                            className={INPUT_CLASS}
                          >
                            {HOURS.map((h) => (
                              <option key={h} value={h}>
                                {formatHour(h)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label htmlFor={`${aid}-mins`} className={LABEL_CLASS}>
                            {dict.form.activityDuration}
                          </label>
                          <input
                            key={`${version}-${ai}-mins`}
                            id={`${aid}-mins`}
                            type="number"
                            inputMode="numeric"
                            min={5}
                            max={360}
                            step={5}
                            required
                            defaultValue={activity.durationMinutes}
                            onChange={(e) => {
                              const n = e.target.valueAsNumber;
                              if (Number.isFinite(n))
                                updateActivity(member.id, ai, { durationMinutes: Math.round(n) });
                            }}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div className="sm:col-span-1 flex sm:justify-end">
                          <button
                            type="button"
                            onClick={() => removeActivity(member.id, ai)}
                            className="text-slate-600 hover:text-rose-700 p-2 rounded transition"
                            aria-label={formatMessage(dict.form.removeActivity, {
                              n: ai + 1,
                              name: label,
                            })}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {member.outdoorActivities.length < MAX_ACTIVITIES && (
                    <button
                      type="button"
                      onClick={() => addActivity(member.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 text-slate-800 hover:bg-white text-xs font-medium transition"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      {dict.form.addActivity}
                    </button>
                  )}
                </fieldset>
              </li>
            );
          })}
        </ul>
      </section>

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
    </form>
  );
};
