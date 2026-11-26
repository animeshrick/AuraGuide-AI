import React from "react";
import { MapPin } from "lucide-react";
import { LIMITS } from "@/domain/limits";
import type { CookingFuel } from "@/domain/types";
import type { Dictionary } from "@/i18n";
import { CheckboxCard } from "./CheckboxCard";
import { TextField } from "./TextField";
import { FORM_HEADING, FORM_SECTION, INPUT_CLASS, LABEL_CLASS } from "./fieldStyles";

interface HomeSettingsProps {
  uid: string;
  dict: Dictionary;
  city: string;
  cookingFuel: CookingFuel;
  usesIncenseOrCoils: boolean;
  hasAirPurifier: boolean;
  onCityChange: (city: string) => void;
  onCookingFuelChange: (fuel: CookingFuel) => void;
  onIncenseChange: (value: boolean) => void;
  onPurifierChange: (value: boolean) => void;
}

/** The city or region, used to look up the air quality. */
const CityField: React.FC<{
  id: string;
  value: string;
  dict: Dictionary;
  onChange: (city: string) => void;
}> = ({ id, value, dict, onChange }) => (
  <TextField
    id={id}
    label={dict.form.city}
    value={value}
    minLength={LIMITS.cityMinLength}
    maxLength={LIMITS.cityMaxLength}
    autoComplete="address-level2"
    placeholder={dict.form.cityPlaceholder}
    hint={dict.form.cityHint}
    inputClassName="px-4 py-2.5 rounded-xl"
    onChange={onChange}
  />
);

/** The household's main cooking fuel. */
const FuelField: React.FC<{
  id: string;
  value: CookingFuel;
  dict: Dictionary;
  onChange: (fuel: CookingFuel) => void;
}> = ({ id: fuelId, value: cookingFuel, dict, onChange }) => (
  <div>
    <label htmlFor={fuelId} className={LABEL_CLASS}>
      {dict.form.cookingFuel}
    </label>
    <select
      id={fuelId}
      value={cookingFuel}
      onChange={(e) => onChange(e.target.value as CookingFuel)}
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
);

/** The household-wide settings: city, cooking fuel, incense and purifier. */
export const HomeSettings: React.FC<HomeSettingsProps> = ({
  uid,
  dict,
  city,
  cookingFuel,
  usesIncenseOrCoils,
  hasAirPurifier,
  onCityChange,
  onCookingFuelChange,
  onIncenseChange,
  onPurifierChange,
}) => {
  const headingId = `${uid}-baseline`;
  const cityId = `${uid}-city`;
  const fuelId = `${uid}-fuel`;

  return (
    <section aria-labelledby={headingId} className={FORM_SECTION}>
      <h2 id={headingId} className={FORM_HEADING}>
        <MapPin className="w-5 h-5 text-sky-700" aria-hidden="true" />
        {dict.form.baselineHeading}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CityField id={cityId} value={city} dict={dict} onChange={onCityChange} />
        <FuelField id={fuelId} value={cookingFuel} dict={dict} onChange={onCookingFuelChange} />
      </div>

      <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CheckboxCard
          title={dict.form.incenseCoil}
          hint={dict.form.incenseHint}
          checked={usesIncenseOrCoils}
          onChange={onIncenseChange}
        />
        <CheckboxCard
          title={dict.form.purifier}
          hint={dict.form.purifierHint}
          checked={hasAirPurifier}
          onChange={onPurifierChange}
        />
      </div>
    </section>
  );
};
