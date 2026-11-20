"use client";

import React from "react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-slate-700">
          The page could not be shown. Your household details were not sent anywhere.
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-semibold"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
