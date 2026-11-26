import React from "react";
import { getAQIBadgeClass, getAQICategory } from "@/domain/aqi";
import type { AQICategory } from "@/domain/types";
import type { Dictionary } from "@/i18n";

interface AQIBadgeProps {
  aqi: number;
  category: AQICategory;
  /** Category name in the page language. Falls back to the English name. */
  categoryLabel?: string;
  /** The word for "AQI" in the page language. Read out before the number. */
  aqiLabel?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-xs font-medium",
  md: "px-3 py-1 text-sm font-semibold",
  lg: "px-4 py-1.5 text-base font-bold",
} as const;

/** The AQI is always written out as a number and a category name, so colour is never the only signal. */
export const AQIBadge: React.FC<AQIBadgeProps> = ({
  aqi,
  category,
  categoryLabel,
  aqiLabel = "AQI",
  size = "md",
  showLabel = true,
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-sm ${SIZE_CLASSES[size]} ${getAQIBadgeClass(category)}`}
    >
      <span className="w-2 h-2 rounded-full bg-current opacity-80" aria-hidden="true" />
      <span className="sr-only">{aqiLabel} </span>
      <span className="font-mono">{aqi}</span>
      {showLabel && (
        <span className="border-l border-current/30 pl-1.5 ml-0.5">
          {categoryLabel ?? category}
        </span>
      )}
    </span>
  );
};

/**
 * An AQI badge labelled in the page language. The category is worked out from
 * the AQI when it is not given.
 */
export const LocalizedAQIBadge: React.FC<{
  aqi: number;
  category?: AQICategory;
  dict: Dictionary;
  size?: AQIBadgeProps["size"];
}> = ({ aqi, category, dict, size }) => {
  const resolved = category ?? getAQICategory(aqi);
  return (
    <AQIBadge
      aqi={aqi}
      category={resolved}
      categoryLabel={dict.categories[resolved]}
      aqiLabel={dict.metrics.aqiLabel}
      size={size}
    />
  );
};
