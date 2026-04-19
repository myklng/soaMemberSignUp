# SOA Form Generator

A Google Apps Script web app that generates a filled-in PDF application form from a Google Docs template, pulling field data from the membership Google Sheet and image files from Google Drive.

---

## How It Works

```
User selects a record from the dropdown
        │
        ▼
Backend reads that row from the Google Sheet
        │
        ▼
Backend copies the Google Doc template
        │
        ├──▶  Replaces {{field_name}} text placeholders with Sheet values
        │
        └──▶  Replaces {{img_*}} image slots with matching Drive images
        │
        ▼
Copies exported to PDF (base64), temporary copy trashed
        │
        ▼
Frontend displays PDF inline + offers download
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 18 | Required by clasp |
| `@google/clasp` | `npm install -g @google/clasp` |
| Google Account | Must be the same account used to own the Apps Script project |
| GCP Project | Needed to authorise clasp OAuth — any project works |

### Install clasp and log in

```bash
npm install -g @google/clasp
clasp login
# Opens a browser — authorise with your Google account
```

---

## Project Structure

```
form-generator/
├── Code.gs          ← Backend: doGet, login, getRecords, generatePDF
├── Index.html       ← Frontend: login, dropdown, PDF preview
├── appsscript.json  ← Manifest: scopes, webapp config
├── .clasp.json      ← Links this directory to the Apps Script project
├── .gitignore       ← Excludes .clasprc.json (OAuth token)
└── README.md        ← You are here
```

---

## Initial Setup

### 1 · Create the Apps Script project

**Option A — via clasp (recommended)**

```bash
cd form-generator
clasp create --title "SOA Form Generator" --type webapp
# .clasp.json is updated with the new scriptId
```

**Option B — via browser**

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Note the script ID from the URL: `https://script.google.com/d/{SCRIPT_ID}/edit`
3. Paste it into `.clasp.json`:
   ```json
   { "scriptId": "YOUR_SCRIPT_ID_HERE", "rootDir": "." }
   ```

### 2 · Push code

```bash
clasp push
```

### 3 · Set Script Properties

In the Apps Script editor: **Project Settings → Script properties → Add property**

| Property | Value | Notes |
|---|---|---|
| `SHEET_ID` | `1abc...xyz` | ID from the spreadsheet URL |
| `SHEET_TAB` | `Applications` | Tab name (default if omitted: `Applications`) |
| `TEMPLATE_DOC_ID` | `1def...uvw` | ID from the Google Doc template URL |
| `DRIVE_FOLDER_ID` | `1ghi...rst` | ID of the Drive folder containing images |
| `APP_USERNAME` | your chosen username | Overrides the default in Code.gs |
| `APP_PASSWORD` | your chosen password | Overrides the default in Code.gs |

> **Tip:** The ID for any Google Drive item is the long alphanumeric string in its URL, e.g.  
> `https://drive.google.com/drive/folders/`**`1ghi...rst`**

### 4 · Deploy as Web App

In the Apps Script editor:
1. **Deploy → New deployment**
2. Type: **Web app**
3. Description: `v1` (or any label)
4. Execute as: **Me**
5. Who has access: **Anyone with a Google account**
6. Click **Deploy** — copy the Web App URL

### 5 · Update without changing the URL

To push code changes without generating a new URL:
1. `clasp push` to upload the latest code
2. In the Apps Script editor: **Deploy → Manage deployments**
3. Click the pencil (edit) icon on your existing deployment
4. Change the version to **New version**
5. Click **Deploy** — the same URL now serves the updated code

---

## Google Doc Template Setup

### Image placeholders

Place these in a **dedicated paragraph or table cell** (nothing else in the cell). The backend replaces the placeholder with the actual image, scaled to fit. If no matching file is found in Drive, the placeholder is removed silently.

| Placeholder | Content | Max dimensions |
|---|---|---|
| `{{img_passport_photo}}` | Profile / passport photo | 400 × 500 px |
| `{{img_qual_photocopy}}` | Qualification document scan | 800 × 600 px |
| `{{img_payment_proof}}` | Payment receipt / screenshot | 800 × 600 px |
| `{{img_proposer_sig}}` | Proposer's drawn signature | 400 × 150 px |
| `{{img_seconder_sig}}` | Seconder's drawn signature | 400 × 150 px |
| `{{img_agreement_sig}}` | Applicant's agreement signature | 400 × 150 px |

### Text placeholders

Insert `{{FieldName}}` anywhere in the document body, headers, footers, or table cells. The field name must exactly match a column header in the Google Sheet (case-sensitive). Blank fields are replaced with `-`.

| Placeholder | Content |
|---|---|
| `{{SignUpID}}` | Unique application ID (e.g. `20261604-143022`) |
| `{{SubmittedAt}}` | Submission timestamp |
| `{{FullName_EN}}` | Full name in English |
| `{{FullName_ZH}}` | Full name in Chinese (if provided) |
| `{{DateOfBirth}}` | Date of birth (DD/MM/YYYY) |
| `{{NRIC}}` | NRIC / FIN number |
| `{{Citizenship}}` | Citizenship (e.g. `Singaporean`) |
| `{{Email}}` | Email address |
| `{{OOB_Number}}` | Optometry Board registration number |
| `{{IsPracticing}}` | `Yes` or `No` |
| `{{PracticeName}}` | Practice / clinic name |
| `{{PracticeAddress}}` | Practice street address |
| `{{PracticeCountry}}` | Practice country |
| `{{PracticeTel}}` | Practice telephone |
| `{{ResidenceAddress}}` | Home street address |
| `{{ResidenceCountry}}` | Home country |
| `{{Tel_Home}}` | Home telephone |
| `{{Tel_Mobile}}` | Mobile telephone |
| `{{QualDescription}}` | Qualification held (e.g. `Bachelor of Optometry`) |
| `{{QualDateOfIssue}}` | Date qualification was issued (DD/MM/YYYY) |
| `{{GraduateCourse}}` | Graduate course name |
| `{{GraduateInstitution}}` | Graduate institution name |
| `{{ProfessionalOrgs}}` | Other optometric org memberships (semicolon-separated) |
| `{{RelevantExperience}}` | Relevant experience (free text) |
| `{{OnlineQuestionnaire}}` | `Yes` or `No` |
| `{{MembershipType}}` | Membership tier (e.g. `Ordinary`) |
| `{{EntranceFee_SGD}}` | Entrance fee in SGD |
| `{{MembershipFee_SGD}}` | Annual membership fee in SGD |
| `{{TotalFee_SGD}}` | Total fee in SGD |
| `{{PaymentMethod}}` | `Cheque`, `Bank Transfer`, or `PayNow` |
| `{{ChequeNumber}}` | Cheque number (if applicable) |
| `{{BankTransferRef}}` | Bank transfer reference (if applicable) |
| `{{PayNowRef}}` | PayNow reference (if applicable) |
| `{{ProposerName}}` | Proposer's full name |
| `{{ProposerIsSOAMember}}` | `Yes` or `No` |
| `{{SeconderName}}` | Seconder's full name |
| `{{SeconderIsSOAMember}}` | `Yes` or `No` |
| `{{File_PassportPhoto}}` | Drive URL of passport photo |
| `{{File_QualificationPhotocopy}}` | Drive URL of qualification photocopy |
| `{{File_PaymentProof}}` | Drive URL of payment proof |
| `{{File_DeclarationSignature}}` | Drive URL of declaration signature |
| `{{File_ProposerSignature}}` | Drive URL of proposer signature |
| `{{File_SeconderSignature}}` | Drive URL of seconder signature |
| `{{File_AgreementSignature}}` | Drive URL of agreement signature |

---

## Drive Folder — Image Naming Convention

Files must be named using the following convention:

```
{ApplicationID}_{suffix}.{ext}
```

- **ApplicationID** — the unique application ID (e.g. `20261604-143022`)
- **suffix** — one of the values below (case-sensitive)
- **ext** — `.png`, `.jpg`, or `.jpeg` (generator tries all three)

| Suffix | Content | Dimension cap |
|---|---|---|
| `passport_photo` | Profile / passport photo | 400 × 500 px |
| `qualification_photocopy` | Qualification document scan | 800 × 600 px |
| `payment_proof` | Payment receipt / screenshot | 800 × 600 px |
| `proposer_signature` | Proposer's drawn signature | 400 × 150 px |
| `seconder_signature` | Seconder's drawn signature | 400 × 150 px |
| `agreement_signature` | Applicant's agreement signature | 400 × 150 px |

**Example** (ApplicationID: `20261604-143022`):
```
20261604-143022_passport_photo.png
20261604-143022_qualification_photocopy.png
20261604-143022_payment_proof.png
20261604-143022_proposer_signature.png
20261604-143022_seconder_signature.png
20261604-143022_agreement_signature.png
```

Images are never upscaled — only downscaled if they exceed the dimension cap.

---

## Clasp Workflow (ongoing maintenance)

```bash
# Pull latest from Apps Script (if edited in browser)
clasp pull

# Push local changes to Apps Script
clasp push

# Open the script in the browser
clasp open

# View execution logs
clasp logs
```

**Keeping GitHub in sync:**

```bash
# After clasp pull (if browser edits were made)
git add Code.gs Index.html appsscript.json
git commit -m "sync from Apps Script editor"
git push

# After local edits
clasp push
git add Code.gs Index.html appsscript.json
git commit -m "your message"
git push
```

> `.clasprc.json` (your OAuth token) is excluded by `.gitignore` — never commit it.

---

## Required OAuth Scopes

Declared in `appsscript.json`:

| Scope | Used for |
|---|---|
| `spreadsheets.readonly` | Reading records from the Google Sheet |
| `drive` | Copying/trashing the Doc template, reading Drive images |
| `documents` | Editing the temporary Doc copy (text + image replacements) |
| `script.external_request` | Reserved for future use (no external calls currently made) |

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "SHEET_ID not set" | Script Properties not configured (step 3 above) |
| Record dropdown empty | Sheet tab name mismatch — check `SHEET_TAB` property |
| Image slot not replaced | File not found in Drive folder — verify naming convention |
| PDF blank / wrong data | Template placeholder typo — names are case-sensitive |
| 403 on Web App URL | Deployment set to "Only myself" — change to "Anyone with Google account" |
