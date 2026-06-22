/**
 * formatSummary.ts
 *
 * Parses the markdown analysis string from the perception_analysis event
 * into structured PerceptionObservation objects.
 *
 * The analysis field is markdown with one section per perception_analysis_query.
 * Each section starts with a bold header (e.g., **Eye Contact:**). The header
 * text is used directly as the observation's label — there is no separate
 * mapping table; the persona owns the queries and the markdown headers reflect
 * whatever the persona is configured with.
 *
 * Consumed by: hooks/usePerceptionAnalysis.ts → ResultsScreen
 * Tavus docs: https://docs.tavus.io/sections/event-schemas/conversation-perception-analysis
 */

import type { PerceptionObservation } from "@/types/interview";

/** Slugify a header into a stable id (e.g. "Eye Contact" → "eye_contact"). */
function slugify(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Parses the raw markdown analysis string into structured observations.
 * Sections are split on bold markdown headers like **Header:**.
 */
export function parsePerceptionAnalysis(
  analysisMarkdown: string
): PerceptionObservation[] {
  // Split on markdown bold headers: **Header:**
  const sections = analysisMarkdown.split(/\*\*([^*]+)\*\*/);
  const observations: PerceptionObservation[] = [];

  // sections alternates: [preText, header1, body1, header2, body2, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const header = sections[i].replace(/:$/, "").trim();
    const body = (sections[i + 1] ?? "").trim();
    if (!header) continue;

    observations.push({
      id: slugify(header) || `section_${i}`,
      label: header,
      analysis: body,
    });
  }

  return observations;
}
