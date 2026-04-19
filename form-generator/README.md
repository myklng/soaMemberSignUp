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

### Text placeholders

Insert `{{FieldName}}` anywhere in the document body, headers, footers, or table cells. The field name must exactly match a column header in the Google Sheet (case-sensitive).

**Example — columns from the Applications sheet:**

```
Applicant Name: {{FullName_EN}}
NRIC / FIN:     {{NRIC}}
Date of Birth:  {{DateOfBirth}}
Email:          {{Email}}
Membership Type: {{MembershipType}}
Submitted:      {{SubmittedAt}}
```

All `{{placeholder}}` tokens not matched to a sheet column are left as-is (not removed).

### Image slots

Create image slots by typing one of the following placeholder strings into a **dedicated paragraph or table cell** (the cell or paragraph should contain only the placeholder):

| Placeholder | Matching Drive file suffix | Max dimensions |
|---|---|---|
| `{{img_passport_photo}}` | `_passport_photo` | 400 × 500 px |
| `{{img_qual_photocopy}}` | `_qualification_photocopy` | 800 × 600 px |
| `{{img_payment_proof}}` | `_payment_proof` | 800 × 600 px |
| `{{img_proposer_sig}}` | `_proposer_signature` | 400 × 150 px |
| `{{img_seconder_sig}}` | `_seconder_signature` | 400 × 150 px |
| `{{img_agreement_sig}}` | `_agreement_signature` | 400 × 150 px |

The backend clears that paragraph/cell and inserts the image, scaled down to fit the constraints while preserving aspect ratio. If no matching file is found in Drive, the placeholder is removed silently.

---

## Drive Folder — Image Naming Convention

The generator reads files directly from the Drive folder that the membership signup form already writes to. **No renaming needed** — file names follow the same convention used during signup:

```
{SignUpID}_{Initials}_{suffix}.{ext}
```

- **SignUpID** — the application ID (e.g. `20261604-143022`)
- **Initials** — first letter of each word in the applicant's English full name, uppercase (e.g. `John Smith Tan` → `JST`)
- **suffix** — one of the values below
- **ext** — `.png` or `.jpg` depending on what was originally uploaded (the generator tries `.png` first, then `.jpg`)

| Suffix | Content | Dimension cap |
|---|---|---|
| `passport_photo` | Profile / passport photo | 400 × 500 px |
| `qualification_photocopy` | Qualification document scan | 800 × 600 px |
| `payment_proof` | Payment receipt / screenshot | 800 × 600 px |
| `proposer_signature` | Proposer's drawn signature | 400 × 150 px |
| `seconder_signature` | Seconder's drawn signature | 400 × 150 px |
| `agreement_signature` | Applicant's agreement signature | 400 × 150 px |

**Example** (applicant: John Smith Tan, SignUpID: `20261604-143022`):
```
20261604-143022_JST_passport_photo.png
20261604-143022_JST_qualification_photocopy.png
20261604-143022_JST_payment_proof.png
20261604-143022_JST_proposer_signature.png
20261604-143022_JST_seconder_signature.png
20261604-143022_JST_agreement_signature.png
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
