const MENTOR_DOMAINS = {
  emotional: [
    { id: "e01", name: "Venting & Immediate Support", section: "Immediate Support" },
    { id: "e02", name: "Stress & Overthinking", section: "Immediate Support" },
    { id: "e03", name: "Confidence & Self-Worth", section: "Self & Identity" },
    { id: "e04", name: "Anxiety & Emotional Burnout", section: "Self & Identity" },
    { id: "e05", name: "Emotional Healing & Inner Child", section: "Self & Identity" },
    { id: "e06", name: "Anger & Emotional Control", section: "Self & Identity" },
    { id: "e07", name: "Grief & Loss", section: "Life Transitions" },
    { id: "e08", name: "Life Transitions & Change", section: "Life Transitions" },
    { id: "e09", name: "Loneliness & Social Anxiety", section: "Life Transitions" },
    { id: "e10", name: "Relationships & Communication", section: "Relationships" },
    { id: "e11", name: "Family Dynamics", section: "Relationships" },
    { id: "e12", name: "Romantic Relationships & Heartbreak", section: "Relationships" },
    { id: "e13", name: "Workplace Stress & Conflict", section: "Work & Career" },
    { id: "e14", name: "Burnout & Recovery", section: "Work & Career" },
    { id: "e15", name: "Career Anxiety & Imposter Syndrome", section: "Work & Career" },
    { id: "e16", name: "Student & Academic Pressure", section: "Work & Career" },
    { id: "e17", name: "Purpose & Meaning", section: "Deeper Work" },
    { id: "e18", name: "Identity & Self-Discovery", section: "Deeper Work" },
    { id: "e19", name: "Trauma-Informed Support", section: "Deeper Work" },
    { id: "e20", name: "Emotional Regulation & Mindfulness", section: "Deeper Work" },
    { id: "e21", name: "Life Coaching", section: "Coaching" },
    { id: "e22", name: "Relationship Coaching", section: "Coaching" },
  ],
  professional: [
    { id: "p01", name: "Career Transition Coach", section: "Career & Leadership" },
    { id: "p02", name: "HR & Workplace Mentor", section: "Career & Leadership" },
    { id: "p03", name: "CA / Financial Clarity Mentor", section: "Career & Leadership" },
    { id: "p04", name: "Legal Clarity Mentor", section: "Career & Leadership" },
    { id: "p05", name: "Executive & Leadership Coach", section: "Career & Leadership" },
    { id: "p06", name: "Startup & Entrepreneurship Mentor", section: "Career & Leadership" },
    { id: "p07", name: "Sales & Business Development", section: "Career & Leadership" },
    { id: "p08", name: "MBA & Higher Education Guidance", section: "Education & Growth" },
    { id: "p09", name: "Study Abroad & Academic Mentor", section: "Education & Growth" },
    { id: "p10", name: "Personal Finance & Wealth Planning", section: "Education & Growth" },
    { id: "p11", name: "Communication & Public Speaking", section: "Education & Growth" },
    { id: "hr-startup", name: "HR Mentor — Startup", section: "Human Resources" },
    { id: "hr-mnc", name: "HR Mentor — MNC", section: "Human Resources" },
    { id: "hr-switch", name: "HR Mentor — Career Switcher", section: "Human Resources" },
    { id: "p12", name: "Product Management", section: "Information Technology" },
    { id: "p13", name: "Data Analytics & Business Intelligence", section: "Information Technology" },
    { id: "p14", name: "UX & Product Design", section: "Information Technology" },
    { id: "p15", name: "Business Analyst", section: "Information Technology" },
    { id: "p16", name: "Cloud & DevOps", section: "Information Technology" },
    { id: "p17", name: "Cybersecurity Career Path", section: "Information Technology" },
  ],
};

function getDomainsForType(mentorType) {
  return MENTOR_DOMAINS[mentorType] || [];
}

function resolveMentorDomain(mentorType, domainId) {
  if (!mentorType || !domainId) return null;
  const normalizedType = String(mentorType).toLowerCase();
  const domain = getDomainsForType(normalizedType).find((d) => d.id === domainId);
  return domain || null;
}

function isValidMentorDomain(mentorType, domainId) {
  return Boolean(resolveMentorDomain(mentorType, domainId));
}

function normalizeDomainIds(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function resolveMentorDomains(mentorType, domainIds) {
  const ids = normalizeDomainIds(domainIds);
  return ids
    .map((id) => resolveMentorDomain(mentorType, id))
    .filter(Boolean);
}

module.exports = {
  MENTOR_DOMAINS,
  getDomainsForType,
  resolveMentorDomain,
  isValidMentorDomain,
  normalizeDomainIds,
  resolveMentorDomains,
};
