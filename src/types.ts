import type { Timestamp } from 'firebase/firestore';

export type ApplicationStatus = 'approved' | 'waitlist' | 'pending' | 'rejected';

export interface WorkshopSettings {
  title: string;
  subtitle: string;
  termLabel: string;
  advisorName: string;
  workshopDate: string;
  sessionsSummary: string;
  location: string;
  ageGroup: string;
  announcementNote: string;
  contactEmail: string;
  contactPhone: string;
  resultsPublished: boolean;
  updatedAt?: Timestamp | null;
}

export interface ApplicationRecord {
  phoneHash: string;
  phoneNormalized: string;
  phoneDisplay: string;
  parentFullName: string;
  studentFullName: string;
  gradeLevel: string;
  status: ApplicationStatus;
  waitlistOrder: number;
  sessionLabel: string;
  workshopDate: string;
  location: string;
  notes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StatusLookup {
  phoneHash: string;
  parentDisplayName?: string;
  studentFirstName?: string;
  gradeLevel?: string;
  status: ApplicationStatus;
  waitlistOrder: number;
  sessionLabel: string;
  workshopDate: string;
  location: string;
  notes: string;
  updatedAt?: Timestamp | null;
}

export interface ApplicationFormInput {
  phone: string;
  parentFullName: string;
  studentFullName: string;
  gradeLevel: string;
  status: ApplicationStatus;
  waitlistOrder: number;
  sessionLabel: string;
  workshopDate: string;
  location: string;
  notes: string;
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  approved: 'Onaylandı',
  waitlist: 'Yedek Liste',
  pending: 'Değerlendirmede',
  rejected: 'Kontenjan Dolu',
};

export const APPROVED_WORKSHOP_MESSAGE =
  "27 Kasım Cuma günü saat 15.00-16.20 arası Elazığ Bilim ve Sanat Merkezi B Blok Z kütüphanede yapılacak olan Veli Katılımlı Atölye'de sizleri aramızda görmekten mutluluk duyarız.";

export const DEFAULT_WORKSHOP_SETTINGS: WorkshopSettings = {
  title: 'Aile Atölyeleri ile Matematiği Birlikte İnşa Edelim',
  subtitle:
    'Bu projenin temel amacı; bilim ve sanat merkezlerine devam eden özel yetenekli öğrencilerin matematiksel düşünme, yaratıcılık ve problem çözme becerilerini geliştirmek; aynı zamanda ebeveynlerin bu süreçte aktif rol alarak aile içi öğrenme kültürünü güçlendirmelerini sağlamaktır.',
  termLabel: 'Elazığ Bilim ve Sanat Merkezi · 2026–2027 Eğitim Yılı',
  advisorName: 'Tuba Erben',
  workshopDate: '27.11.2026 – 18.12.2026 (4 Cuma)',
  sessionsSummary: '15.00 – 16.20',
  location: 'Elazığ Bilim ve Sanat Merkezi B Blok Z Kütüphane',
  ageGroup:
    "2026–2027 Eğitim Yılında BİLSEM'e Yeni Başlayan 3. ve 4. Sınıf Öğrenci ve Velileri (10 Öğrenci + 10 Veli)",
  announcementNote: '',
  contactEmail: '',
  contactPhone: '',
  resultsPublished: true,
  updatedAt: null,
};
