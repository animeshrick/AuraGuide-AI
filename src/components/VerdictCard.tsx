import React from "react";
import type { LucideIcon } from "lucide-react";

/** How one verdict looks: an icon plus box and icon colours. Text always goes with the colour. */
export interface VerdictLook {
  Icon: LucideIcon;
  box: string;
  icon: string;
}

/** A large verdict with its icon in a coloured circle, used for what-if and going-out answers. */
export const VerdictCard: React.FC<{ look: VerdictLook; children: React.ReactNode }> = ({
  look,
  children,
}) => (
  <div className={`rounded-2xl border-2 p-4 sm:p-5 flex items-start gap-4 ${look.box}`}>
    <span
      className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${look.icon}`}
    >
      <look.Icon className="w-6 h-6" aria-hidden="true" />
    </span>
    <div className="space-y-2">{children}</div>
  </div>
);
