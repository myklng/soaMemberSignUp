/**
 * SOA Singapore — Application Form Generator
 * ===========================================
 * Google Apps Script Web App
 *
 * Before deploying, set the following Script Properties
 * (Project Settings → Script properties → Add property):
 *
 *   SHEET_ID         — Google Spreadsheet ID
 *   SHEET_TAB        — Tab name to read records from  (default: Applications)
 *   TEMPLATE_DOC_ID  — Google Doc template ID
 *   DRIVE_FOLDER_ID  — Drive folder containing uploaded images
 *   APP_USERNAME     — Web-app login username
 *   APP_PASSWORD     — Web-app login password
 *
 * Deploy as Web App:
 *   Execute as : Me
 *   Who has access : Anyone with Google Account
 */

const VERSION = 'v1.1.2';

// ─── Default credentials (override via Script Properties) ────────────────────
// Change these before first deploy, or set APP_USERNAME / APP_PASSWORD in
// Project Settings → Script properties instead.
const DEFAULT_USERNAME = 'soaadmin';
const DEFAULT_PASSWORD = 'changeme';

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('SOA Form Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getVersion() {
  return VERSION;
}

/**
 * Lists Drive files whose names contain `recordId`, and shows the expected
 * search prefix. Used for debugging image-not-found issues.
 * Returns { prefix, found: ['filename', ...], searched: ['baseName', ...] }
 */
function debugImages(recordId) {
  const props    = PropertiesService.getScriptProperties();
  const sheetId  = props.getProperty('SHEET_ID');
  const tabName  = props.getProperty('SHEET_TAB') || 'Applications';
  const folderId = props.getProperty('DRIVE_FOLDER_ID');

  const ss      = SpreadsheetApp.openById(sheetId);
  const sheet   = ss.getSheetByName(tabName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  let   record  = null;
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });
    if (String(row['SignUpID']) === String(recordId)) { record = row; break; }
  }
  if (!record) return { error: 'Record not found' };

  const folder = DriveApp.getFolderById(folderId);
  const iter   = folder.getFiles();
  const found  = [];
  while (iter.hasNext()) {
    const name = iter.next().getName();
    if (name.indexOf(recordId) !== -1) found.push(name);
  }

  const suffixes = ['passport_photo', 'qualification_photocopy', 'payment_proof',
                    'proposer_signature', 'seconder_signature', 'agreement_signature'];
  const searched = suffixes.map(function (s) { return recordId + '_' + s + ' (.png/.jpg/.jpeg)'; });

  return { prefix: recordId, searched: searched, found: found };
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates the supplied credentials against Script Properties (or defaults).
 * Returns { success: true } or { success: false, error: '...' }.
 */
function login(username, password) {
  const props    = PropertiesService.getScriptProperties();
  const validUser = props.getProperty('APP_USERNAME') || DEFAULT_USERNAME;
  const validPass = props.getProperty('APP_PASSWORD') || DEFAULT_PASSWORD;

  if (username === validUser && password === validPass) {
    return { success: true };
  }
  return { success: false, error: 'Invalid username or password.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Record list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads all data rows from the configured sheet tab.
 * Returns an array of { id, label } objects for the frontend dropdown.
 * id    = value of the SignUpID column (or row index if absent)
 * label = "SignUpID — FullName_EN  (SubmittedAt)"
 */
function getRecords() {
  const props   = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  const tabName = props.getProperty('SHEET_TAB') || 'Applications';

  if (!sheetId) throw new Error('SHEET_ID not set in Script Properties.');

  const ss    = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error(`Sheet tab "${tabName}" not found.`);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(String);
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });

    const id   = String(row['SignUpID'] || i);
    const name = row['FullName_EN'] || '(unnamed)';
    const date = row['SubmittedAt']
      ? new Date(row['SubmittedAt']).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    records.push({
      id,
      label: `${id} — ${name}${date ? '  ·  ' + date : ''}`,
    });
  }

  return records;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full pipeline:
 *   1. Fetch the record row from the Sheet
 *   2. Copy the Doc template
 *   3. Replace {{field_name}} text placeholders
 *   4. Replace {{img_*}} image slots with Drive images
 *   5. Export the copy as PDF (base64)
 *   6. Trash the temporary copy
 *
 * Returns { success: true, base64: '...', filename: '...' }
 *      or { success: false, error: '...' }
 */
/**
 * prevFileId — optional Drive file ID of the previous generated PDF to trash
 *              before generating the new one (cleanup from prior call).
 */
function generatePDF(recordId, prevFileId) {
  const props      = PropertiesService.getScriptProperties();
  const sheetId    = props.getProperty('SHEET_ID');
  const tabName    = props.getProperty('SHEET_TAB') || 'Applications';
  const templateId = props.getProperty('TEMPLATE_DOC_ID');
  const folderId   = props.getProperty('DRIVE_FOLDER_ID');

  if (!sheetId)    throw new Error('SHEET_ID not set in Script Properties.');
  if (!templateId) throw new Error('TEMPLATE_DOC_ID not set in Script Properties.');
  if (!folderId)   throw new Error('DRIVE_FOLDER_ID not set in Script Properties.');

  // Trash the previous generated PDF (from prior frontend call) ──────────────
  if (prevFileId) {
    try { DriveApp.getFileById(prevFileId).setTrashed(true); } catch (_) {}
  }

  // 1. Locate the record ─────────────────────────────────────────────────────
  const ss     = SpreadsheetApp.openById(sheetId);
  const sheet  = ss.getSheetByName(tabName);
  if (!sheet) throw new Error(`Sheet tab "${tabName}" not found.`);

  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  let   record  = null;

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });
    if (String(row['SignUpID']) === String(recordId)) { record = row; break; }
  }
  if (!record) throw new Error(`Record "${recordId}" not found in sheet.`);

  // 2. Copy template ──────────────────────────────────────────────────────────
  const filename = `SOA_Application_${recordId}.pdf`;
  const tempName = `_SOA_temp_${recordId}_${Date.now()}`;
  const tempFile = DriveApp.getFileById(templateId).makeCopy(tempName);
  const docId    = tempFile.getId();
  let   pdfFileId = null;

  try {
    const doc  = DocumentApp.openById(docId);
    const body = doc.getBody();

    // 3. Replace {{img_*}} slots first (must happen before text replacements) ─
    const folder = DriveApp.getFolderById(folderId);

    // File naming: {recordId}_{suffix}.{ext}
    // getFileBlob_() tries .png, .jpg, .jpeg in order.
    const imageSlots = [
      { placeholder: '{{img_passport_photo}}',  base: recordId + '_passport_photo',         maxW: 400, maxH: 500 },
      { placeholder: '{{img_qual_photocopy}}',  base: recordId + '_qualification_photocopy', maxW: 800, maxH: 600 },
      { placeholder: '{{img_payment_proof}}',   base: recordId + '_payment_proof',           maxW: 800, maxH: 600 },
      { placeholder: '{{img_proposer_sig}}',    base: recordId + '_proposer_signature',      maxW: 400, maxH: 150 },
      { placeholder: '{{img_seconder_sig}}',    base: recordId + '_seconder_signature',      maxW: 400, maxH: 150 },
      { placeholder: '{{img_agreement_sig}}',   base: recordId + '_agreement_signature',     maxW: 400, maxH: 150 },
    ];

    imageSlots.forEach(slot => {
      const blob = getFileBlob_(folder, slot.base);
      replaceSlotWithImage_(body, slot.placeholder, blob, slot.maxW, slot.maxH);
    });

    // 4. Replace {{field_name}} text placeholders ───────────────────────────
    headers.forEach(h => {
      const raw = record[h];
      let   val = '';
      if (raw instanceof Date) {
        val = Utilities.formatDate(raw, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      } else if (raw !== null && raw !== undefined) {
        val = String(raw);
      }
      // Apps Script replaceText uses Java regex; escape curly braces
      body.replaceText(`\\{\\{${escapeForRegex_(h)}\\}\\}`, val || '-');
    });

    // 5. Export as PDF and save to Drive ──────────────────────────────────────
    doc.saveAndClose();
    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    pdfBlob.setName(filename);
    const pdfFile = folder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfFileId = pdfFile.getId();

    return {
      success:  true,
      fileId:   pdfFileId,
      filename,
    };

  } catch (err) {
    // If PDF was saved but something else failed, clean it up
    if (pdfFileId) {
      try { DriveApp.getFileById(pdfFileId).setTrashed(true); } catch (_) {}
    }
    throw err;

  } finally {
    // Always trash the temporary Doc copy ─────────────────────────────────────
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the initials of a full name — first letter of each word, uppercase.
 * Mirrors getInitials_() in the membership signup Apps Script.
 * e.g. "John Smith Tan" → "JST"
 */
function getInitials_(name) {
  return (name || '').trim().split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase()).join('');
}

/**
 * Finds a file in `folder` whose name matches `baseName` + ".png" or ".jpg"
 * (tries .png first — signatures are always PNG; photo uploads may be either).
 * Returns a Blob, or null if no matching file is found.
 */
function getFileBlob_(folder, baseName) {
  try {
    for (const ext of ['.png', '.jpg', '.jpeg']) {
      const iter = folder.getFilesByName(baseName + ext);
      if (iter.hasNext()) {
        Logger.log('Found: ' + baseName + ext);
        return iter.next().getBlob();
      }
    }
    Logger.log('Not found: ' + baseName + ' (.png/.jpg/.jpeg)');
    return null;
  } catch (err) {
    Logger.log('Error searching for ' + baseName + ': ' + err.message);
    return null;
  }
}

/**
 * Finds the paragraph or table cell in `body` containing `placeholder`,
 * clears it, and inserts `imageBlob` scaled to fit within maxW × maxH.
 * If no image blob is provided, the placeholder is simply removed.
 * If the placeholder is not found at all, this is a no-op.
 */
function replaceSlotWithImage_(body, placeholder, imageBlob, maxW, maxH) {
  // Search top-level paragraphs
  const paras = body.getParagraphs();
  for (let i = 0; i < paras.length; i++) {
    const para = paras[i];
    if (para.getText().indexOf(placeholder) !== -1) {
      para.clear();
      if (imageBlob) {
        const img = para.insertInlineImage(0, imageBlob);
        scaleInlineImage_(img, maxW, maxH);
      }
      return;
    }
  }

  // Search table cells
  const tables = body.getTables();
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        if (cell.getText().indexOf(placeholder) !== -1) {
          cell.clear();
          if (imageBlob) {
            const para = cell.appendParagraph('');
            const img  = para.insertInlineImage(0, imageBlob);
            scaleInlineImage_(img, maxW, maxH);
          }
          return;
        }
      }
    }
  }

  // Placeholder not found — remove via replaceText as a safety net
  body.replaceText(escapeForRegex_(placeholder).replace(/\{/g, '\\{').replace(/\}/g, '\\}'), '');
}

/**
 * Scales an InlineImage to fit within maxW × maxH, preserving aspect ratio.
 * Never upscales beyond the image's natural dimensions.
 */
function scaleInlineImage_(img, maxW, maxH) {
  const w     = img.getWidth();
  const h     = img.getHeight();
  const scale = Math.min(maxW / w, maxH / h, 1);
  img.setWidth(Math.round(w * scale));
  img.setHeight(Math.round(h * scale));
}

/**
 * Escapes a string for use in an Apps Script replaceText() regex pattern.
 * (Apps Script V8 uses JavaScript regex under the hood.)
 */
function escapeForRegex_(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
