import React, { useState } from "react";
import { Send } from "lucide-react";
import { LIMITS } from "@/domain/limits";
import type { Dictionary } from "@/i18n";

interface QuestionFormProps {
  id: string;
  loading: boolean;
  dict: Dictionary;
  onAsk: (question: string) => void;
}

/** A free-text what-if question, for changes the buttons do not cover. */
export const QuestionForm: React.FC<QuestionFormProps> = ({ id, loading, dict, onAsk }) => {
  const [question, setQuestion] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAsk(question);
      }}
      className="space-y-3 pt-4 border-t border-slate-200"
    >
      <label htmlFor={id} className="block text-base font-semibold text-slate-900">
        {dict.whatIf.question}
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id={id}
          type="text"
          required
          minLength={LIMITS.questionMinLength}
          maxLength={LIMITS.questionMaxLength}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={dict.whatIf.placeholder}
          className="flex-1 min-h-[48px] px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-base"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-base font-semibold disabled:opacity-60"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          {loading ? dict.whatIf.asking : dict.whatIf.ask}
        </button>
      </div>
    </form>
  );
};
