import {
  CHANGE_SIGNAL,
  MIN_QUOTE_CHARS,
  NANO_MODEL_ID,
  NANO_MODEL_LABEL,
  PROVIDER_FIXTURE,
  RECORDED_LATENCY_MS,
  SUPER_MODEL_ID,
  SUPER_MODEL_LABEL,
  TAVILY_LABEL,
} from "@/lib/config";
import { RECORDED_TRACE_DETAIL } from "@/lib/copy";
import { amountsAreCited } from "@/lib/sanitize";
import {
  DL_FEE_QUOTE,
  DL_FEE_URL,
  DL_FORM_URL,
  DL_LATE_QUOTE,
  DL_MEDICAL_QUOTE,
  DL_RETEST_QUOTE,
  DL_RTO_QUOTE,
  DL_STEPS_QUOTE,
  DL_STEPS_URL,
  DL_WINDOW_QUOTE,
  DL_FAQ_URL,
  PAN_CHANGE_QUOTE,
  PAN_EXEMPT_QUOTE,
  PAN_FEE_QUOTE,
  PAN_HELP_URL,
  PAN_PORTAL_QUOTE,
  PAN_SMS_QUOTE,
  PAN_SMS_URL,
  PAN_WHO_QUOTE,
  PASSPORT_APPLY_URL,
  PASSPORT_CHARTER_URL,
  PASSPORT_DOC_QUOTE,
  PASSPORT_DOC_URL,
  PASSPORT_FEE_QUOTE,
  PASSPORT_FEE_URL,
  PASSPORT_MEA_URL,
  PASSPORT_PAY_QUOTE,
  PASSPORT_POPSK_QUOTE,
  PASSPORT_PSP_QUOTE,
  PASSPORT_SMS_QUOTE,
  PASSPORT_TATKAAL_QUOTE,
  PASSPORT_TIME_QUOTE,
  PASSPORT_VISIT_QUOTE,
  PUNJAB_DOB_QUOTE,
  PUNJAB_FORM_URL,
  PUNJAB_ID_QUOTE,
  PUNJAB_ONLINE_QUOTE,
  PUNJAB_PORTAL_URL,
  PUNJAB_RTS_QUOTE,
  PUNJAB_SEWA_QUOTE,
  PUNJAB_VERIFY_QUOTE,
  VOTER_FEE_QUOTE,
  VOTER_FAQ_URL,
  VOTER_FORM_QUOTE,
  VOTER_FORM_URL,
  VOTER_OLD_FORM_QUOTE,
  VOTER_PROOF_QUOTE,
  VOTER_SERVICE_QUOTE,
  VOTER_SERVICE_URL,
} from "@/lib/sources";
import { isOfficialHost, isPublicHttpUrl } from "@/lib/trust";
import type { GuideItem, StepTrace, SubQuestion } from "@/lib/types";

export interface DemoTask {
  id: string;
  title: string;
  text: string;
  task: string;
  city: string;
  questions: SubQuestion[];
  items: GuideItem[];
  hindi: string;
  english: string;
}

function item(parts: Omit<GuideItem, "sample" | "basis">): GuideItem {
  return { ...parts, sample: true, basis: "sample-fixture" };
}

const PASSPORT_QUESTIONS: SubQuestion[] = [
  { id: "q1", text: "What fee does Passport Seva list for a 36-page re-issue, including Tatkaal?" },
  { id: "q2", text: "What documents and appointment steps does the re-issue page require?" },
  { id: "q3", text: "What processing time does the citizen charter give, and how do Punjab counters show up?" },
];

const PAN_QUESTIONS: SubQuestion[] = [
  { id: "q1", text: "Who must link PAN and Aadhaar, and where is the portal?" },
  { id: "q2", text: "What fee and which dated notice does the Link Aadhaar page quote?" },
];

const DL_QUESTIONS: SubQuestion[] = [
  { id: "q1", text: "What renewal fee and late fee does Parivahan publish?" },
  { id: "q2", text: "What is the renewal window, the Sarathi path, and the medical form?" },
];

const VOTER_QUESTIONS: SubQuestion[] = [
  { id: "q1", text: "Which current form covers an address change, and which proof does it list?" },
  { id: "q2", text: "What does the older ECI FAQ still say about Form 8A and the EPIC fee?" },
];

const PUNJAB_QUESTIONS: SubQuestion[] = [
  { id: "q1", text: "Which documents does the Punjab residence-certificate form mark mandatory?" },
  { id: "q2", text: "Where does a Patiala resident submit it, online or at a Sewa Kendra?" },
];

export const DEMO_TASKS: readonly DemoTask[] = [
  {
    id: "passport-patiala",
    title: "Renew a passport",
    text: "renew passport, Patiala",
    task: "renew passport",
    city: "Patiala",
    questions: PASSPORT_QUESTIONS,
    hindi:
      "36 पेज और 10 साल वाले री-इश्यू की पंक्ति में आवेदन शुल्क Rs.2,500 है, और उसी पंक्ति में अतिरिक्त तत्काल शुल्क भी Rs.2,500 है। पेज लिखता है कि तत्काल शुल्क आवेदन शुल्क के ऊपर देना होता है। अपॉइंटमेंट के लिए ऑनलाइन भुगतान अनिवार्य है। PSK पर मूल दस्तावेज़ और एक सेट स्वयं-सत्यापित प्रतियाँ ले जाएँ। प्रिंट अब अनिवार्य नहीं; SMS भी चलता है। नागरिक चार्टर के मुताबिक री-इश्यू में प्री-पुलिस वेरिफिकेशन न हो तो 7 कार्यदिवस तक, और वेरिफिकेशन चाहिए तो 30 कार्यदिवस तक। पुलिस वेरिफिकेशन का समय अलग है। 26 मई 2025 को पंजाब के PSK/POPSK पर PSP 2.0 लागू हुआ। पटियाला का गली का पता इस कैश में नहीं है। काउंटर पोर्टल पर बुक करें। भुगतान से पहले शुल्क पेज खोलें।",
    english:
      "The 36-page, 10-year re-issue row lists an application fee of Rs.2,500 and an additional Tatkaal fee of Rs.2,500. The page says the Tatkaal fee is paid in addition to the application fee. Online payment is mandatory to book a PSK, POPSK, or PO appointment. Carry originals and one set of self-attested photocopies. A printed receipt is no longer required; an SMS is accepted. The citizen charter says re-issue takes up to 7 working days when pre-police verification is not required, and up to 30 working days when it is, with that period excluded. PSP 2.0 went live across Punjab PSK and POPSK counters on 26th May 2025. This cache does not include a street address in Patiala. Book the counter on the portal, and open the fee page before you pay.",
    items: [
      item({
        id: "fee",
        kind: "fee",
        order: 1,
        title: "36-page, 10-year re-issue",
        detail:
          "That row shows Rs.2,500 in the application column and Rs.2,500 in the additional Tatkaal column.",
        quote: PASSPORT_FEE_QUOTE,
        url: PASSPORT_FEE_URL,
        sourceTitle: "Passport Seva fee table",
        confidence: 0.92,
        recentChange: false,
      }),
      item({
        id: "tatkaal",
        kind: "fee",
        order: 2,
        title: "Tatkaal sits on top of the application fee",
        detail: "Do not treat the Tatkaal column as a discount. It is added to the application fee.",
        quote: PASSPORT_TATKAAL_QUOTE,
        url: PASSPORT_FEE_URL,
        sourceTitle: "Passport Seva fee table",
        confidence: 0.9,
        recentChange: false,
      }),
      item({
        id: "pay",
        kind: "step",
        order: 3,
        title: "Pay online before the appointment exists",
        detail: "Register, submit the re-issue form, then pay. Card, netbanking, and UPI are the modes the same page lists beside this rule.",
        quote: PASSPORT_PAY_QUOTE,
        url: PASSPORT_APPLY_URL,
        sourceTitle: "Apply for re-issue",
        confidence: 0.9,
        recentChange: false,
      }),
      item({
        id: "docs",
        kind: "document",
        order: 4,
        title: "Originals plus one self-attested set",
        detail: "The document advisor says this for re-issue. It also says your jurisdictional passport office may ask for more.",
        quote: PASSPORT_DOC_QUOTE,
        url: PASSPORT_DOC_URL,
        sourceTitle: "Documents for re-issue",
        confidence: 0.88,
        recentChange: false,
      }),
      item({
        id: "visit",
        kind: "office",
        order: 5,
        title: "The counter is the one you book",
        detail:
          "Patiala has no street address in this cache. Book the PSK, POPSK, or passport office named on your appointment.",
        quote: PASSPORT_VISIT_QUOTE,
        url: PASSPORT_APPLY_URL,
        sourceTitle: "Apply for re-issue",
        confidence: 0.84,
        recentChange: false,
      }),
      item({
        id: "sms",
        kind: "change",
        order: 6,
        title: "A printed receipt is no longer required",
        detail: "An SMS with the appointment is accepted at the passport office.",
        quote: PASSPORT_SMS_QUOTE,
        url: PASSPORT_APPLY_URL,
        sourceTitle: "Apply for re-issue",
        confidence: 0.86,
        recentChange: true,
      }),
      item({
        id: "time",
        kind: "time",
        order: 7,
        title: "7 or 30 working days, police time excluded",
        detail: "Re-issue without pre-police verification is the shorter clock. If verification is required first, use the longer one. Neither clock includes the police-verification period.",
        quote: PASSPORT_TIME_QUOTE,
        url: PASSPORT_CHARTER_URL,
        sourceTitle: "MEA citizen charter",
        confidence: 0.8,
        recentChange: false,
      }),
      item({
        id: "psp",
        kind: "change",
        order: 8,
        title: "PSP 2.0 is live in Punjab",
        detail: `${PASSPORT_POPSK_QUOTE} The same reply dates the PSP 2.0 rollout, including Punjab counters, to 26th May 2025.`,
        quote: PASSPORT_PSP_QUOTE,
        url: PASSPORT_MEA_URL,
        sourceTitle: "Lok Sabha reply on passport services in Punjab",
        confidence: 0.86,
        recentChange: true,
      }),
    ],
  },
  {
    id: "pan-ludhiana",
    title: "Link PAN and Aadhaar",
    text: "link PAN and Aadhaar, Ludhiana",
    task: "link PAN and Aadhaar",
    city: "Ludhiana",
    questions: PAN_QUESTIONS,
    hindi:
      "लुधियाना होने से शुल्क नहीं बदलता। यह राष्ट्रीय पोर्टल है। 1 जुलाई 2017 को PAN रखने वाले व्यक्ति को आधार बताना होता है, कुछ छूटों के साथ। पोर्टल पर बिना लॉगिन भी लिंक हो सकता है। SMS का रास्ता भी आयकर विभाग के पेज पर है। देरी वाली लिंक के लिए पेज ₹1,000 लिखता है, और वह समय-सीमा 31 मई 2024 तक बढ़ाई गई थी। नामांकन-आईडी वाले PAN के लिए पेज 31 दिसम्बर 2025 तक वास्तविक आधार माँगता है, वरना 1 जनवरी 2026 से PAN निष्क्रिय। यह तारीख उसी नोटिस की है। भुगतान से पहले पेज खोलें।",
    english:
      "Ludhiana does not change this fee. The portal is national. Someone allotted a PAN as on 1st July 2017 who can get Aadhaar has to intimate it, with the exemptions the page lists. Registered and unregistered users can link without logging in, and the department also lists an SMS route. The page sets a prescribed fee of ₹1,000 for delayed linkage after extending that deadline to 31st May 2024. For PANs allotted on an Aadhaar enrolment ID, the same help page says linkage with the actual Aadhaar number was required on or before 31st December 2025, failing which the PAN becomes inoperative from 1st January 2026. Those dates are the notice, not a new extension. Open the page before you pay.",
    items: [
      item({
        id: "who",
        kind: "step",
        order: 1,
        title: "Who the page says must link",
        detail: "The duty is to intimate the Aadhaar number. The city does not appear in the rule.",
        quote: PAN_WHO_QUOTE,
        url: PAN_HELP_URL,
        sourceTitle: "Link Aadhaar help",
        confidence: 0.9,
        recentChange: false,
      }),
      item({
        id: "portal",
        kind: "office",
        order: 2,
        title: "e-Filing portal, before or after login",
        detail: "Use the Link Aadhaar quick link. Ludhiana does not have a separate counter on this page.",
        quote: PAN_PORTAL_QUOTE,
        url: PAN_HELP_URL,
        sourceTitle: "Link Aadhaar help",
        confidence: 0.9,
        recentChange: false,
      }),
      item({
        id: "sms",
        kind: "step",
        order: 3,
        title: "SMS is the other official route",
        detail: "The income-tax FAQ lists SMS and the e-filing portal. It does not list a city office.",
        quote: PAN_SMS_QUOTE,
        url: PAN_SMS_URL,
        sourceTitle: "How to link Aadhaar with PAN",
        confidence: 0.84,
        recentChange: false,
      }),
      item({
        id: "fee",
        kind: "fee",
        order: 4,
        title: "Delayed linkage fee on the help page",
        detail: "The page states a prescribed fee of ₹1,000 and says the earlier deadline was extended to 31st May 2024.",
        quote: PAN_FEE_QUOTE,
        url: PAN_HELP_URL,
        sourceTitle: "Link Aadhaar help",
        confidence: 0.86,
        recentChange: true,
      }),
      item({
        id: "notice",
        kind: "change",
        order: 5,
        title: "Enrolment-ID PAN notice",
        detail:
          "Quoted deadline: on or before 31st December 2025, then inoperative from 1st January 2026. This demo does not move that date.",
        quote: PAN_CHANGE_QUOTE,
        url: PAN_HELP_URL,
        sourceTitle: "Link Aadhaar help",
        confidence: 0.88,
        recentChange: true,
      }),
      item({
        id: "exempt",
        kind: "document",
        order: 6,
        title: "Exemptions the same page still prints",
        detail:
          "The help page still names Assam, Jammu and Kashmir, and Meghalaya, plus other categories further down the answer. Read that list on the page. It can change by notification.",
        quote: PAN_EXEMPT_QUOTE,
        url: PAN_HELP_URL,
        sourceTitle: "Link Aadhaar help",
        confidence: 0.7,
        recentChange: false,
      }),
    ],
  },
  {
    id: "dl-amritsar",
    title: "Renew a driving licence",
    text: "renew driving licence, Amritsar",
    task: "renew driving licence",
    city: "Amritsar",
    questions: DL_QUESTIONS,
    hindi:
      "परिवहन पोर्टल पर ड्राइविंग लाइसेंस के नवीनीकरण का शुल्क Rs. 200.00 है। ग्रेस अवधि के बाद आवेदन पर Rs. 300.00 है, और पेज देरी के हर वर्ष या उसके हिस्से पर Rupees One Thousand Only अतिरिक्त लिखता है। नवीनीकरण लाइसेंस की मियाद से एक साल पहले या एक साल बाद तक हो सकता है। यह CMV संशोधन का हवाला देता है। सारथी पर राज्य चुनें, Driving License मेनू से सेवा खोलें, और तय तारीख पर मूल दस्तावेज़ व शुल्क रसीद के साथ RTO जाएँ। अमृतसर का गली का पता यहाँ नहीं है। एक साल से ज्यादा पुराना लाइसेंस हो तो ड्राइविंग टेस्ट लग सकता है, राज्य नीति के अनुसार। 40 साल से ऊपर या ट्रांसपोर्ट लाइसेंस पर Form-1A माँगा गया है।",
    english:
      "Parivahan lists renewal of a driving licence at Rs. 200.00. After the grace period the row is Rs. 300.00, plus an additional fee at the rate of Rupees One Thousand Only for each year or part of a year of delay. Renewal can be done within one year before or after expiry. The page calls that the latest amendment of the CMV Act. On Sarathi, select the state, open Services on Drivers License, and visit the RTO on the scheduled date with originals and the fee slip. This cache has no street address in Amritsar. If the licence has been expired for more than one year, a driving test may be required, and the page says the condition may change with state policy. Form-1A is required for renewal above 40 or for a transport licence.",
    items: [
      item({
        id: "fee",
        kind: "fee",
        order: 1,
        title: "Renewal fee",
        detail: "The licensing fee table lists renewal of a driving licence at Rs. 200.00.",
        quote: DL_FEE_QUOTE,
        url: DL_FEE_URL,
        sourceTitle: "Licensing fees and charges",
        confidence: 0.93,
        recentChange: false,
      }),
      item({
        id: "late",
        kind: "fee",
        order: 2,
        title: "After the grace period",
        detail:
          "The same table lists Rs. 300.00 when the application is after the grace period, and an additional fee at the rate of Rupees One Thousand Only for each year of delay.",
        quote: DL_LATE_QUOTE,
        url: DL_FEE_URL,
        sourceTitle: "Licensing fees and charges",
        confidence: 0.9,
        recentChange: false,
      }),
      item({
        id: "window",
        kind: "time",
        order: 3,
        title: "One year before or after expiry",
        detail: "This is the window in the Parivahan FAQ. It is not a promise of how many days the RTO will take after you apply.",
        quote: DL_WINDOW_QUOTE,
        url: DL_FAQ_URL,
        sourceTitle: "Services on a driving licence",
        confidence: 0.86,
        recentChange: true,
      }),
      item({
        id: "steps",
        kind: "step",
        order: 4,
        title: "Sarathi, then the state, then the service",
        detail: "For Amritsar, the state on Sarathi is Punjab. The FAQ does not name a booth inside the city.",
        quote: DL_STEPS_QUOTE,
        url: DL_STEPS_URL,
        sourceTitle: "Parivahan FAQ",
        confidence: 0.88,
        recentChange: false,
      }),
      item({
        id: "rto",
        kind: "office",
        order: 5,
        title: "RTO on the date you are given",
        detail: "Take original documents and the fee slip. The nearest counter is whichever RTO the application is booked against.",
        quote: DL_RTO_QUOTE,
        url: DL_STEPS_URL,
        sourceTitle: "Parivahan FAQ",
        confidence: 0.84,
        recentChange: false,
      }),
      item({
        id: "retest",
        kind: "change",
        order: 6,
        title: "Over a year late, a test may apply",
        detail: "The FAQ says this can follow state policy. Do not assume Amritsar skips it.",
        quote: DL_RETEST_QUOTE,
        url: DL_STEPS_URL,
        sourceTitle: "Parivahan FAQ",
        confidence: 0.78,
        recentChange: false,
      }),
      item({
        id: "medical",
        kind: "document",
        order: 7,
        title: "Form-1A above 40, or for transport",
        detail: "Form 2's annexure also lists address and age proof, Form-1, and a photograph. Carry what the acknowledgement prints.",
        quote: DL_MEDICAL_QUOTE,
        url: DL_FORM_URL,
        sourceTitle: "CMVR Form 2",
        confidence: 0.86,
        recentChange: false,
      }),
    ],
  },
  {
    id: "voter-patiala",
    title: "Change the address on a voter ID",
    text: "change address on voter ID, Patiala",
    task: "change address on voter ID",
    city: "Patiala",
    questions: VOTER_QUESTIONS,
    hindi:
      "पटियाला में पता बदलवाने के लिए मौजूदा फॉर्म 8 शिफ्टिंग ऑफ रेजिडेंस का फॉर्म है। भारत सरकार के सेवा पोर्टल पर भी लिखा है कि नामांकित मतदाता फॉर्म 8 भरे। पते के सबूत में कम से कम एक साल का पानी, बिजली या गैस बिल, आधार कार्ड, बैंक पासबुक, या भारतीय पासपोर्ट शामिल हैं। पुराना ECI FAQ अभी भी कहता है कि उसी क्षेत्र में हों तो फॉर्म 8A, वरना फॉर्म 6। नया फॉर्म 8 उसके ऊपर रखा गया है, क्योंकि वही voters.eci.gov.in पर होस्ट है। उस FAQ में EPIC पर नया पता Rs. 25 पर लिखा है। फॉर्म 8 की PDF उस राशि को दोहराती नहीं। भुगतान से पहले पोर्टल देखें।",
    english:
      "For an address change in Patiala, the form now hosted for shifting of residence is Form 8. The national services portal says an enrolled elector fills Form 8 for a shift, a correction, a replacement EPIC, or a PwD marking. Address proof on the form includes a water, electricity, or gas bill at least a year old, an Aadhaar card, a bank or post-office passbook, or an Indian passport. An older ECI FAQ still says Form 8A inside the same constituency and Form 6 if you have moved constituency. Super keeps Form 8 as the lead step because that is the form voters.eci.gov.in hosts, and leaves the FAQ at a lower confidence. That FAQ also states a charge of Rs. 25 to change the address on an EPIC. The Form 8 PDF in this cache does not restate Rs. 25. Check the portal before you pay.",
    items: [
      item({
        id: "form",
        kind: "step",
        order: 1,
        title: "Form 8 is the shifting form",
        detail: "Submit it to the Electoral Registration Officer for the constituency. The form title itself includes shifting of residence.",
        quote: VOTER_FORM_QUOTE,
        url: VOTER_FORM_URL,
        sourceTitle: "Form 8 (English PDF)",
        confidence: 0.91,
        recentChange: false,
      }),
      item({
        id: "service",
        kind: "office",
        order: 2,
        title: "File it as an enrolled elector",
        detail: "The service portal points at Form 8. Patiala's booth is not named. The ERO of the new address takes the form.",
        quote: VOTER_SERVICE_QUOTE,
        url: VOTER_SERVICE_URL,
        sourceTitle: "National Government Services Portal",
        confidence: 0.86,
        recentChange: false,
      }),
      item({
        id: "proof",
        kind: "document",
        order: 3,
        title: "One self-attested address proof",
        detail: "The form lists a utility bill at least a year old, Aadhaar, a passbook, or an Indian passport, among other papers.",
        quote: VOTER_PROOF_QUOTE,
        url: VOTER_FORM_URL,
        sourceTitle: "Form 8 (English PDF)",
        confidence: 0.9,
        recentChange: false,
      }),
      item({
        id: "older",
        kind: "change",
        order: 4,
        title: "Older FAQ still says Form 8A or Form 6",
        detail:
          "Kept so the conflict is visible. The lead step is Form 8, because that PDF is the form the voters' portal hosts. This FAQ line is older and does not name a year.",
        quote: VOTER_OLD_FORM_QUOTE,
        url: VOTER_FAQ_URL,
        sourceTitle: "ECI FAQ on electoral roll corrections",
        confidence: 0.42,
        recentChange: false,
      }),
      item({
        id: "fee",
        kind: "fee",
        order: 5,
        title: "FAQ fee for a new EPIC address",
        detail: "The FAQ states a charge of Rs. 25. Form 8's PDF does not repeat that figure, so confirm it on the portal.",
        quote: VOTER_FEE_QUOTE,
        url: VOTER_FAQ_URL,
        sourceTitle: "ECI FAQ on electoral roll corrections",
        confidence: 0.58,
        recentChange: false,
      }),
    ],
  },
  {
    id: "punjab-residence",
    title: "Punjab residence certificate",
    text: "Punjab residence certificate, Patiala",
    task: "Punjab residence certificate",
    city: "Patiala",
    questions: PUNJAB_QUESTIONS,
    hindi:
      "यह पंजाब का रेजिडेंस सर्टिफिकेट है, पटियाला के लिए। फॉर्म पर RTS Service Code 52 है। अनिवार्य कागज़: राशन कार्ड, वोटर कार्ड, आधार (फॉर्म पर Adhar लिखा है), ड्राइविंग लाइसेंस या पासपोर्ट की कॉपी; जन्म तिथि का सबूत; और सरपंच, पटवारी, विभाग प्रमुख या नगर पार्षद का सत्यापन पत्र। स्कूल प्रमाणपत्र वैकल्पिक है। आवेदन ऑनलाइन, यूज़रनेम बनाकर, या किसी सेवा केंद्र पर। इस कैश किए फॉर्म पर रुपए का शुल्क और दिनों की संख्या नहीं छपी। गली का पता नहीं जोड़ा गया। सेवा केंद्र या पोर्टल पर वर्तमान शुल्क पूछें।",
    english:
      "This is Punjab's residence certificate, for a Patiala address. The personnel-department form prints RTS Service Code: 52. Mandatory copies on that form: ration card, voter card, Aadhaar (printed as Adhar), driving licence, or passport; proof of date of birth; and a verification certificate from the sarpanch, patwari, head of department, or municipal councillor. A school certificate is optional. Apply online after registering, or at any Sewa Kendra. The cached form does not print a rupee fee or a day count, and this map does not invent one or a street address. Ask the Sewa Kendra or the portal for the current fee.",
    items: [
      item({
        id: "id",
        kind: "document",
        order: 1,
        title: "Photo identity, as the form spells it",
        detail: "The form asks for one of these copies. It prints Adhar, not Aadhaar.",
        quote: PUNJAB_ID_QUOTE,
        url: PUNJAB_FORM_URL,
        sourceTitle: "Punjab residence certificate form",
        confidence: 0.9,
        recentChange: false,
      }),
      item({
        id: "dob",
        kind: "document",
        order: 2,
        title: "Proof of date of birth",
        detail: "Marked on the same form, beside the identity copy.",
        quote: PUNJAB_DOB_QUOTE,
        url: PUNJAB_FORM_URL,
        sourceTitle: "Punjab residence certificate form",
        confidence: 0.88,
        recentChange: false,
      }),
      item({
        id: "verify",
        kind: "document",
        order: 3,
        title: "Verification from sarpanch, patwari, HOD, or councillor",
        detail: "The form asks for the certificate number and treats this copy as required.",
        quote: PUNJAB_VERIFY_QUOTE,
        url: PUNJAB_FORM_URL,
        sourceTitle: "Punjab residence certificate form",
        confidence: 0.9,
        recentChange: false,
      }),
      item({
        id: "rts",
        kind: "time",
        order: 4,
        title: "Right to Service code, not a day count",
        detail: "The form prints a service code. It does not print how many days Patiala will take. No day count is filled in here.",
        quote: PUNJAB_RTS_QUOTE,
        url: PUNJAB_FORM_URL,
        sourceTitle: "Punjab residence certificate form",
        confidence: 0.8,
        recentChange: false,
      }),
      item({
        id: "fee",
        kind: "fee",
        order: 5,
        title: "No rupee fee on the cached form",
        detail: "The residence form and the state forms index do not print a fee in the lines cached here. Ask the Sewa Kendra before you pay.",
        quote: PUNJAB_RTS_QUOTE,
        url: PUNJAB_FORM_URL,
        sourceTitle: "Punjab residence certificate form",
        confidence: 0.64,
        recentChange: false,
      }),
      item({
        id: "online",
        kind: "step",
        order: 6,
        title: "Register, then open the form",
        detail: "e-Services Punjab describes the online path. It is not a Patiala-only site.",
        quote: PUNJAB_ONLINE_QUOTE,
        url: PUNJAB_PORTAL_URL,
        sourceTitle: "e-Services Punjab",
        confidence: 0.86,
        recentChange: false,
      }),
      item({
        id: "sewa",
        kind: "office",
        order: 7,
        title: "Any Sewa Kendra",
        detail: "The portal says you can apply at a Sewa Kendra. A Patiala street address is not in the cached page.",
        quote: PUNJAB_SEWA_QUOTE,
        url: PUNJAB_PORTAL_URL,
        sourceTitle: "e-Services Punjab",
        confidence: 0.86,
        recentChange: false,
      }),
    ],
  },
];

const DEMO_COUNT = 5;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function matchFixture(text: string): DemoTask | null {
  const normalized = normalize(text);
  return DEMO_TASKS.find((task) => normalize(task.text) === normalized) ?? null;
}

export function assertDemoFixtures(tasks: readonly DemoTask[] = DEMO_TASKS): void {
  if (tasks === DEMO_TASKS && tasks.length !== DEMO_COUNT) {
    throw new Error(`Expected ${DEMO_COUNT} cached demos.`);
  }
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(normalize(task.text))) throw new Error(`Duplicate demo: ${task.id}`);
    seen.add(normalize(task.text));
    if (!task.text.includes(",") || !task.city) throw new Error(`Demo ${task.id} needs a city.`);
    if (task.items.length === 0) throw new Error(`Demo ${task.id} has no items.`);
    const quotes = task.items.map((entry) => entry.quote);
    if (!amountsAreCited(`${task.english} ${task.hindi}`, quotes)) {
      throw new Error(`Demo ${task.id} checklist mentions a rupee amount that is not in a quote.`);
    }
    for (const entry of task.items) {
      if (entry.quote.trim().length < MIN_QUOTE_CHARS) {
        throw new Error(`Demo ${task.id} quote is too short: ${entry.id}`);
      }
      if (!isPublicHttpUrl(entry.url) || !isOfficialHost(entry.url)) {
        throw new Error(`Demo ${task.id} cites a non-official URL: ${entry.url}`);
      }
      if (!amountsAreCited(`${entry.title} ${entry.detail}`, [entry.quote])) {
        throw new Error(`Demo ${task.id} item ${entry.id} states a fee that is not in its quote.`);
      }
      if (entry.recentChange && !CHANGE_SIGNAL.test(entry.quote)) {
        throw new Error(`Demo ${task.id} flags a recent change the quote does not support: ${entry.id}`);
      }
      if (!entry.sample || entry.basis !== "sample-fixture") {
        throw new Error(`Demo ${task.id} item ${entry.id} must stay a sample fixture.`);
      }
    }
  }
}

export function fixtureTraces(task: DemoTask): StepTrace[] {
  const traces: StepTrace[] = [
    {
      id: "plan",
      step: "plan",
      title: "Plan sub-questions",
      detail: RECORDED_TRACE_DETAIL,
      provider: PROVIDER_FIXTURE,
      modelId: NANO_MODEL_ID,
      modelLabel: NANO_MODEL_LABEL,
      latencyMs: RECORDED_LATENCY_MS.plan,
      promptTokens: null,
      completionTokens: null,
      estimatedUsd: null,
    },
  ];
  task.questions.forEach((question, index) => {
    const table = RECORDED_LATENCY_MS.evidence;
    traces.push({
      id: `evidence-${question.id}`,
      step: "evidence",
      title: `Official pages · ${question.id}`,
      detail: RECORDED_TRACE_DETAIL,
      provider: PROVIDER_FIXTURE,
      modelId: null,
      modelLabel: TAVILY_LABEL,
      latencyMs: table[Math.min(index, table.length - 1)] ?? table[0],
      promptTokens: null,
      completionTokens: null,
      estimatedUsd: null,
      questionId: question.id,
    });
  });
  traces.push(
    {
      id: "settle",
      step: "settle",
      title: "Settle the pages",
      detail: `${RECORDED_TRACE_DETAIL} Live mode would call ${SUPER_MODEL_LABEL}, then Ultra if Super is unavailable. A low-confidence item is searched once more.`,
      provider: PROVIDER_FIXTURE,
      modelId: SUPER_MODEL_ID,
      modelLabel: SUPER_MODEL_LABEL,
      latencyMs: RECORDED_LATENCY_MS.settle,
      promptTokens: null,
      completionTokens: null,
      estimatedUsd: null,
    },
    {
      id: "checklist",
      step: "checklist",
      title: "Hindi and English checklist",
      detail: RECORDED_TRACE_DETAIL,
      provider: PROVIDER_FIXTURE,
      modelId: NANO_MODEL_ID,
      modelLabel: NANO_MODEL_LABEL,
      latencyMs: RECORDED_LATENCY_MS.checklist,
      promptTokens: null,
      completionTokens: null,
      estimatedUsd: null,
    },
  );
  return traces;
}