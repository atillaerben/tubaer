/**
 * Security Rules Specification & Dirty Dozen Payload Test Suite
 *
 * Verifies the 12 adversarial payloads from security_spec.md against the
 * validation invariants mirrored in firestore.rules and client defensive guards.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  actor: 'anonymous' | 'unverified_admin' | 'non_admin_user' | 'verified_admin';
  payload?: Record<string, unknown>;
  atomicPartnerPresent?: boolean;
  partnerStatus?: string;
  expected: 'PERMISSION_DENIED';
}

const VALID_HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const ALLOWED_STATUSES = new Set(['approved', 'waitlist', 'pending', 'rejected']);
const PHONE_HASH_RE = /^[a-f0-9]{64}$/;
const PHONE_NORM_RE = /^[0-9]{10,15}$/;

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'PII Enumeration (List Scraping on /applications)',
    operation: 'list',
    path: '/applications',
    actor: 'non_admin_user',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Public Lookup Enumeration (List on /statusLookups)',
    operation: 'list',
    path: '/statusLookups',
    actor: 'anonymous',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Email Spoofing (Unverified Admin Email)',
    operation: 'create',
    path: `/applications/${VALID_HASH}`,
    actor: 'unverified_admin',
    payload: {
      phoneHash: VALID_HASH,
      phoneNormalized: '5321112233',
      phoneDisplay: '0532 111 22 33',
      parentFullName: 'Ayşe Yılmaz',
      studentFullName: 'Kerem Yılmaz',
      gradeLevel: '3. Sınıf',
      status: 'approved',
      waitlistOrder: 0,
      sessionLabel: 'Cumartesi 10:00',
      workshopDate: '14 Mart 2026',
      location: 'Atölye 2. Kat',
      notes: '',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    atomicPartnerPresent: true,
    partnerStatus: 'approved',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow / Ghost Field Injection',
    operation: 'create',
    path: `/applications/${VALID_HASH}`,
    actor: 'verified_admin',
    payload: {
      phoneHash: VALID_HASH,
      phoneNormalized: '5321112233',
      phoneDisplay: '0532 111 22 33',
      parentFullName: 'Ayşe Yılmaz',
      studentFullName: 'Kerem Yılmaz',
      gradeLevel: '3. Sınıf',
      status: 'approved',
      waitlistOrder: 0,
      sessionLabel: 'Cumartesi 10:00',
      workshopDate: '14 Mart 2026',
      location: 'Atölye 2. Kat',
      notes: '',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
      isAdminOverride: true,
    },
    atomicPartnerPresent: true,
    partnerStatus: 'approved',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Path ID Poisoning (Oversized / Malformed Hash)',
    operation: 'get',
    path: `/statusLookups/${'x'.repeat(256)}`,
    actor: 'anonymous',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Phone Hash Mismatch Between Path and Body',
    operation: 'create',
    path: `/applications/${VALID_HASH}`,
    actor: 'verified_admin',
    payload: {
      phoneHash: OTHER_HASH,
      phoneNormalized: '5321112233',
      phoneDisplay: '0532 111 22 33',
      parentFullName: 'Ayşe Yılmaz',
      studentFullName: 'Kerem Yılmaz',
      gradeLevel: '3. Sınıf',
      status: 'approved',
      waitlistOrder: 0,
      sessionLabel: 'Cumartesi 10:00',
      workshopDate: '14 Mart 2026',
      location: 'Atölye 2. Kat',
      notes: '',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    atomicPartnerPresent: true,
    partnerStatus: 'approved',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Write Without Atomic statusLookups Sync',
    operation: 'create',
    path: `/applications/${VALID_HASH}`,
    actor: 'verified_admin',
    payload: {
      phoneHash: VALID_HASH,
      phoneNormalized: '5321112233',
      phoneDisplay: '0532 111 22 33',
      parentFullName: 'Ayşe Yılmaz',
      studentFullName: 'Kerem Yılmaz',
      gradeLevel: '3. Sınıf',
      status: 'approved',
      waitlistOrder: 0,
      sessionLabel: 'Cumartesi 10:00',
      workshopDate: '14 Mart 2026',
      location: 'Atölye 2. Kat',
      notes: '',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    atomicPartnerPresent: false,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Status Desync Between applications and statusLookups',
    operation: 'update',
    path: `/applications/${VALID_HASH}`,
    actor: 'verified_admin',
    payload: {
      phoneHash: VALID_HASH,
      phoneNormalized: '5321112233',
      phoneDisplay: '0532 111 22 33',
      parentFullName: 'Ayşe Yılmaz',
      studentFullName: 'Kerem Yılmaz',
      gradeLevel: '3. Sınıf',
      status: 'approved',
      waitlistOrder: 0,
      sessionLabel: 'Cumartesi 10:00',
      workshopDate: '14 Mart 2026',
      location: 'Atölye 2. Kat',
      notes: '',
      createdAt: 'ORIGINAL_TIME',
      updatedAt: 'SERVER_TIME',
    },
    atomicPartnerPresent: true,
    partnerStatus: 'rejected',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value Poisoning (Invalid Status & Oversized Notes)',
    operation: 'update',
    path: `/applications/${VALID_HASH}`,
    actor: 'verified_admin',
    payload: {
      phoneHash: VALID_HASH,
      phoneNormalized: '5321112233',
      phoneDisplay: '0532 111 22 33',
      parentFullName: 'Ayşe Yılmaz',
      studentFullName: 'Kerem Yılmaz',
      gradeLevel: '3. Sınıf',
      status: 'vip_hack',
      waitlistOrder: 0,
      sessionLabel: 'Cumartesi 10:00',
      workshopDate: '14 Mart 2026',
      location: 'Atölye 2. Kat',
      notes: 'A'.repeat(600),
      createdAt: 'ORIGINAL_TIME',
      updatedAt: 'SERVER_TIME',
    },
    atomicPartnerPresent: true,
    partnerStatus: 'vip_hack',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable createdAt Field Tampering',
    operation: 'update',
    path: `/applications/${VALID_HASH}`,
    actor: 'verified_admin',
    payload: {
      phoneHash: VALID_HASH,
      phoneNormalized: '5321112233',
      phoneDisplay: '0532 111 22 33',
      parentFullName: 'Ayşe Yılmaz',
      studentFullName: 'Kerem Yılmaz',
      gradeLevel: '3. Sınıf',
      status: 'approved',
      waitlistOrder: 0,
      sessionLabel: 'Cumartesi 10:00',
      workshopDate: '14 Mart 2026',
      location: 'Atölye 2. Kat',
      notes: '',
      createdAt: 'TAMPERED_TIME',
      updatedAt: 'SERVER_TIME',
    },
    atomicPartnerPresent: true,
    partnerStatus: 'approved',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Client Timestamp Forgery on WorkshopSettings',
    operation: 'update',
    path: '/settings/workshop',
    actor: 'verified_admin',
    payload: {
      title: 'Matematik Atölyesi',
      subtitle: 'Aile Katılımlı',
      termLabel: '2026 Bahar',
      workshopDate: '14 Mart 2026',
      sessionsSummary: 'Cumartesi 10:00',
      location: 'Atölye Binası',
      ageGroup: '1-4. Sınıf',
      announcementNote: 'Hoş geldiniz',
      contactEmail: 'info@example.com',
      contactPhone: '0532 000 00 00',
      resultsPublished: true,
      updatedAt: 'FORGED_CLIENT_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-Assigned Admin Privilege Escalation',
    operation: 'create',
    path: '/admins/attacker_uid_123',
    actor: 'non_admin_user',
    payload: {
      email: 'attacker@example.com',
      role: 'admin',
      createdAt: 'SERVER_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
];

export function evaluateRuleInvariant(testCase: DirtyDozenCase): 'ALLOWED' | 'PERMISSION_DENIED' {
  const { operation, path, actor, payload, atomicPartnerPresent, partnerStatus } = testCase;

  if (path.startsWith('/admins')) {
    return 'PERMISSION_DENIED';
  }

  if (path === '/statusLookups' && operation === 'list') {
    return 'PERMISSION_DENIED';
  }

  if (path.startsWith('/statusLookups/') && operation === 'get') {
    const id = path.split('/')[2] ?? '';
    return PHONE_HASH_RE.test(id) ? 'ALLOWED' : 'PERMISSION_DENIED';
  }

  if (path === '/applications' && operation === 'list') {
    return actor === 'verified_admin' ? 'ALLOWED' : 'PERMISSION_DENIED';
  }

  if (actor !== 'verified_admin') {
    return 'PERMISSION_DENIED';
  }

  if (path === '/settings/workshop' && payload) {
    if (payload.updatedAt !== 'SERVER_TIME') return 'PERMISSION_DENIED';
    return 'ALLOWED';
  }

  if (path.startsWith('/applications/') && payload) {
    const id = path.split('/')[2] ?? '';
    const allowedKeys = new Set([
      'phoneHash',
      'phoneNormalized',
      'phoneDisplay',
      'parentFullName',
      'studentFullName',
      'gradeLevel',
      'status',
      'waitlistOrder',
      'sessionLabel',
      'workshopDate',
      'location',
      'notes',
      'createdAt',
      'updatedAt',
    ]);
    const keys = Object.keys(payload);
    if (keys.length !== allowedKeys.size || keys.some((k) => !allowedKeys.has(k))) {
      return 'PERMISSION_DENIED';
    }
    if (!PHONE_HASH_RE.test(id) || payload.phoneHash !== id) return 'PERMISSION_DENIED';
    if (typeof payload.phoneNormalized !== 'string' || !PHONE_NORM_RE.test(payload.phoneNormalized)) {
      return 'PERMISSION_DENIED';
    }
    if (typeof payload.status !== 'string' || !ALLOWED_STATUSES.has(payload.status)) {
      return 'PERMISSION_DENIED';
    }
    if (typeof payload.notes !== 'string' || payload.notes.length > 500) {
      return 'PERMISSION_DENIED';
    }
    if (operation === 'update' && payload.createdAt !== 'ORIGINAL_TIME') {
      return 'PERMISSION_DENIED';
    }
    if (payload.updatedAt !== 'SERVER_TIME') {
      return 'PERMISSION_DENIED';
    }
    if (!atomicPartnerPresent || partnerStatus !== payload.status) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOWED';
  }

  return 'PERMISSION_DENIED';
}
