import React from "react";
import type { Dictionary } from "@/i18n";
import { CARD } from "./styles";

/** The page title, a one-line explanation and the three steps of the app. */
export const Hero: React.FC<{ dict: Dictionary }> = ({ dict }) => (
  <div className="space-y-6">
    <div className="space-y-3 max-w-3xl">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
        {dict.hero.title}
      </h1>
      <p className="text-base sm:text-lg text-slate-800 leading-relaxed">{dict.hero.body}</p>
    </div>

    <section aria-label={dict.hero.stepsLabel} className={CARD}>
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-900">
        {[dict.hero.step1, dict.hero.step2, dict.hero.step3].map((step, i) => (
          <li key={step} className="flex items-start gap-3">
            <span
              className="shrink-0 w-7 h-7 rounded-full bg-sky-700 text-white text-sm font-bold flex items-center justify-center"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="pt-0.5 font-medium">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  </div>
);
