import React from "react";
import { AlertTriangle, Info, X, AlertCircle } from "lucide-react";
import type { Dictionary } from "@/i18n";
import type { ClientErrorCode } from "@/lib/api-client";

type Tone = "info" | "warning" | "error";

interface StatusBannerProps {
  tone: Tone;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}

const STYLES: Record<Tone, { box: string; icon: React.ReactNode }> = {
  info: {
    box: "bg-sky-50 border-sky-200 text-sky-950",
    icon: <Info className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />,
  },
  warning: {
    box: "bg-amber-50 border-amber-300 text-amber-950",
    icon: <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />,
  },
  error: {
    box: "bg-rose-50 border-rose-300 text-rose-950",
    icon: <AlertCircle className="w-5 h-5 text-rose-700 shrink-0" aria-hidden="true" />,
  },
};

/** Errors interrupt screen readers (alert). Other notices are announced politely (status). */
export const StatusBanner: React.FC<StatusBannerProps> = ({
  tone,
  title,
  children,
  onDismiss,
  dismissLabel = "Dismiss",
}) => (
  <div
    role={tone === "error" ? "alert" : "status"}
    className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${STYLES[tone].box}`}
  >
    {STYLES[tone].icon}
    <div className="flex-1 space-y-0.5">
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 hover:bg-black/5"
        aria-label={dismissLabel}
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

/** The error banner for a failed request, in the chosen language. Renders nothing when there is no error. */
export const RequestErrorBanner: React.FC<{
  error: ClientErrorCode | null;
  dict: Dictionary;
  onDismiss: () => void;
}> = ({ error, dict, onDismiss }) =>
  error ? (
    <StatusBanner
      tone="error"
      title={dict.errors.title}
      onDismiss={onDismiss}
      dismissLabel={dict.errors.dismiss}
    >
      {dict.errors[error]}
    </StatusBanner>
  ) : null;
