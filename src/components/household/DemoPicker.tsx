import React from "react";
import { Sparkles } from "lucide-react";
import type { DemoHousehold } from "@/domain/demo-households";
import { DEMO_HOUSEHOLDS } from "@/domain/demo-households";
import type { Dictionary } from "@/i18n";

interface DemoPickerProps {
  headingId: string;
  dict: Dictionary;
  onPick: (demo: DemoHousehold) => void;
}

/** Buttons that fill the form with a sample household. */
export const DemoPicker: React.FC<DemoPickerProps> = ({ headingId, dict, onPick }) => (
  <section
    aria-labelledby={headingId}
    className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-4 sm:p-5"
  >
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Sparkles className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
        <div>
          <h2 id={headingId} className="text-sm font-semibold text-sky-950">
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
            onClick={() => onPick(demo)}
            className="text-xs bg-white text-sky-900 hover:bg-sky-100/70 border border-sky-300 font-medium px-3 py-1.5 rounded-lg shadow-sm transition"
          >
            {dict.form[demo.key]}
          </button>
        ))}
      </div>
    </div>
  </section>
);
