import type { ApplicationFormInput, ApplicationStatus, StatusLookup, WorkshopSettings } from '../types';

export const FIELD_LIMITS = {
  title: 120,
  subtitle: 160,
  termLabel: 60,
  workshopDate: 80,
  sessionsSummary: 120,
  location: 160,
  ageGroup: 80,
  announcementNote: 600,
  contactEmail: 120,
  contactPhone: 40,
  phoneDisplay: 25,
  parentFullName: 100,
  parentDisplayName: 80,
  studentFullName: 100,
  studentFirstName: 60,
  gradeLevel: 50,
  sessionLabel: 120,
  notes: 500,
} as const;

export function sanitizeField(value: string, maxLen: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/**
 * Normalizes Turkish GSM and standard phone numbers to digits-only format.
 * Examples:
 *  "0532 111 22 33" -> "5321112233"
 *  "+90 (532) 111-22-33" -> "5321112233"
 *  "5321112233" -> "5321112233"
 */
export function normalizeTurkishPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('0090') && digits.length >= 14) {
    digits = digits.slice(4);
  } else if (digits.startsWith('90') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (!/^[0-9]{10,15}$/.test(digits)) {
    return null;
  }

  return digits;
}

export function formatTurkishPhone(normalized: string): string {
  if (normalized.length === 10 && normalized.startsWith('5')) {
    return `0${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 8)} ${normalized.slice(8, 10)}`;
  }
  if (normalized.length === 10) {
    return `0${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 10)}`;
  }
  return `+${normalized}`;
}

export function formatPhoneAsTyping(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0090') && digits.length > 10) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('90') && digits.length > 10) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('5')) {
    digits = '0' + digits;
  }
  digits = digits.slice(0, 11);

  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (digits.length <= 9) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
}

/**
 * Computes lowercase 64-character SHA-256 hex digest of a normalized phone string.
 */
export async function hashPhone(normalized: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Masks parent surname for public privacy-preserving announcement display.
 * Example: "Ayşe Yılmaz" -> "Ayşe Y."
 */
export function maskParentName(fullName: string): string {
  const cleaned = sanitizeField(fullName, FIELD_LIMITS.parentFullName);
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 0) return 'Veli';
  if (parts.length === 1) return parts[0].slice(0, FIELD_LIMITS.parentDisplayName);
  const last = parts[parts.length - 1];
  const firstNames = parts.slice(0, -1).join(' ');
  const initial = last.charAt(0).toLocaleUpperCase('tr-TR');
  return `${firstNames} ${initial}.`.slice(0, FIELD_LIMITS.parentDisplayName);
}

/**
 * Extracts student first name(s) without surname for public lookup privacy.
 */
export function extractStudentFirstName(fullName: string): string {
  const cleaned = sanitizeField(fullName, FIELD_LIMITS.studentFullName);
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 0) return 'Öğrenci';
  if (parts.length === 1) return parts[0].slice(0, FIELD_LIMITS.studentFirstName);
  return parts.slice(0, -1).join(' ').slice(0, FIELD_LIMITS.studentFirstName);
}

export interface ParsedImportRow {
  rowNumber: number;
  valid: boolean;
  error?: string;
  input: ApplicationFormInput;
  phoneNormalized: string | null;
}

function parseStatusToken(raw: string): ApplicationStatus {
  const normalized = raw.trim().toLocaleLowerCase('tr-TR');
  if (
    normalized.includes('onay') ||
    normalized.includes('kabul') ||
    normalized.includes('kesin') ||
    normalized === 'approved' ||
    normalized === 'evet'
  ) {
    return 'approved';
  }
  if (normalized.includes('yedek') || normalized === 'waitlist') {
    return 'waitlist';
  }
  if (
    normalized.includes('red') ||
    normalized.includes('olumsuz') ||
    normalized.includes('dolu') ||
    normalized.includes('iptal') ||
    normalized === 'rejected'
  ) {
    return 'rejected';
  }
  return 'pending';
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Parses CSV or TSV (Excel / Google Forms copy-paste) rows into ApplicationFormInput entries.
 */
export function parseBulkImportText(
  rawText: string,
  defaults: { workshopDate: string; location: string; sessionLabel: string }
): ParsedImportRow[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Detect delimiter from first line
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount >= semiCount && tabCount >= commaCount && tabCount > 0
    ? '\t'
    : semiCount >= commaCount && semiCount > 0
      ? ';'
      : ',';

  const firstCells = splitDelimitedLine(firstLine, delimiter).map((c) =>
    c.toLocaleLowerCase('tr-TR')
  );

  // Check if first row looks like headers
  const hasHeader = firstCells.some(
    (cell) =>
      cell.includes('telefon') ||
      cell.includes('gsm') ||
      cell.includes('veli') ||
      cell.includes('ad') ||
      cell.includes('phone') ||
      cell.includes('öğrenci') ||
      cell.includes('ogrenci')
  );

  let colParent = 0;
  let colPhone = 1;
  let colStudent = 2;
  let colGrade = 3;
  let colStatus = 4;
  let colSession = 5;
  let colNotes = 6;
  let colWaitlist = -1;

  if (hasHeader) {
    colParent = firstCells.findIndex((c) => c.includes('veli') || c.includes('parent') || c === 'ad soyad');
    colPhone = firstCells.findIndex((c) => c.includes('telefon') || c.includes('gsm') || c.includes('tel') || c.includes('phone'));
    colStudent = firstCells.findIndex((c) => c.includes('öğrenci') || c.includes('ogrenci') || c.includes('çocuk') || c.includes('cocuk') || c.includes('student'));
    colGrade = firstCells.findIndex((c) => c.includes('sınıf') || c.includes('sinif') || c.includes('yaş') || c.includes('yas') || c.includes('grade'));
    colStatus = firstCells.findIndex((c) => c.includes('durum') || c.includes('sonuç') || c.includes('sonuc') || c.includes('status'));
    colSession = firstCells.findIndex((c) => c.includes('oturum') || c.includes('saat') || c.includes('grup') || c.includes('session'));
    colNotes = firstCells.findIndex((c) => c.includes('not') || c.includes('açıklama') || c.includes('aciklama') || c.includes('note'));
    colWaitlist = firstCells.findIndex((c) => c.includes('sıra') || c.includes('sira') || c.includes('yedek'));

    if (colParent === -1) colParent = 0;
    if (colPhone === -1) colPhone = 1;
    if (colStudent === -1) colStudent = 2;
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const cells = splitDelimitedLine(line, delimiter);
    const rowNumber = hasHeader ? index + 2 : index + 1;

    const rawParent = colParent >= 0 ? (cells[colParent] ?? '') : '';
    const rawPhone = colPhone >= 0 ? (cells[colPhone] ?? '') : '';
    const rawStudent = colStudent >= 0 ? (cells[colStudent] ?? '') : '';
    const rawGrade = colGrade >= 0 ? (cells[colGrade] ?? '') : '';
    const rawStatus = colStatus >= 0 ? (cells[colStatus] ?? '') : '';
    const rawSession = colSession >= 0 ? (cells[colSession] ?? '') : '';
    const rawNotes = colNotes >= 0 ? (cells[colNotes] ?? '') : '';
    const rawWaitlist = colWaitlist >= 0 ? (cells[colWaitlist] ?? '') : '';

    const phoneNormalized = normalizeTurkishPhone(rawPhone);
    const parentFullName = sanitizeField(rawParent, FIELD_LIMITS.parentFullName);
    const studentFullName = sanitizeField(rawStudent || parentFullName, FIELD_LIMITS.studentFullName);
    const status = rawStatus ? parseStatusToken(rawStatus) : 'pending';
    const parsedWaitlist = parseInt(rawWaitlist.replace(/\D/g, ''), 10);
    const waitlistOrder =
      status === 'waitlist' && Number.isFinite(parsedWaitlist) && parsedWaitlist > 0
        ? Math.min(parsedWaitlist, 999)
        : 0;

    let error: string | undefined;
    if (!phoneNormalized) {
      error = 'Geçersiz telefon numarası';
    } else if (parentFullName.length < 2) {
      error = 'Veli adı eksik';
    }

    return {
      rowNumber,
      valid: !error,
      error,
      phoneNormalized,
      input: {
        phone: rawPhone,
        parentFullName,
        studentFullName: studentFullName || 'Öğrenci',
        gradeLevel: sanitizeField(rawGrade, FIELD_LIMITS.gradeLevel),
        status,
        waitlistOrder,
        sessionLabel: sanitizeField(rawSession || defaults.sessionLabel, FIELD_LIMITS.sessionLabel),
        workshopDate: sanitizeField(defaults.workshopDate, FIELD_LIMITS.workshopDate),
        location: sanitizeField(defaults.location, FIELD_LIMITS.location),
        notes: sanitizeField(rawNotes, FIELD_LIMITS.notes),
      },
    };
  });
}

export function downloadWorkshopCalendarIcs(lookup: StatusLookup, settings: WorkshopSettings): void {
  const escapeIcs = (str: string) =>
    str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const summary = escapeIcs(settings.title || 'Aile Atölyeleri ile Matematiği Birlikte İnşa Edelim');
  const location = escapeIcs(lookup.location || settings.location || '');
  const description = escapeIcs(
    [
      lookup.notes || '',
      settings.advisorName ? `Danışman: ${settings.advisorName}` : '',
      lookup.parentDisplayName ? `Veli: ${lookup.parentDisplayName}` : '',
      lookup.studentFirstName
        ? `Öğrenci: ${lookup.studentFirstName}${lookup.gradeLevel ? ` (${lookup.gradeLevel})` : ''}`
        : '',
      lookup.sessionLabel ? `Saat: ${lookup.sessionLabel}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Elazig BILSEM Matematik Atolyesi//TR',
    'BEGIN:VEVENT',
    `UID:${lookup.phoneHash.slice(0, 16)}@elazig-bilsem-atolye`,
    `DTSTAMP:${stamp}`,
    'DTSTART:20261127T150000',
    'DTEND:20261127T162000',
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'elazig-bilsem-matematik-atolyesi.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
