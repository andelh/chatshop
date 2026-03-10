"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  lastUpdated: string;
  sections: LegalSection[];
  alternateHref: string;
  alternateLabel: string;
};

const toId = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function LegalPage({
  eyebrow,
  title,
  summary,
  lastUpdated,
  sections,
  alternateHref,
  alternateLabel,
}: LegalPageProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Determine which section is currently active based on scroll position
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0% -60% 0%" }
    );

    sections.forEach((s) => {
      const el = document.getElementById(toId(s.title));
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <main className="min-h-[100dvh] bg-[#fafafa] sm:bg-white text-slate-900 selection:bg-sky-200 selection:text-slate-900">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:flex-row px-6 pt-8 pb-32 sm:pt-12 sm:pb-24 lg:px-16 lg:py-24 gap-12 lg:gap-24">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:block w-[280px] xl:w-[320px] shrink-0">
          <div className="sticky top-12 lg:top-24 flex flex-col gap-10">
            {/* Back Link */}
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium tracking-tight text-slate-500 transition-colors hover:text-slate-900"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                  />
                </svg>
                Back to Clerkit
              </Link>
            </div>

            {/* TOC Nav */}
            <nav className="hidden lg:flex flex-col gap-3 relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200" />
              {sections.map((section) => {
                const id = toId(section.title);
                const isActive = activeId === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={`relative pl-5 text-sm font-medium transition-colors py-1 ${
                      isActive
                        ? "text-slate-900"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-slate-900" />
                    )}
                    {section.title}
                  </a>
                );
              })}
            </nav>

            {/* Nav Footer */}
            <div className="flex flex-col gap-3 pt-6 border-t border-slate-200/60 lg:mt-6 text-sm font-medium">
              <Link
                href="/privacy"
                className={`transition-colors py-1 ${
                  eyebrow === "Privacy Policy"
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className={`transition-colors py-1 ${
                  eyebrow === "Terms of Service"
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 max-w-3xl">
          <header className="mb-12 lg:mb-24 pt-4 lg:pt-0">
            <div className="lg:hidden mb-12">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[13px] font-medium tracking-tight text-slate-500 transition-colors hover:text-slate-900"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                  />
                </svg>
                Back to Clerkit
              </Link>
            </div>
            <p className="mb-4 lg:mb-6 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-sky-600">
              {eyebrow}
            </p>
            <h1 className="mb-8 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-5xl lg:leading-[1.1] text-balance">
              {title}
            </h1>
            <p className="text-lg leading-relaxed text-slate-600">
              {summary}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-slate-100/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-600 border border-slate-200/50">
                Last updated {lastUpdated}
              </span>
            </div>
          </header>

          <div className="space-y-16 lg:space-y-24">
            {sections.map((section) => {
              const id = toId(section.title);
              return (
                <section
                  key={section.title}
                  id={id}
                  className="scroll-mt-24 lg:scroll-mt-32 border-t border-slate-100 pt-8 lg:pt-12 first:border-t-0 first:pt-0"
                >
                  <h2 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
                    {section.title}
                  </h2>
                  <div className="space-y-6 text-[15px] leading-relaxed text-slate-600 sm:text-[17px]">
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                  {section.bullets && (
                    <ul className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-600 sm:text-[17px]">
                      {section.bullets.map((bullet, index) => (
                        <li key={index} className="flex gap-4">
                          <span className="mt-2.5 h-[6px] w-[6px] shrink-0 rounded-full bg-slate-300" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <footer className="mt-24 lg:hidden flex flex-col sm:flex-row items-start justify-between gap-8 rounded-[2rem] bg-slate-50 p-8 sm:p-10 border border-slate-200/60 shadow-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                Clerkit by Techxture Media Ltd
              </p>
              <p className="text-sm text-slate-600 max-w-sm leading-relaxed">
                These conditions describe the current operating terms for Clerkit. They should be reviewed periodically.
              </p>
            </div>
            <Link
              href={alternateHref}
              className="inline-flex h-[46px] sm:h-12 w-full sm:w-auto items-center justify-center rounded-full bg-white px-6 text-[12px] sm:text-[13px] font-bold uppercase tracking-wide text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 transition-all hover:bg-slate-50 hover:ring-slate-300 sm:mt-2"
            >
              {alternateLabel}
            </Link>
          </footer>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/90 px-4 py-3 pb-safe backdrop-blur-md lg:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
        <div className="mx-auto flex max-w-sm items-center justify-around">
          <Link
            href="/privacy"
            className={`flex flex-col items-center gap-1 transition-colors ${
              eyebrow === "Privacy Policy"
                ? "text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Privacy
            </span>
          </Link>
          <div className="h-8 w-px bg-slate-200" />
          <Link
            href="/terms"
            className={`flex flex-col items-center gap-1 transition-colors ${
              eyebrow === "Terms of Service"
                ? "text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Terms
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
