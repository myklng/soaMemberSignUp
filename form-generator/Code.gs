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

const VERSION = 'v1.1.9';

// ─── Image size limits — edit values in centimetres ──────────────────────────
// Maximum width / height an image is scaled down to fit. Never upscaled.
// 1 cm ≈ 28.35 pts (Google Docs internal unit used by InlineImage.setWidth).
const IMG_LIMITS = {
  passport_photo:          { w: 3.5, h: 4.5 },
  qualification_photocopy: { w: 14,  h: 10  },
  payment_proof:           { w: 14,  h: 10  },
  proposer_signature:      { w: 6,   h: 2.5 },
  seconder_signature:      { w: 6,   h: 2.5 },
  agreement_signature:     { w: 6,   h: 2.5 },
};
// ─────────────────────────────────────────────────────────────────────────────

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
    // Size limits are defined in IMG_LIMITS (cm) at the top of this file.
    var CM = 72 / 2.54; // Google Docs pts per cm (setWidth/setHeight use pts)
    var L  = IMG_LIMITS;
    var imageSlots = [
      { placeholder: '{{img_passport_photo}}',  base: recordId + '_passport_photo',          maxW: L.passport_photo.w          * CM, maxH: L.passport_photo.h          * CM },
      { placeholder: '{{img_qual_photocopy}}',  base: recordId + '_qualification_photocopy', maxW: L.qualification_photocopy.w  * CM, maxH: L.qualification_photocopy.h  * CM },
      { placeholder: '{{img_payment_proof}}',   base: recordId + '_payment_proof',           maxW: L.payment_proof.w            * CM, maxH: L.payment_proof.h            * CM },
      { placeholder: '{{img_proposer_sig}}',    base: recordId + '_proposer_signature',      maxW: L.proposer_signature.w       * CM, maxH: L.proposer_signature.h       * CM },
      { placeholder: '{{img_seconder_sig}}',    base: recordId + '_seconder_signature',      maxW: L.seconder_signature.w       * CM, maxH: L.seconder_signature.h       * CM },
      { placeholder: '{{img_agreement_sig}}',   base: recordId + '_agreement_signature',     maxW: L.agreement_signature.w      * CM, maxH: L.agreement_signature.h      * CM },
    ];

    imageSlots.forEach(slot => {
      const blob = getFileBlob_(folder, slot.base);
      replaceSlotWithImage_(doc, slot.placeholder, blob, slot.maxW, slot.maxH);
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
 * Entry point: searches body, header, and footer of `doc` for `placeholder`
 * using explicit element traversal (getText().indexOf) rather than regex,
 * so it works even when the placeholder spans multiple text runs or uses
 * smart-quote variants of curly braces.
 */
function replaceSlotWithImage_(doc, placeholder, imageBlob, maxW, maxH) {
  var sections = [doc.getBody()];
  try { var hdr = doc.getHeader(); if (hdr) sections.push(hdr); } catch (_) {}
  try { var ftr = doc.getFooter(); if (ftr) sections.push(ftr); } catch (_) {}
  for (var si = 0; si < sections.length; si++) {
    replaceInContainer_(sections[si], placeholder, imageBlob, maxW, maxH);
  }
}

/**
 * Walks direct children of a section/container (body, header, footer).
 * Handles PARAGRAPH, LIST_ITEM, and TABLE children.
 */
function replaceInContainer_(container, placeholder, imageBlob, maxW, maxH) {
  var n = container.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = container.getChild(i);
    var type  = child.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH ||
        type === DocumentApp.ElementType.LIST_ITEM) {
      if (child.getText().indexOf(placeholder) !== -1) {
        var parent = child.getParent();
        if (parent.getType() === DocumentApp.ElementType.TABLE_CELL) {
          var cell = parent.asTableCell();
          cell.clear();
          if (imageBlob) {
            var np  = cell.appendParagraph('');
            var img = np.insertInlineImage(0, imageBlob);
            scaleInlineImage_(img, imageBlob, maxW, maxH);
          }
        } else {
          child.clear();
          if (imageBlob) {
            var img2 = child.insertInlineImage(0, imageBlob);
            scaleInlineImage_(img2, imageBlob, maxW, maxH);
          }
        }
        // continue — don't return, there may be more instances
      }
    } else if (type === DocumentApp.ElementType.TABLE) {
      replaceInTable_(child.asTable(), placeholder, imageBlob, maxW, maxH);
    }
  }
}

/**
 * Walks all rows → cells → paragraphs of a table, including nested tables.
 */
function replaceInTable_(table, placeholder, imageBlob, maxW, maxH) {
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    for (var c = 0; c < row.getNumCells(); c++) {
      var cell = row.getCell(c);
      var cn   = cell.getNumChildren();
      var matched = false;
      for (var p = 0; p < cn; p++) {
        var child = cell.getChild(p);
        var type  = child.getType();
        if (type === DocumentApp.ElementType.TABLE) {
          replaceInTable_(child.asTable(), placeholder, imageBlob, maxW, maxH);
          continue;
        }
        if ((type === DocumentApp.ElementType.PARAGRAPH ||
             type === DocumentApp.ElementType.LIST_ITEM) &&
            child.getText().indexOf(placeholder) !== -1) {
          matched = true;
          break; // stop scanning this cell's children — cell.clear() below invalidates them
        }
      }
      if (matched) {
        cell.clear();
        if (imageBlob) {
          var np  = cell.appendParagraph('');
          var img = np.insertInlineImage(0, imageBlob);
          scaleInlineImage_(img, imageBlob, maxW, maxH);
        }
      }
    }
  }
}


/**
 * Scales an InlineImage to fit within maxW × maxH, preserving aspect ratio.
 * Reads natural dimensions from the blob binary header (PNG/JPEG) to avoid
 * using the rendered size that Google Docs may have auto-distorted on insert.
 * Falls back to img.getWidth/getHeight if header parsing fails.
 */
function scaleInlineImage_(img, blob, maxW, maxH) {
  const dims = getImageDimensions_(blob);
  const w    = dims ? dims.w : img.getWidth();
  const h    = dims ? dims.h : img.getHeight();
  if (!w || !h) return;
  const scale = Math.min(maxW / w, maxH / h);
  img.setWidth(Math.round(w * scale));
  img.setHeight(Math.round(h * scale));
}

/**
 * Reads natural pixel dimensions from a PNG or JPEG blob's binary header.
 * Returns { w, h } or null if the format is unrecognised.
 */
function getImageDimensions_(blob) {
  if (!blob) return null;
  try {
    const b = blob.getBytes();
    // PNG: signature [137,80,78,71,...]; width at bytes 16-19, height at 20-23
    if ((b[0] & 0xFF) === 137 && (b[1] & 0xFF) === 80 && (b[2] & 0xFF) === 78 && (b[3] & 0xFF) === 71) {
      const w = (((b[16]&0xFF)<<24)|((b[17]&0xFF)<<16)|((b[18]&0xFF)<<8)|(b[19]&0xFF)) >>> 0;
      const h = (((b[20]&0xFF)<<24)|((b[21]&0xFF)<<16)|((b[22]&0xFF)<<8)|(b[23]&0xFF)) >>> 0;
      return { w: w, h: h };
    }
    // JPEG: signature [0xFF,0xD8]; scan for SOF0/SOF1/SOF2 marker
    if ((b[0] & 0xFF) === 0xFF && (b[1] & 0xFF) === 0xD8) {
      let i = 2;
      while (i < b.length - 8) {
        if ((b[i] & 0xFF) !== 0xFF) { i++; continue; }
        const marker = b[i + 1] & 0xFF;
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          const h = ((b[i+5]&0xFF) << 8) | (b[i+6]&0xFF);
          const w = ((b[i+7]&0xFF) << 8) | (b[i+8]&0xFF);
          return { w: w, h: h };
        }
        const segLen = ((b[i+2]&0xFF) << 8) | (b[i+3]&0xFF);
        i += 2 + segLen;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Escapes a string for use in an Apps Script replaceText() regex pattern.
 * (Apps Script V8 uses JavaScript regex under the hood.)
 */
function escapeForRegex_(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
