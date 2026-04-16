/**
 * SOA Singapore — Membership Application · Google Apps Script backend
 * ====================================================================
 * Deploy as Web App:
 *   Execute as : Me
 *   Who has access : Anyone
 *
 * CONFIGURE before deploying — search "TODO:" in this file:
 *   CONFIG.SHEET_ID        — ID of your Google Spreadsheet
 *   CONFIG.SHEET_A         — Tab name for applications (will be created if absent)
 *   CONFIG.SHEET_B         — Tab name containing sponsor / member names (column A)
 *   CONFIG.DRIVE_FOLDER_ID — ID of the Drive folder for uploaded files
 *
 * Endpoints
 *   GET  ?action=getSponsors  → { sponsors: ["Name 1", ...] }
 *   POST <JSON payload>       → { success: true, signUpID: "..." }
 *                               { success: false, error: "..." }
 */

// ─────────────────────────────────────────────────────────────────────────────
// ⚙  CONFIGURATION — TODO: fill in your IDs before deploying
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  SHEET_ID:        'YOUR_GOOGLE_SHEET_ID',         // TODO
  SHEET_A:         'Applications',                  // TODO: match your tab name
  SHEET_B:         'Sponsors',                      // TODO: match your tab name
  DRIVE_FOLDER_ID: 'YOUR_GOOGLE_DRIVE_FOLDER_ID',  // TODO
};

// Sheet A column order (must match appendRow() call below)
const SHEET_HEADERS = [
  'SignUpID', 'SubmittedAt',
  // Personal
  'FullName_EN', 'FullName_ZH', 'DateOfBirth', 'NRIC', 'Citizenship', 'Email', 'OOB_Number',
  // Address
  'IsPracticing',
  'PracticeName', 'PracticeAddress', 'PracticeCountry', 'PracticeTel',
  'ResidenceAddress', 'ResidenceCountry', 'Tel_Home', 'Tel_Mobile',
  // Qualifications
  'QualDescription', 'QualDateOfIssue', 'GraduateCourse', 'GraduateInstitution',
  // Background
  'ProfessionalOrgs', 'RelevantExperience', 'OnlineQuestionnaire',
  // Membership & Payment
  'MembershipType',
  'EntranceFee_SGD', 'MembershipFee_SGD', 'TotalFee_SGD',
  'PaymentMethod', 'ChequeNumber', 'BankTransferRef', 'PayNowRef',
  // Sponsors
  'ProposerName', 'ProposerIsSOAMember',
  'SeconderName', 'SeconderIsSOAMember',
  // File URLs (Drive)
  'File_PassportPhoto',
  'File_QualificationPhotocopy',
  'File_PaymentProof',
  'File_DeclarationSignature',
  'File_ProposerSignature',
  'File_SeconderSignature',
  'File_AgreementSignature',
];

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'getSponsors') {
    return jsonResponse(getSponsors_());
  }

  return jsonResponse({ error: 'Unknown action. Use ?action=getSponsors' });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Empty request body.');
    }

    const data     = JSON.parse(e.postData.contents);
    const signUpID = data.signUpID || generateFallbackID_();

    // 1. Upload files to Drive
    const fileUrls = saveFilesToDrive_(data.files || {}, signUpID);

    // 2. Append row to Sheet A
    appendToSheet_(data, fileUrls, signUpID);

    return jsonResponse({ success: true, signUpID });

  } catch (err) {
    console.error('doPost error:', err.message, err.stack);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sponsor list  (Sheet B, column A, skip header)
// ─────────────────────────────────────────────────────────────────────────────
function getSponsors_() {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_B);
    if (!sheet) return { sponsors: [] };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { sponsors: [] };

    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const sponsors = values
      .map(row => (row[0] || '').toString().trim())
      .filter(Boolean);

    return { sponsors };
  } catch (err) {
    console.error('getSponsors_ error:', err.message);
    return { sponsors: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save base64 files to Google Drive
// Returns { fieldName: driveFileUrl, ... }
// ─────────────────────────────────────────────────────────────────────────────
function saveFilesToDrive_(files, signUpID) {
  const urls = {};

  if (!files || typeof files !== 'object') return urls;

  let folder;
  try {
    folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  } catch (err) {
    console.error('Drive folder not found:', err.message);
    return urls;
  }

  // File field → Drive file name suffix
  const fieldSuffixMap = {
    passport_photo:         'passport_photo',
    qual_photocopy:         'qualification_photocopy',
    payment_proof:          'payment_proof',
    declaration_signature:  'declaration_signature',
    proposer_signature:     'proposer_signature',
    seconder_signature:     'seconder_signature',
    agreement_signature:    'agreement_signature',
  };

  Object.entries(files).forEach(([fieldName, dataUrl]) => {
    if (!dataUrl || typeof dataUrl !== 'string') return;
    try {
      const suffix   = fieldSuffixMap[fieldName] || fieldName;
      const filename = `${signUpID}_${suffix}`;
      const file     = saveDataUrlToDrive_(dataUrl, filename, folder);
      urls[fieldName] = file.getUrl();
    } catch (err) {
      console.error(`Failed to save ${fieldName}:`, err.message);
    }
  });

  return urls;
}

/**
 * Decode a data URL and write it to Drive as a PNG file.
 * The form sends all files as PNG data URLs (PDF.js converts PDFs client-side).
 */
function saveDataUrlToDrive_(dataUrl, filename, folder) {
  // data:[mimeType];base64,[b64data]
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) throw new Error('Invalid data URL format.');

  const header   = dataUrl.slice(0, commaIdx);        // e.g. data:image/png;base64
  const b64data  = dataUrl.slice(commaIdx + 1);

  const mimeMatch = header.match(/data:([^;]+);/);
  const mimeType  = mimeMatch ? mimeMatch[1] : 'image/png';

  // Determine extension
  const extMap = {
    'image/png':  '.png',
    'image/jpeg': '.jpg',
    'image/gif':  '.gif',
    'application/pdf': '.pdf',
  };
  const ext      = extMap[mimeType] || '.png';
  const fullName = filename + ext;

  const decoded  = Utilities.base64Decode(b64data);
  const blob     = Utilities.newBlob(decoded, mimeType, fullName);
  const driveFile = folder.createFile(blob);

  // Make the file accessible to anyone with the link (for Sheet URL column)
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return driveFile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Append row to Sheet A
// ─────────────────────────────────────────────────────────────────────────────
function appendToSheet_(data, fileUrls, signUpID) {
  const ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let   sheet = ss.getSheetByName(CONFIG.SHEET_A);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_A);
  }

  // Auto-create header row on first use
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    // Style header row
    const hdr = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
    hdr.setBackground('#0d7377')
       .setFontColor('#ffffff')
       .setFontWeight('bold')
       .setFontSize(11);
    sheet.setFrozenRows(1);
  }

  const p    = data.personal             || {};
  const addr = data.addresses            || {};
  const prac = addr.practice             || {};
  const res  = addr.residence            || {};
  const qual = data.qualifications       || {};
  const bg   = data.professionalBackground || {};
  const mem  = data.membership           || {};
  const pay  = data.payment              || {};
  const spon = data.sponsors             || {};
  const prop = spon.proposer             || {};
  const sec  = spon.seconder             || {};

  // Serialise professional orgs
  const orgsStr = (bg.organizations || [])
    .map(o => `${o.name}${o.duration ? ' (' + o.duration + ')' : ''}`)
    .join('; ');

  const row = [
    signUpID,
    data.submittedAt || new Date().toISOString(),
    // Personal
    p.fullname_en   || '',
    p.fullname_zh   || '',
    p.dob           || '',
    p.nric          || '',
    p.citizenship   || '',
    p.email         || '',
    p.oob           || '',
    // Address
    addr.isPracticing ? 'Yes' : 'No',
    prac.name       || '',
    prac.address    || '',
    prac.country    || '',
    prac.tel        || '',
    res.address     || '',
    res.country     || '',
    res.tel_home    || '',
    res.tel_mobile  || '',
    // Qualifications
    qual.description          || '',
    qual.date_of_issue        || '',
    qual.graduate_course      || '',
    qual.graduate_institution || '',
    // Background
    orgsStr,
    bg.relevant_experience   || '',
    data.onlineQuestionnaire ? 'Yes' : 'No',
    // Membership & Payment
    mem.type          || '',
    pay.entrance_fee  != null ? pay.entrance_fee  : '',
    pay.membership_fee!= null ? pay.membership_fee : '',
    pay.total         != null ? pay.total         : '',
    pay.method        || '',
    pay.cheque_number || '',
    pay.bank_ref      || '',
    pay.paynow_ref    || '',
    // Sponsors
    prop.name          || '',
    prop.is_soa_member ? 'Yes' : 'No',
    sec.name           || '',
    sec.is_soa_member  ? 'Yes' : 'No',
    // File URLs
    fileUrls.passport_photo        || '',
    fileUrls.qual_photocopy        || '',
    fileUrls.payment_proof         || '',
    fileUrls.declaration_signature || '',
    fileUrls.proposer_signature    || '',
    fileUrls.seconder_signature    || '',
    fileUrls.agreement_signature   || '',
  ];

  sheet.appendRow(row);

  // Auto-resize columns for readability (optional — can be slow on large sheets)
  // sheet.autoResizeColumns(1, SHEET_HEADERS.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Wrap any object as a JSON ContentService response. */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fallback signUpID generator (server-side) in case the form didn't supply one.
 * Format: YYYYDDMM-HHMMSS  (matches form spec — note DD before MM)
 */
function generateFallbackID_() {
  const n  = new Date();
  const YY = n.getFullYear();
  const DD = String(n.getDate()).padStart(2, '0');
  const MM = String(n.getMonth() + 1).padStart(2, '0');
  const HH = String(n.getHours()).padStart(2, '0');
  const mm = String(n.getMinutes()).padStart(2, '0');
  const SS = String(n.getSeconds()).padStart(2, '0');
  return `${YY}${DD}${MM}-${HH}${mm}${SS}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Local test helper (run manually from the Apps Script IDE to smoke-test)
// ─────────────────────────────────────────────────────────────────────────────
function _testPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        signUpID: generateFallbackID_(),
        personal: {
          fullname_en: 'Test Applicant',
          fullname_zh: '',
          dob:         '01/01/1990',
          nric:        'S1234567A',
          citizenship: 'Singaporean',
          email:       'test@example.com',
          oob:         '',
        },
        addresses: {
          isPracticing: false,
          practice:     null,
          residence: {
            address:    '123 Test Street, #01-01',
            country:    'SG',
            tel_home:   '',
            tel_mobile: '+6591234567',
          },
        },
        qualifications: {
          description:          'Bachelor of Optometry',
          date_of_issue:        '01/06/2015',
          graduate_course:      'Optometry',
          graduate_institution: 'Singapore Polytechnic',
        },
        professionalBackground: { organizations: [], relevant_experience: '' },
        onlineQuestionnaire:    false,
        membership:  { type: 'Ordinary' },
        payment: {
          entrance_fee: 100, membership_fee: 0, total: 100,
          method: 'PayNow', paynow_ref: 'TXN123',
        },
        sponsors: {
          proposer: { name: 'Dr. Jane Lim', is_soa_member: true },
          seconder: { name: 'Dr. Kevin Tan', is_soa_member: true },
        },
        declaration: { name: 'Test Applicant' },
        agreement:   { name: 'Test Applicant' },
        files:       {},   // no files in smoke test
        submittedAt: new Date().toISOString(),
      }),
    },
  };

  const result = JSON.parse(doPost(mockEvent).getContent());
  Logger.log('Test result: %s', JSON.stringify(result));
}
