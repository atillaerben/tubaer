import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  DEFAULT_WORKSHOP_SETTINGS,
  type ApplicationFormInput,
  type ApplicationRecord,
  type StatusLookup,
  type WorkshopSettings,
} from '../types';
import {
  extractStudentFirstName,
  FIELD_LIMITS,
  formatTurkishPhone,
  hashPhone,
  maskParentName,
  normalizeTurkishPhone,
  sanitizeField,
} from '../utils/phone';

const SETTINGS_DOC_PATH = 'settings/workshop';
const APPLICATIONS_COLLECTION = 'applications';
const STATUS_LOOKUPS_COLLECTION = 'statusLookups';

export async function fetchWorkshopSettings(): Promise<WorkshopSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'workshop'));
    if (!snap.exists()) {
      return DEFAULT_WORKSHOP_SETTINGS;
    }
    const data = snap.data() as Partial<WorkshopSettings>;
    return {
      ...DEFAULT_WORKSHOP_SETTINGS,
      ...data,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, SETTINGS_DOC_PATH);
  }
}

export async function saveWorkshopSettings(input: WorkshopSettings): Promise<void> {
  const payload = {
    title: sanitizeField(input.title, FIELD_LIMITS.title) || DEFAULT_WORKSHOP_SETTINGS.title,
    subtitle: sanitizeField(input.subtitle, FIELD_LIMITS.subtitle),
    termLabel: sanitizeField(input.termLabel, FIELD_LIMITS.termLabel),
    workshopDate: sanitizeField(input.workshopDate, FIELD_LIMITS.workshopDate),
    sessionsSummary: sanitizeField(input.sessionsSummary, FIELD_LIMITS.sessionsSummary),
    location: sanitizeField(input.location, FIELD_LIMITS.location),
    ageGroup: sanitizeField(input.ageGroup, FIELD_LIMITS.ageGroup),
    announcementNote: sanitizeField(input.announcementNote, FIELD_LIMITS.announcementNote),
    contactEmail: sanitizeField(input.contactEmail, FIELD_LIMITS.contactEmail),
    contactPhone: sanitizeField(input.contactPhone, FIELD_LIMITS.contactPhone),
    resultsPublished: Boolean(input.resultsPublished),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'settings', 'workshop'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SETTINGS_DOC_PATH);
  }
}

const APPROVED_PHONE_HASHES = new Set<string>([
  'cd7eacb66be481deb846e8d2f6a43aed79888f87d5ce52563350130f5abe1014',
  '012b5dddea54c1e6e45975a6fff6007d3353d2d38d5b4c70d31992a8aec20d0f',
  '17ff7f4158c112ae15af7f175427d155dd2960e3b12ce59443e52e8dba87f757',
  'feca27627f3f40a723b0ea5082461ae49a58304c4f8c670bd205345573201d9c',
  'aa6ade90b8ef288636b482909d32c1e497f46ee9bf7015bb9427ab9545c19c68',
  '09b928d5cf28097b28e1db352702102d596e93042f6760f1628be36e96d47be2',
]);

export interface LookupResult {
  found: boolean;
  data?: StatusLookup;
  phoneDisplay?: string;
}

export async function lookupStatusByPhone(rawPhone: string): Promise<LookupResult> {
  const normalized = normalizeTurkishPhone(rawPhone);
  if (!normalized) {
    throw new Error('INVALID_PHONE');
  }

  const phoneHash = await hashPhone(normalized);
  const phoneDisplay = formatTurkishPhone(normalized);

  if (APPROVED_PHONE_HASHES.has(phoneHash)) {
    return {
      found: true,
      phoneDisplay,
      data: {
        phoneHash,
        status: 'approved',
        waitlistOrder: 0,
        workshopDate: '27 Kasım 2026 Cuma',
        sessionLabel: '15.00 – 16.20',
        location: 'Elazığ Bilim ve Sanat Merkezi B Blok Z Kütüphane',
        notes:
          "27 Kasım Cuma günü saat 15.00-16.20 arası Elazığ Bilim ve Sanat Merkezi B Blok Z kütüphanede yapılacak olan Veli Katılımlı Atölye'de sizleri aramızda görmekten mutluluk duyarız.",
        updatedAt: null,
      },
    };
  }

  const docPath = `${STATUS_LOOKUPS_COLLECTION}/${phoneHash}`;

  try {
    const snap = await getDoc(doc(db, STATUS_LOOKUPS_COLLECTION, phoneHash));
    if (!snap.exists()) {
      return {
        found: false,
        phoneDisplay,
      };
    }
    return {
      found: true,
      data: snap.data() as StatusLookup,
      phoneDisplay,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export function subscribeApplications(
  onData: (records: ApplicationRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, APPLICATIONS_COLLECTION), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ApplicationRecord[] = snapshot.docs.map((d) => d.data() as ApplicationRecord);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, APPLICATIONS_COLLECTION);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

async function prepareAtomicPayloads(
  input: ApplicationFormInput,
  existingRecord?: ApplicationRecord | null
) {
  const normalized = normalizeTurkishPhone(input.phone);
  if (!normalized) {
    throw new Error('Geçerli bir telefon numarası giriniz (ör. 0532 111 22 33).');
  }

  const parentFullName = sanitizeField(input.parentFullName, FIELD_LIMITS.parentFullName);
  const studentFullName = sanitizeField(input.studentFullName, FIELD_LIMITS.studentFullName);
  if (parentFullName.length < 2) {
    throw new Error('Veli ad soyad bilgisi en az 2 karakter olmalıdır.');
  }
  if (studentFullName.length < 1) {
    throw new Error('Öğrenci adı boş bırakılamaz.');
  }

  const phoneHash = await hashPhone(normalized);
  const phoneDisplay = sanitizeField(formatTurkishPhone(normalized), FIELD_LIMITS.phoneDisplay);
  const gradeLevel = sanitizeField(input.gradeLevel, FIELD_LIMITS.gradeLevel);
  const sessionLabel = sanitizeField(input.sessionLabel, FIELD_LIMITS.sessionLabel);
  const workshopDate = sanitizeField(input.workshopDate, FIELD_LIMITS.workshopDate);
  const location = sanitizeField(input.location, FIELD_LIMITS.location);
  const notes = sanitizeField(input.notes, FIELD_LIMITS.notes);
  const waitlistOrder =
    input.status === 'waitlist'
      ? Math.max(0, Math.min(999, Math.floor(Number(input.waitlistOrder) || 0)))
      : 0;

  const isSameDocUpdate = Boolean(existingRecord && existingRecord.phoneHash === phoneHash);

  const applicationPayload = {
    phoneHash,
    phoneNormalized: normalized,
    phoneDisplay,
    parentFullName,
    studentFullName,
    gradeLevel,
    status: input.status,
    waitlistOrder,
    sessionLabel,
    workshopDate,
    location,
    notes,
    createdAt: isSameDocUpdate && existingRecord?.createdAt ? existingRecord.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const lookupPayload = {
    phoneHash,
    parentDisplayName: maskParentName(parentFullName),
    studentFirstName: extractStudentFirstName(studentFullName),
    gradeLevel,
    status: input.status,
    waitlistOrder,
    sessionLabel,
    workshopDate,
    location,
    notes,
    updatedAt: serverTimestamp(),
  };

  return {
    phoneHash,
    applicationPayload,
    lookupPayload,
    replacedOldHash:
      existingRecord && existingRecord.phoneHash !== phoneHash ? existingRecord.phoneHash : null,
  };
}

export async function upsertApplication(
  input: ApplicationFormInput,
  existingRecord?: ApplicationRecord | null
): Promise<void> {
  const normalized = normalizeTurkishPhone(input.phone);
  if (!normalized) {
    throw new Error('Geçerli bir telefon numarası giriniz (ör. 0532 111 22 33).');
  }
  const targetHash = await hashPhone(normalized);

  let targetExisting: ApplicationRecord | null =
    existingRecord && existingRecord.phoneHash === targetHash ? existingRecord : null;

  if (!targetExisting) {
    try {
      const snap = await getDoc(doc(db, APPLICATIONS_COLLECTION, targetHash));
      if (snap.exists()) {
        targetExisting = snap.data() as ApplicationRecord;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${APPLICATIONS_COLLECTION}/${targetHash}`);
    }
  }

  const { phoneHash, applicationPayload, lookupPayload } = await prepareAtomicPayloads(
    input,
    targetExisting
  );
  const replacedOldHash =
    existingRecord && existingRecord.phoneHash !== phoneHash ? existingRecord.phoneHash : null;

  const batch = writeBatch(db);
  if (replacedOldHash) {
    batch.delete(doc(db, APPLICATIONS_COLLECTION, replacedOldHash));
    batch.delete(doc(db, STATUS_LOOKUPS_COLLECTION, replacedOldHash));
  }

  batch.set(doc(db, APPLICATIONS_COLLECTION, phoneHash), applicationPayload);
  batch.set(doc(db, STATUS_LOOKUPS_COLLECTION, phoneHash), lookupPayload);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      targetExisting ? OperationType.UPDATE : OperationType.CREATE,
      `${APPLICATIONS_COLLECTION}/${phoneHash}`
    );
  }
}

export async function deleteApplication(phoneHash: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, APPLICATIONS_COLLECTION, phoneHash));
  batch.delete(doc(db, STATUS_LOOKUPS_COLLECTION, phoneHash));

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${APPLICATIONS_COLLECTION}/${phoneHash}`);
  }
}

export async function bulkImportApplications(
  inputs: ApplicationFormInput[],
  existingByHash: Map<string, ApplicationRecord>
): Promise<number> {
  // Deduplicate by normalized phoneHash (latest row wins)
  const deduped = new Map<string, Awaited<ReturnType<typeof prepareAtomicPayloads>>>();

  for (const input of inputs) {
    const normalized = normalizeTurkishPhone(input.phone);
    if (!normalized) continue;
    const hash = await hashPhone(normalized);
    const existing = existingByHash.get(hash) ?? null;
    const prepared = await prepareAtomicPayloads(input, existing);
    deduped.set(prepared.phoneHash, prepared);
  }

  const entries = Array.from(deduped.values());
  const CHUNK_SIZE = 200; // 200 pairs = 400 Firestore ops (< 500 batch limit)

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(doc(db, APPLICATIONS_COLLECTION, item.phoneHash), item.applicationPayload);
      batch.set(doc(db, STATUS_LOOKUPS_COLLECTION, item.phoneHash), item.lookupPayload);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, APPLICATIONS_COLLECTION);
    }
  }

  return entries.length;
}

export function exportApplicationsCsv(records: ApplicationRecord[]): void {
  const headers = [
    'Veli Adı Soyadı',
    'Telefon',
    'Öğrenci Adı',
    'Sınıf',
    'Durum',
    'Yedek Sırası',
    'Oturum',
    'Tarih',
    'Konum',
    'Not',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n;]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const statusTr: Record<string, string> = {
    approved: 'Onaylandı',
    waitlist: 'Yedek Liste',
    pending: 'Değerlendirmede',
    rejected: 'Kontenjan Dolu',
  };

  const rows = records.map((r) => [
    r.parentFullName,
    r.phoneDisplay,
    r.studentFullName,
    r.gradeLevel,
    statusTr[r.status] || r.status,
    r.waitlistOrder || '',
    r.sessionLabel,
    r.workshopDate,
    r.location,
    r.notes,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'matematik-atolyesi-basvurular.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
