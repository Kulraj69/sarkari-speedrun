import {
  DL_FEE_QUOTE,
  DL_FEE_URL,
  DL_WINDOW_QUOTE,
  DL_FAQ_URL,
  PAN_CHANGE_QUOTE,
  PAN_FEE_QUOTE,
  PAN_HELP_URL,
  PASSPORT_FEE_QUOTE,
  PASSPORT_FEE_URL,
  PASSPORT_PSP_QUOTE,
  PASSPORT_MEA_URL,
  PUNJAB_SEWA_QUOTE,
  PUNJAB_PORTAL_URL,
  PUNJAB_VERIFY_QUOTE,
  PUNJAB_FORM_URL,
  VOTER_FORM_QUOTE,
  VOTER_FORM_URL,
  VOTER_PROOF_QUOTE,
} from "@/lib/sources";

export interface GoldCheck {
  id: string;
  prompt: string;
  task: string;
  label: string;
  quote: string;
  url: string;
  checkedBy: string;
}

/**
 * Hand-checked lines from the official pages linked here.
 * The quote is the gold, not a model score.
 */
export const GOLD_CHECKS: readonly GoldCheck[] = [
  {
    id: "passport-fee",
    prompt: "renew passport, Patiala",
    task: "Passport re-issue",
    label: "36-page fee row",
    quote: PASSPORT_FEE_QUOTE,
    url: PASSPORT_FEE_URL,
    checkedBy: "Passport Seva fee table",
  },
  {
    id: "passport-psp",
    prompt: "renew passport, Patiala",
    task: "Passport re-issue",
    label: "PSP 2.0 in Punjab",
    quote: PASSPORT_PSP_QUOTE,
    url: PASSPORT_MEA_URL,
    checkedBy: "MEA Lok Sabha reply, 26 May 2025",
  },
  {
    id: "pan-fee",
    prompt: "link PAN and Aadhaar, Ludhiana",
    task: "PAN–Aadhaar link",
    label: "Delayed-link fee",
    quote: PAN_FEE_QUOTE,
    url: PAN_HELP_URL,
    checkedBy: "Income Tax Link Aadhaar help",
  },
  {
    id: "pan-notice",
    prompt: "link PAN and Aadhaar, Ludhiana",
    task: "PAN–Aadhaar link",
    label: "Enrolment-ID notice",
    quote: PAN_CHANGE_QUOTE,
    url: PAN_HELP_URL,
    checkedBy: "Income Tax Link Aadhaar help, Notification 26/2025",
  },
  {
    id: "dl-fee",
    prompt: "renew driving licence, Amritsar",
    task: "Driving licence renewal",
    label: "Renewal fee",
    quote: DL_FEE_QUOTE,
    url: DL_FEE_URL,
    checkedBy: "Parivahan licensing fees",
  },
  {
    id: "dl-window",
    prompt: "renew driving licence, Amritsar",
    task: "Driving licence renewal",
    label: "One-year window",
    quote: DL_WINDOW_QUOTE,
    url: DL_FAQ_URL,
    checkedBy: "Parivahan services FAQ",
  },
  {
    id: "voter-form",
    prompt: "change address on voter ID, Patiala",
    task: "Voter ID address",
    label: "Form 8 shifting",
    quote: VOTER_FORM_QUOTE,
    url: VOTER_FORM_URL,
    checkedBy: "ECI Form 8 PDF",
  },
  {
    id: "voter-proof",
    prompt: "change address on voter ID, Patiala",
    task: "Voter ID address",
    label: "Address proof list",
    quote: VOTER_PROOF_QUOTE,
    url: VOTER_FORM_URL,
    checkedBy: "ECI Form 8 PDF",
  },
  {
    id: "punjab-verify",
    prompt: "Punjab residence certificate, Patiala",
    task: "Punjab residence certificate",
    label: "Verification certificate",
    quote: PUNJAB_VERIFY_QUOTE,
    url: PUNJAB_FORM_URL,
    checkedBy: "Punjab personnel department form",
  },
  {
    id: "punjab-sewa",
    prompt: "Punjab residence certificate, Patiala",
    task: "Punjab residence certificate",
    label: "Sewa Kendra",
    quote: PUNJAB_SEWA_QUOTE,
    url: PUNJAB_PORTAL_URL,
    checkedBy: "e-Services Punjab",
  },
];

export const SMALL_SAMPLE_LABEL = "Small sample (5 tasks, 10 cited checks). Not a benchmark.";

export const MOCK_SCORE_NOTE =
  "Predicted rows in mock mode are not a live accuracy score. The cached demo is checked against these hand-copied official quotes. No Nemotron or Tavily call was made.";

export const LIVE_SCORE_NOTE =
  "Hand-checked against the cited official pages. Small sample, not a benchmark.";