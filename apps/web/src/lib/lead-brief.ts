export const BRIEF_PREFIX = "__TEXTA_PROJECT_BRIEF_V1__";

export type LeadBrief = Record<string, string>;

export interface ParsedLeadNotes {
  brief: LeadBrief;
  plainNotes: string;
}

export interface LeadToProjectPrefill {
  name: string;
  description: string;
  company_name: string;
  company_logo_url: string;
  project_code: string;
  scope_statement: string;
  iso_context: string;
  iso_risk_register: string;
  iso_objectives: string;
  iso_kpis: string;
  iso_acceptance_criteria: string;
  iso_document_control: boolean;
  iso_change_control: boolean;
}

const BRIEF_KEYS = [
  "identity_project_name",
  "identity_baseline",
  "identity_description_short",
  "identity_description_long",
  "identity_sector",
  "identity_launch_date",
  "identity_budget",
  "objectives_main",
  "objectives_secondary",
  "objectives_problem",
  "objectives_kpis",
  "objectives_duration",
  "target_primary_user",
  "target_secondary_user",
  "target_persona",
  "target_needs",
  "target_frustrations",
  "target_languages",
  "features_mvp",
  "features_v2",
  "features_v3",
  "features_pages",
  "features_roles",
  "features_flows",
  "design_tone",
  "design_direction",
  "design_colors",
  "design_typography",
  "design_theme_mode",
  "design_references",
  "design_logo_assets",
  "design_responsive",
  "content_existing",
  "content_to_create",
  "content_database",
  "content_sources",
  "content_privacy",
  "tech_platform_type",
  "tech_stack",
  "tech_hosting",
  "tech_domain",
  "tech_security",
  "tech_integrations",
  "tech_seo",
  "delivery_team",
  "delivery_method",
  "delivery_phases",
  "delivery_tools",
  "delivery_tests",
  "delivery_maintenance",
  "business_model",
  "business_pricing",
  "business_payment",
  "business_legal",
] as const;

export function emptyLeadBrief(): LeadBrief {
  const next: LeadBrief = {};
  BRIEF_KEYS.forEach((key) => {
    next[key] = "";
  });
  return next;
}

export function parseLeadNotes(notes?: string | null): ParsedLeadNotes {
  const fallback = { brief: emptyLeadBrief(), plainNotes: notes || "" };
  if (!notes || !notes.startsWith(BRIEF_PREFIX)) return fallback;
  const payload = notes.slice(BRIEF_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(payload) as { brief?: LeadBrief; plainNotes?: string };
    return {
      brief: { ...emptyLeadBrief(), ...(parsed.brief || {}) },
      plainNotes: parsed.plainNotes || "",
    };
  } catch {
    return fallback;
  }
}

export function serializeLeadNotes(brief: LeadBrief, plainNotes: string): string {
  return `${BRIEF_PREFIX}\n${JSON.stringify({ brief, plainNotes }, null, 2)}`;
}

function asLine(label: string, value?: string): string {
  return value?.trim() ? `- ${label}: ${value.trim()}` : "";
}

export function buildProjectPrefillFromLead(
  leadTitle: string,
  leadSource: string | undefined,
  notes: string | undefined,
): LeadToProjectPrefill {
  const parsed = parseLeadNotes(notes);
  const brief = parsed.brief;

  const descriptionLines = [
    asLine("Baseline", brief.identity_baseline),
    asLine("Description", brief.identity_description_short || brief.identity_description_long),
    asLine("Secteur", brief.identity_sector),
    asLine("Source lead", leadSource),
    asLine("Objectif principal", brief.objectives_main),
    asLine("Persona", brief.target_persona),
    asLine("Tech stack", brief.tech_stack),
  ].filter(Boolean);

  const scopeParts = [brief.features_mvp, brief.features_pages, brief.features_roles].filter(Boolean).join("\n");
  const contextParts = [brief.objectives_problem, brief.target_needs, brief.content_privacy]
    .filter(Boolean)
    .join("\n");
  const riskParts = [brief.target_frustrations, brief.tech_security, brief.content_sources]
    .filter(Boolean)
    .join("\n");
  const objectiveParts = [brief.objectives_main, brief.objectives_secondary, brief.business_model]
    .filter(Boolean)
    .join("\n");
  const acceptanceParts = [brief.delivery_tests, brief.delivery_phases, brief.business_legal]
    .filter(Boolean)
    .join("\n");

  return {
    name: brief.identity_project_name || leadTitle,
    description: descriptionLines.join("\n"),
    company_name: "",
    company_logo_url: "",
    project_code: "",
    scope_statement: scopeParts || "MVP initial à définir.",
    iso_context: contextParts || "Contexte projet à compléter.",
    iso_risk_register: riskParts || "Registre des risques à compléter.",
    iso_objectives: objectiveParts || "Objectifs qualité/sécurité à compléter.",
    iso_kpis: brief.objectives_kpis || "KPIs à compléter.",
    iso_acceptance_criteria: acceptanceParts || "Critères d'acceptation à compléter.",
    iso_document_control: true,
    iso_change_control: true,
  };
}
