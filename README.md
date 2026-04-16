# SOA Singapore — Membership Application Form

**Version 1.0.0**

A web-based membership application form for the **Singapore Optometric Association (SOA)**.
Built in plain HTML, CSS, and JavaScript — no frameworks, no build step.
Embeds directly into a WordPress page via a shortcode and submits data to Google Sheets + Google Drive through a Google Apps Script backend.

---

## How It All Works (for a 12-year-old 🧒)

Imagine you want to join a club. The club gives you a form to fill in — your name, address, a photo, and a signature. Normally you'd print it, write on it with a pen, and hand it in. This project does the exact same thing, but on a website.

Here's the journey of a membership application, step by step:

```
Person fills in the form on the website
        │
        ▼
They upload a photo and sign their name on screen (using their mouse or finger)
        │
        ▼
If they upload a PDF, the browser secretly converts it to a picture (PNG)
        │
        ▼
They click "Submit Application"
        │
        ▼
The browser bundles everything into one big package (called JSON)
        │
        ▼
That package is sent over the internet to a Google Apps Script
(think of it like a robot sitting inside Google's servers, waiting for mail)
        │
        ├──▶  Robot saves all the photos & signatures to a Google Drive folder
        │     (each file is named with a unique ID so nothing gets mixed up)
        │
        └──▶  Robot writes one new row in a Google Sheet
              (like adding a new row to a spreadsheet — one row per applicant)
        │
        ▼
The website shows a "Application Submitted ✓" message with a unique ID
```

That's it! The club admin can open Google Sheets at any time and see every application in a tidy table, with clickable links to each person's uploaded files.

---

## Project Structure

```
soaMemberSignUp/
├── soa-signup-form.html        ← The form (HTML + CSS + JS, all in one file)
├── apps-script/
│   └── Code.gs                 ← Google Apps Script backend (runs inside Google)
├── wordpress/
│   └── soa-form-shortcode.php  ← Paste into WordPress to embed the form
└── README.md                   ← You are here
```

---

## Form Sections & Field Requirements

The form is divided into **9 sections**. Fields marked ✴ are required.

---

### §1 · Personal Details

| Field | Required | Format / Notes |
|---|---|---|
| Full Name (English) | ✴ | Letters, spaces, hyphens, apostrophes, periods |
| Full Name (Chinese) | Optional | Chinese characters only |
| Date of Birth | ✴ | DD/MM/YYYY |
| NRIC / FIN | ✴ | Singapore format: `S/T/F/G/M` + 7 digits + letter (e.g. `S1234567A`) |
| Citizenship | ✴ | Letters only (e.g. `Singaporean`) |
| Email Address | ✴ | Valid email format |
| OOB Registration No. | Optional | Optometry Board of Singapore registration number |

---

### §2 · Address Information

**Are you currently practising optometry?** ✴ (Yes / No)

If **Yes**, the Practice Address block appears and becomes required:

| Field | Required | Notes |
|---|---|---|
| Practice / Clinic Name | ✴ (if practising) | |
| Practice Address | ✴ (if practising) | Street address + unit |
| Practice Country | ✴ (if practising) | Dropdown |
| Practice Tel | ✴ (if practising) | |

Residence Address (always required):

| Field | Required | Notes |
|---|---|---|
| Residence Address | ✴ | Street address + unit |
| Residence Country | ✴ | Dropdown |
| Tel (Home) | Optional | |
| Tel (Mobile) | ✴ | |

---

### §3 · Qualifications & Professional Background

**Latest Relevant Qualification:**

| Field | Required | Notes |
|---|---|---|
| Qualification Held | ✴ | e.g. `Bachelor of Optometry` |
| Date of Issue | ✴ | DD/MM/YYYY |
| Photocopy of Qualification | ✴ | JPEG / PNG / PDF · max 5 MB · min 150 DPI · PDFs auto-converted to PNG |
| Graduate Course | ✴ | e.g. `Optometry` |
| Graduate Institution | ✴ | e.g. `Singapore Polytechnic` |

**Other Optometric Organisation Memberships** (repeatable, up to 5):

| Field | Required | Notes |
|---|---|---|
| Organisation Name | Optional | |
| Length of Membership | Optional | e.g. `3 years` or `18 months` |

**Additional:**

| Field | Required | Notes |
|---|---|---|
| Relevant Experience | Optional | Free text |
| Online Questionnaire Completed | Optional | Checkbox |

---

### §4 · Membership Type

Choose one ✴:

| Type | Description |
|---|---|
| **Ordinary** | Fully qualified optometrist in active practice. Full voting rights. |
| **Associate** | Optometry students or those not yet fully qualified. |
| **CPE Affiliate** | Continuing Professional Education participants. |
| **Life** | One-time lifetime membership. |

---

### §5 · Payment

Fees are calculated automatically from the membership type selected.

| Field | Required | Notes |
|---|---|---|
| Entrance Fee | ✴ (auto) | SGD 100.00 — fixed for all types |
| Membership Fee | ✴ (auto) | Varies by type — set in `SOA_CONFIG` |
| Total | ✴ (auto) | Entrance + Membership |
| Payment Method | ✴ | Cheque / Bank Transfer / PayNow |
| Cheque Number | ✴ if Cheque | 6–9 digits |
| Bank Transfer Reference | ✴ if Bank Transfer | Alphanumeric |
| PayNow Reference | ✴ if PayNow | Alphanumeric |
| Proof of Payment | ✴ | JPEG / PNG / PDF · max 5 MB · PDFs auto-converted to PNG |

---

### §6 · Passport-Size Photo

| Field | Required | Notes |
|---|---|---|
| Passport Photo | ✴ | JPEG or PNG · min **400 × 514 px** · max 2 MB · white background · taken within 6 months |

---

### §7 · Sponsors

Both sponsors must be current SOA members. Their names are suggested from the SOA member list (pulled live from Google Sheets).

**Proposer:**

| Field | Required | Notes |
|---|---|---|
| Full Name | ✴ | Autocomplete from SOA member list |
| Confirm SOA Member | ✴ | Checkbox |
| Signature | ✴ | Drawn on-screen signature pad · min 10 stroke points |

**Seconder:** same fields as Proposer.

---

### §8 · Applicant Declaration

> *"I declare that the particulars given above are true and correct. I agree to be bound by the Constitution and By-Laws of SOA."*

| Field | Required | Notes |
|---|---|---|
| Applicant Full Name | Auto | Read-only, copied from §1 |
| Handwritten Signature | ✴ | Upload scanned / photographed signature · JPEG or PNG · max 1 MB |

---

### §9 · Membership Agreement

> *"I agree to abide by the rules, regulations and Code of Ethics of SOA and to pay membership fees when due."*

| Field | Required | Notes |
|---|---|---|
| Full Name | Auto | Read-only, copied from §1 |
| Signature | ✴ | Drawn on-screen signature pad · min 10 stroke points |

---

## Application ID (signUpID)

Every submission is assigned a unique ID generated at the moment of submission:

```
Format  : YYYYDDMM-HHMMSS
Example : 20261604-143022
           ^^^^         Year 2026
               ^^       Day 16
                 ^^     Month 04 (April)
                   ^^   Hour 14
                     ^^ Minute 30
                       ^^ Second 22
```

This ID is used to:
- Name every uploaded file: `20261604-143022_passport_photo.png`
- Identify the row in Google Sheets
- Show the applicant a reference number on the success screen

---

## How to Set Up

### 1 · Google Apps Script

1. Open [script.google.com](https://script.google.com) and create a new project
2. Paste the contents of `apps-script/Code.gs`
3. Fill in the `CONFIG` block at the top:
   ```js
   const CONFIG = {
     SHEET_ID:        'your-google-sheet-id',
     SHEET_A:         'Applications',   // tab name for submissions
     SHEET_B:         'Sponsors',       // tab name with member names in column A
     DRIVE_FOLDER_ID: 'your-drive-folder-id',
   };
   ```
4. Deploy → **New deployment** → Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL

### 2 · The Form

Open `soa-signup-form.html` and update the config at the top of the `<script>` section:

```js
const SOA_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
};

const MEMBERSHIP_FEES = {
  Ordinary:      { entrance: 100.00, annual: 0.00, label: 'Annual Membership Fee' },
  Associate:     { entrance: 100.00, annual: 0.00, label: 'Annual Membership Fee' },
  CPE_Affiliate: { entrance: 100.00, annual: 0.00, label: 'Annual Membership Fee' },
  Life:          { entrance: 100.00, annual: 0.00, label: 'Life Membership Fee (one-time)' },
  // TODO: fill in actual SGD amounts
};
```

### 3 · WordPress

1. Open `wordpress/soa-form-shortcode.php`
2. Confirm `SOA_FORM_GITHUB_RAW_URL` points to the raw file in this repo:
   ```
   https://raw.githubusercontent.com/myklng/soaMemberSignUp/main/soa-signup-form.html
   ```
3. Paste the file into your theme's `functions.php` (or a site-specific plugin)
4. Add `[soa_signup_form]` to any WordPress page — the form will appear

---

## What Happens After Submit

```
Google Sheets (SheetA "Applications")
  └─ New row with all form data + links to Drive files

Google Drive (your folder)
  └─ 20261604-143022_passport_photo.png
  └─ 20261604-143022_qualification_photocopy.png
  └─ 20261604-143022_payment_proof.png
  └─ 20261604-143022_declaration_signature.png
  └─ 20261604-143022_proposer_signature.png
  └─ 20261604-143022_seconder_signature.png
  └─ 20261604-143022_agreement_signature.png
```

All Drive files are set to **view-only / anyone with link** so the Sheet URL columns are clickable.

---

## Libraries Used

| Library | Version | Purpose |
|---|---|---|
| [signature_pad](https://github.com/szimek/signature_pad) | 4.1.7 | Canvas-based on-screen signature drawing |
| [PDF.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | Client-side PDF → PNG conversion before upload |

Both are loaded from the jsDelivr CDN at runtime — no npm, no build step required.

---

## Testing the Backend

Before going live, run the built-in smoke test inside the Apps Script IDE:

1. Open your Apps Script project
2. Select the function `_testPost` from the dropdown
3. Click **Run**
4. Check **Execution log** — you should see `{ success: true, signUpID: "..." }`
5. Verify a new row appears in SheetA and files appear in your Drive folder

---

## Browser Support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). Requires JavaScript enabled.
Signature pads support both mouse and touch input (tablets, touchscreens).
