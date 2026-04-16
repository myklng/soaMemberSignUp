# SOA Singapore — Membership Application Form

**Version 1.2.4**

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
        │     (each file is named with a unique ID + applicant initials)
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

Both sponsors must be current SOA members. Names are suggested via autocomplete from the SOA member list (pulled live from the `MemberList` tab in Google Sheets).

**Proposer:**

| Field | Required | Notes |
|---|---|---|
| Full Name | ✴ | Autocomplete from SOA member list |
| Confirm SOA Member | ✴ | Button — green if selected from list, amber if manually confirmed |
| Signature | ✴ | Drawn on-screen signature pad · min 10 stroke points |

**Seconder:** same fields as Proposer.

---

### §8 · Applicant Declaration

> *"I declare that the particulars given above are true and correct. I agree to be bound by the Constitution and By-Laws of SOA."*

| Field | Required | Notes |
|---|---|---|
| Applicant Full Name | Auto | Read-only, copied from §1 |
| Declaration Agreement | ✴ | Checkbox confirmation |

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

---

## Drive File Naming

Uploaded files are saved to Google Drive with this naming convention:

```
{signUpID}_{initials}_{type}.{ext}

Example (applicant: John Smith Tan, ID: 20261604-143022):
  20261604-143022_JST_passport_photo.png
  20261604-143022_JST_qualification_photocopy.png
  20261604-143022_JST_payment_proof.png
  20261604-143022_JST_proposer_signature.png
  20261604-143022_JST_seconder_signature.png
  20261604-143022_JST_agreement_signature.png
```

All Drive files are set to **view-only / anyone with link** so the Sheet URL columns are clickable.

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
     SHEET_B:         'MemberList',     // tab name with member names in column A (no header row)
     DRIVE_FOLDER_ID: 'your-drive-folder-id',
   };
   ```
4. Deploy → **New deployment** → Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL

### 2 · WordPress Shortcode

1. Open `wordpress/soa-form-shortcode.php`
2. Update the config block at the top of the file:
   ```php
   define( 'SOA_FORM_GITHUB_RAW_URL', 'https://raw.githubusercontent.com/myklng/soaMemberSignUp/main/soa-signup-form.html' );
   define( 'SOA_APPS_SCRIPT_URL',     'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec' );
   define( 'SOA_FORM_CACHE_TTL',      300 );
   ```
3. Paste into **Code Snippets** plugin (or `functions.php`)
4. Add `[soa_signup_form]` to any WordPress page

### 3 · Cache-Bust on Deploy (optional)

A GitHub Action in `.github/workflows/bust-cache.yml` automatically clears the WordPress transient cache on every push to `main` that changes `soa-signup-form.html`.

Requires two GitHub repository secrets:
- `SOA_CACHE_BUST_SECRET` — random secret, also added to `wp-config.php` as `define('SOA_CACHE_BUST_SECRET', '...')`
- `WP_SITE_URL` — your WordPress site URL, e.g. `https://yoursite.org`

---

## Console Debug Tools

Open the browser console on the form page to access:

```js
soaDebug.checkConfig()       // show current Apps Script URL and sponsor list status
soaDebug.testConnection()    // GET Apps Script — verify sponsor list loads
soaDebug.testPost()          // POST test payload — verify Sheet writes end-to-end
```

---

## Testing the Backend (Apps Script IDE)

1. Open your Apps Script project
2. Select `_testPost` from the function dropdown
3. Click **Run**
4. Check **Execution log** — should show `{ success: true, signUpID: "..." }`
5. Verify a new row appears in the Applications sheet and files in Drive

---

## Libraries Used

| Library | Version | Purpose |
|---|---|---|
| [signature_pad](https://github.com/szimek/signature_pad) | 4.1.7 | Canvas-based on-screen signature drawing |
| [PDF.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | Client-side PDF → PNG conversion before upload |

Both loaded from jsDelivr CDN — no npm, no build step required.

---

## Browser Support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). Requires JavaScript enabled.
Signature pads support both mouse and touch input (tablets, touchscreens).
