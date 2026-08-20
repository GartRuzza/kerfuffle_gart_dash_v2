"use client";

import { useEffect, useState } from "react";
import { DATA_DICTIONARY } from "@/lib/dataDictionary";

/**
 * Bottom-of-page data dictionary: a button that opens an overlay defining each
 * column — a one-line definition plus an expandable bulleted deep-dive
 * (mechanics + source). Most content is placeholder pending data discovery.
 */
export default function DataDictionary() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-line-strong bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-subtle"
      >
        📖 Data Dictionary
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Data dictionary"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-lg font-bold text-ink">Data Dictionary</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded px-2 py-0.5 text-ink-muted hover:bg-surface-subtle hover:text-ink"
              >
                ✕
              </button>
            </div>

            <p className="border-b border-line-subtle px-4 py-2 text-xs text-ink-subtle">
              What each column means. Most entries are{" "}
              <span className="font-semibold">placeholders</span> until data discovery
              (roadmap #2–3) and the valuation engine (#4–6) are done.
            </p>

            <ul className="divide-y divide-line-subtle overflow-y-auto p-2">
              {DATA_DICTIONARY.map((f) => {
                const isOpen = expanded === f.id;
                return (
                  <li key={f.id} className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{f.term}</span>
                      {f.placeholder && (
                        <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle ring-1 ring-line-strong">
                          Placeholder
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">{f.definition}</p>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : f.id)}
                      className="mt-1 text-xs font-medium text-accent hover:underline"
                    >
                      {isOpen ? "▾ Hide details" : "▸ Details"}
                    </button>
                    {isOpen && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-subtle">
                        {f.deepDive.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
