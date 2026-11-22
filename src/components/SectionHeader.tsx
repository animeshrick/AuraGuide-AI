import React from "react";
import type { LucideIcon } from "lucide-react";
import { MUTED, SECTION_HEADING } from "./styles";

interface SectionHeaderProps {
  /** Id for the heading, so the section can be labelled by it. */
  id: string;
  icon: LucideIcon;
  /** Tailwind text colour for the icon. */
  iconColor?: string;
  title: string;
  intro?: string;
  /** Larger intro text, used on the panels written for elderly readers. */
  largeIntro?: boolean;
}

/** A results section's heading, icon and optional one-line introduction. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  id,
  icon: Icon,
  iconColor = "text-sky-700",
  title,
  intro,
  largeIntro = false,
}) => {
  const heading = (
    <h2 id={id} className={SECTION_HEADING}>
      <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
      {title}
    </h2>
  );
  if (!intro) return heading;
  return (
    <div>
      {heading}
      <p className={largeIntro ? "text-base text-slate-800 mt-1 leading-relaxed" : `${MUTED} mt-1`}>
        {intro}
      </p>
    </div>
  );
};
