import React from "react";
import { Dictionary } from "@/i18n";

/** Page footer: a health disclaimer, how the numbers are worked out, and the data credit. */
export const Footer: React.FC<{ dict: Dictionary }> = ({ dict }) => (
  <footer className="mt-16 border-t border-slate-200 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-3 text-sm text-slate-700">
      <p>{dict.footer.disclaimer}</p>
      <p className="text-slate-600">{dict.footer.method}</p>
      <p className="text-slate-600">
        {dict.footer.dataCredit}{" "}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-800 underline underline-offset-2 hover:text-sky-950"
        >
          Open-Meteo.com
        </a>
      </p>
    </div>
  </footer>
);
