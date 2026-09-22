// config/catalog.js — browser-safe constants (no env). Imported by the UI.
export const PRACTICE = {
  name: "The Psychiatry Group PLLC",
  address: "5904 N Division St, Spokane, WA 99208",
  phone: "844-495-4357",
  emailDomain: "psychiatrygroup.com",
};
export const LNI_FAX_NUMBER = "+13609024567";
export const FORM_CATEGORIES = [
  { id: "apf", label: "APF", forms: [
    { id: "f242-385", name: "Activity Prescription Form (APF)", template: "F242-385-000.pdf", fillable: true },
  ]},
  { id: "prior-auth", label: "Prior Auth", forms: [
    { id: "f242-397", name: "Preauthorization Request for Services", template: "F242-397-000.pdf", fillable: true },
  ]},
  { id: "assessments", label: "Assessments", forms: [] },
  { id: "bhi", label: "BHI forms", forms: [
    { id: "f245-461", name: "Behavioral Health Assessment", template: "F245-461-000.pdf", fillable: true },
    { id: "f245-462", name: "Behavioral Health Intervention/Re-assessment", template: "F245-462-000.pdf", fillable: true },
    { id: "phq-4", name: "PHQ-4", template: "PHQ-4-fillable.pdf", fillable: true },
    { id: "gcps", name: "2-item GCPS", template: "GCPS-fillable.pdf", fillable: true },
  ]},
];
