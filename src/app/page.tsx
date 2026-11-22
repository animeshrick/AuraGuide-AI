"use client";

import React, { useEffect, useRef } from "react";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HouseholdForm } from "@/components/HouseholdForm";
import { Navbar } from "@/components/Navbar";
import { PlanResults } from "@/components/PlanResults";
import { StatusBanner } from "@/components/StatusBanner";
import { usePlanSession } from "@/hooks/usePlanSession";
import { getDictionary } from "@/i18n";

/** The single page: the household form, or the plan once one has been made. */
export default function HomePage() {
  const session = usePlanSession();
  const { language, profile, plan, error } = session;
  const dict = getDictionary(language);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Move keyboard and screen reader focus to the new plan's heading.
  useEffect(() => {
    if (session.planArrived === 0) return;
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [session.planArrived]);

  const handleReset = () => {
    session.reset();
    mainRef.current?.focus();
  };

  return (
    <>
      <Navbar
        currentLanguage={language}
        onLanguageChange={session.changeLanguage}
        onReset={handleReset}
        hasPlan={plan !== null}
      />

      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
          {error && (
            <StatusBanner
              tone="error"
              title={dict.errors.title}
              onDismiss={session.clearError}
              dismissLabel={dict.errors.dismiss}
            >
              {dict.errors[error]}
            </StatusBanner>
          )}

          {plan && profile ? (
            <PlanResults
              plan={plan}
              profile={profile}
              language={language}
              dict={dict}
              isUpdating={session.isUpdatingLanguage}
              headingRef={headingRef}
            />
          ) : (
            <>
              <Hero dict={dict} />
              <HouseholdForm
                key={session.formKey}
                language={language}
                onSubmit={session.submit}
                isLoading={session.isLoading}
                initialProfile={profile}
              />
            </>
          )}
        </div>
      </main>

      <Footer dict={dict} />

      <p role="status" className="sr-only">
        {session.isLoading ? dict.a11y.loading : ""}
      </p>
    </>
  );
}
