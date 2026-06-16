const TERMS_VERSION = "1.0";
const TERMS_EFFECTIVE_DATE = "12 May 2026";

const termsChapters = [
  { num: "1", title: "Definitions and Platform Description" },
  { num: "2", title: "Acceptance of Terms and Eligibility" },
  { num: "3", title: "Nature of Services - Critical Disclaimers" },
  { num: "4", title: "User Obligations and Prohibited Conduct" },
  { num: "5", title: "Platform Conduct and Boundaries" },
  { num: "6", title: "Self-Harm and Crisis Safety Protocol" },
  { num: "7", title: "Professional Services - Category-Specific Liability Clarifications" },
  { num: "8", title: "Professional Misrepresentation and Credential Verification" },
  { num: "9", title: "Data Privacy and Confidentiality" },
  { num: "10", title: "Anti-Harassment and Safe Conduct Policy" },
  { num: "11", title: "Platform Liability and Indemnification" },
  { num: "12", title: "Payment Framework" },
  { num: "13", title: "Intellectual Property" },
  { num: "14", title: "Relationship of Parties" },
  { num: "15", title: "Platform Infrastructure and Availability" },
  { num: "16", title: "Fraud, Payment Misuse and Compliance" },
  { num: "17", title: "Dispute Resolution and Governing Law" },
  { num: "18", title: "General Provisions" },
  { num: "19", title: "Informed User Consent and Risk Acknowledgement" },
];

const privacyPolicySections = [
  {
    num: "1",
    title: "Data Collected",
    clause: "Clause 9.1",
    paragraphs: [
      "Mejoric shall collect and process only such personal data as is reasonably necessary for registration, booking of sessions, payment processing, platform safety, grievance redressal, legal compliance, fraud prevention, dispute resolution and provision of Platform Services.",
      "Such data may include identity and contact details, account and usage data, payment transaction records, booking details, and information or documents voluntarily shared by the User for availing a session or Professional Service.",
      "Mental-health, medical, legal, financial, tax or other sensitive/confidential information shall be collected, processed or retained only where voluntarily provided by the User, necessary for the requested service, required for safety or grievance handling, required by law, or processed with valid consent under applicable law.",
      "Mejoric shall not record, store or review session recordings, transcripts, detailed notes or session content as a default practice. Such records may be created or retained only with prior notice and consent, or where necessary for safety, dispute resolution, fraud prevention, legal compliance, professional obligations or lawful authority.",
      "All personal data and sensitive information shall be handled in accordance with applicable data protection laws, including the Digital Personal Data Protection Act, 2023, the Digital Personal Data Protection Rules, 2025, the Information Technology Act, 2000 and applicable rules.",
    ],
  },
  {
    num: "2",
    title: "Data Protection Standard",
    clause: "Clause 9.2",
    paragraphs: [
      "Mejoric shall implement reasonable technical and organisational measures to safeguard personal data, including encryption, access controls, need-to-know access, security monitoring, retention controls and data breach response processes appropriate to the nature and scale of the platform and applicable law.",
    ],
  },
  {
    num: "3",
    title: "Third-Party Infrastructure and Cross-Border Processing",
    clause: "Clause 9.3",
    paragraphs: [
      "Mejoric may engage third-party cloud providers, communication providers, analytics providers, payment processors, storage providers, infrastructure providers, AI service providers, cybersecurity vendors and other technology processors for operation of the platform.",
      "Such service providers may process, store or transmit personal data within or outside India, subject to applicable law, contractual safeguards, security measures and reasonable data protection practices implemented by Mejoric.",
      "Users acknowledge and consent to such processing, storage, transfer and use of data for operational, security, compliance, platform functionality, analytics, safety, fraud prevention and service-improvement purposes.",
    ],
  },
  {
    num: "4",
    title: "Confidentiality Obligations",
    clause: "Clause 9.4",
    paragraphs: [
      "All session content is confidential. Mejoric, Mates, Mentors, and Professionals are bound by confidentiality obligations that prohibit disclosure of session content to any third party except: (a) where the User has given express written consent; (b) where required by a court order or law enforcement authority under due process; or (c) where disclosure is necessary to prevent imminent risk of serious harm to the User or a third party.",
    ],
  },
  {
    num: "5",
    title: "Data Breach Response",
    clause: "Clause 9.5",
    paragraphs: [
      "In the event of a data breach affecting session content or personal data:",
      "(a) Mejoric shall notify affected users, where required, as soon as reasonably practicable after becoming aware of a confirmed breach, and in accordance with applicable law;",
      "(b) such notification shall, to the extent reasonably available, include the nature of the breach, categories of data affected, and the measures being taken to address and mitigate the breach;",
      "(c) Mejoric shall take appropriate technical and organizational measures to investigate, contain, and remediate the breach, which may include engagement of external cybersecurity experts where necessary; and",
      "(d) Mejoric shall notify the Data Protection Board of India or any other competent authority, where required, in accordance with the Digital Personal Data Protection Act, 2023.",
    ],
  },
  {
    num: "6",
    title: "Data Retention and Deletion",
    clause: "Clause 9.6",
    paragraphs: [
      "Mejoric shall retain personal data only for as long as reasonably necessary for providing Platform Services, account management, payment processing, safety, grievance redressal, fraud prevention, dispute resolution, legal compliance and enforcement of rights.",
      "Account and usage data shall be retained for the duration of the User's active account and for a period of up to 24 months thereafter, unless earlier deletion is requested or longer retention is required under applicable law.",
      "Session recordings, transcripts, detailed notes or session content shall be retained only where specifically created with notice/consent, or where required for safety, grievance handling, dispute resolution, legal compliance, professional obligations or lawful authority.",
      "Financial, invoice and transaction records may be retained for up to 6 years from the end of the relevant financial year, or for such longer period as required under applicable tax, accounting, audit or regulatory laws.",
      "Records connected with complaints, investigations, legal proceedings, regulatory enquiries, fraud, safety incidents or enforcement of rights may be retained until the matter is finally resolved and for such further period as required by law.",
      "Users may request deletion of their personal data by writing to privacy@mejoric.com. Deletion requests shall be processed within 30 days, subject to retention requirements for legal compliance, fraud prevention, dispute resolution, and enforcement of legal rights.",
      "Upon expiry of the applicable retention period, Mejoric shall take reasonable steps to delete, anonymise, de-identify or securely archive the relevant personal data.",
    ],
  },
  {
    num: "7",
    title: "Lawful Basis and Consent",
    clause: "Clause 9.7",
    paragraphs: [
      "Mejoric processes personal data on the basis of User consent and for legitimate uses as permitted under applicable law, including the Digital Personal Data Protection Act, 2023. By using the platform, the User provides free, informed, specific and unambiguous consent for processing of personal data for the purposes set out in these Terms and the Privacy Policy.",
    ],
  },
  {
    num: "8",
    title: "User Rights and Data Principal Rights",
    clause: "Clause 9.8",
    paragraphs: ["Subject to applicable law, Users shall have the right to:"],
    listItems: [
      "access and review their personal data;",
      "request correction, completion, updating, or erasure of personal data;",
      "withdraw consent for processing, subject to legal, operational, contractual, and regulatory limitations;",
      "nominate another individual to exercise rights in the event of death or incapacity, where applicable under law;",
      "seek grievance redressal regarding personal data processing; and",
      "exercise any additional rights available under the Digital Personal Data Protection Act, 2023 or other applicable laws.",
    ],
    footer:
      "Requests may be submitted to privacy@mejoric.com and shall be processed in accordance with applicable law.",
  },
];

module.exports = {
  TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  termsChapters,
  privacyPolicySections,
};
