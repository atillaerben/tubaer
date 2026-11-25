import React, { useEffect, useMemo, useState } from 'react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileSearch,
  Info,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { ADMIN_EMAIL, auth, googleProvider } from '../firebase';
import {
  bulkImportApplications,
  deleteApplication,
  exportApplicationsCsv,
  saveWorkshopSettings,
  subscribeApplications,
  upsertApplication,
} from '../services/workshopService';
import {
  STATUS_LABELS,
  type ApplicationFormInput,
  type ApplicationRecord,
  type ApplicationStatus,
  type WorkshopSettings,
} from '../types';
import {
  formatPhoneAsTyping,
  parseBulkImportText,
  type ParsedImportRow,
} from '../utils/phone';

interface AdminDashboardProps {
  user: User | null;
  authReady: boolean;
  settings: WorkshopSettings;
  onSettingsUpdated: (next: WorkshopSettings) => void;
}

const SAMPLE_DEMO_APPLICANTS: ApplicationFormInput[] = [
  {
    phone: '0532 111 22 33',
    parentFullName: 'Ayşe Yılmaz',
    studentFullName: 'Kerem Yılmaz',
    gradeLevel: '3. Sınıf',
    status: 'approved',
    waitlistOrder: 0,
    sessionLabel: 'Cumartesi Sabah · 10:00 – 12:00',
    workshopDate: '14 Mart 2026 Cumartesi',
    location: 'Atölye Binası, 2. Kat Matematik Salonu',
    notes: 'Lütfen atölye başlangıcından 15 dakika önce giriş masasında olunuz.',
  },
  {
    phone: '0533 222 33 44',
    parentFullName: 'Mehmet Demir',
    studentFullName: 'Zeynep Demir',
    gradeLevel: '2. Sınıf',
    status: 'waitlist',
    waitlistOrder: 2,
    sessionLabel: 'Cumartesi Öğleden Sonra · 14:00 – 16:00',
    workshopDate: '14 Mart 2026 Cumartesi',
    location: 'Atölye Binası, 2. Kat Matematik Salonu',
    notes: 'Kontenjan açıldığında telefonla bilgi verilecektir.',
  },
  {
    phone: '0534 333 44 55',
    parentFullName: 'Selin Kaya',
    studentFullName: 'Ali Kaya',
    gradeLevel: '4. Sınıf',
    status: 'pending',
    waitlistOrder: 0,
    sessionLabel: 'Cumartesi Sabah · 10:00 – 12:00',
    workshopDate: '14 Mart 2026 Cumartesi',
    location: 'Atölye Binası, 2. Kat Matematik Salonu',
    notes: 'Başvurunuz incelenmektedir; kesin sonuç Cuma günü güncellenecektir.',
  },
  {
    phone: '0535 444 55 66',
    parentFullName: 'Emre Arslan',
    studentFullName: 'Defne Arslan',
    gradeLevel: '1. Sınıf',
    status: 'rejected',
    waitlistOrder: 0,
    sessionLabel: '',
    workshopDate: '14 Mart 2026 Cumartesi',
    location: '',
    notes: 'Bir sonraki dönem atölyemizde öncelikli bilgilendirme listesine eklendiniz.',
  },
];

function StatusInlineLabel({
  status,
  waitlistOrder,
}: {
  status: ApplicationStatus;
  waitlistOrder: number;
}) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Onaylandı
      </span>
    );
  }
  if (status === 'waitlist') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Yedek Liste{waitlistOrder > 0 ? ` #${waitlistOrder}` : ''}
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] whitespace-nowrap">
        <FileSearch className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Değerlendirmede
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 whitespace-nowrap">
      <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Kontenjan Dolu
    </span>
  );
}

export function AdminDashboard({
  user,
  authReady,
  settings,
  onSettingsUpdated,
}: AdminDashboardProps) {
  const isVerifiedAdmin = Boolean(
    user && user.emailVerified && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'applications' | 'settings'>('applications');
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [deletingHash, setDeletingHash] = useState<string | null>(null);
  const [updatingStatusHash, setUpdatingStatusHash] = useState<string | null>(null);

  // Add / Edit Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ApplicationRecord | null>(null);
  const [formState, setFormState] = useState<ApplicationFormInput>({
    phone: '',
    parentFullName: '',
    studentFullName: '',
    gradeLevel: '',
    status: 'approved',
    waitlistOrder: 0,
    sessionLabel: '',
    workshopDate: '',
    location: '',
    notes: '',
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Bulk import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<WorkshopSettings>(settings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  useEffect(() => {
    if (!authReady || !isVerifiedAdmin) {
      setApplications([]);
      setListLoading(false);
      return;
    }

    setListLoading(true);
    setListError(null);
    const unsub = subscribeApplications(
      (records) => {
        setApplications(records);
        setListLoading(false);
      },
      (err) => {
        setListError(err.message);
        setListLoading(false);
      }
    );

    return () => unsub();
  }, [authReady, isVerifiedAdmin]);

  const existingByHash = useMemo(() => {
    const map = new Map<string, ApplicationRecord>();
    for (const app of applications) {
      map.set(app.phoneHash, app);
    }
    return map;
  }, [applications]);

  const counts = useMemo(() => {
    const c = { total: applications.length, approved: 0, waitlist: 0, pending: 0, rejected: 0 };
    for (const app of applications) {
      c[app.status] += 1;
    }
    return c;
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    const qDigits = searchQuery.replace(/\D/g, '');
    return applications.filter((app) => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (!q) return true;
      const matchesName =
        app.parentFullName.toLocaleLowerCase('tr-TR').includes(q) ||
        app.studentFullName.toLocaleLowerCase('tr-TR').includes(q) ||
        app.gradeLevel.toLocaleLowerCase('tr-TR').includes(q) ||
        app.sessionLabel.toLocaleLowerCase('tr-TR').includes(q);
      const matchesPhone =
        app.phoneDisplay.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && app.phoneNormalized.includes(qDigits));
      return matchesName || matchesPhone;
    });
  }, [applications, searchQuery, statusFilter]);

  const parsedImportRows: ParsedImportRow[] = useMemo(() => {
    if (!importText.trim()) return [];
    return parseBulkImportText(importText, {
      workshopDate: settings.workshopDate,
      location: settings.location,
      sessionLabel: settings.sessionsSummary.split('·')[0]?.trim() || settings.sessionsSummary,
    });
  }, [importText, settings.workshopDate, settings.location, settings.sessionsSummary]);

  const validImportRows = useMemo(
    () => parsedImportRows.filter((r) => r.valid),
    [parsedImportRows]
  );

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    window.setTimeout(() => {
      setFeedbackBanner((current) => (current === msg ? null : current));
    }, 4000);
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error && err.message.includes('popup-closed-by-user')
          ? 'Giriş penceresi kapatıldı. Tekrar deneyebilirsiniz.'
          : 'Google ile giriş yapılamadı. Tarayıcı açılır pencere iznini kontrol edip tekrar deneyin.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('Bağlantı kopyalanamadı. Adres çubuğundaki bağlantıyı kopyalayabilirsiniz.');
    }
  };

  const openNewApplicationModal = () => {
    setEditingRecord(null);
    setFormError(null);
    setFormState({
      phone: '',
      parentFullName: '',
      studentFullName: '',
      gradeLevel: '',
      status: 'approved',
      waitlistOrder: 0,
      sessionLabel: settings.sessionsSummary.split('·')[0]?.trim() || '',
      workshopDate: settings.workshopDate,
      location: settings.location,
      notes: '',
    });
    setEditorOpen(true);
  };

  const openEditApplicationModal = (record: ApplicationRecord) => {
    setEditingRecord(record);
    setFormError(null);
    setFormState({
      phone: record.phoneDisplay,
      parentFullName: record.parentFullName,
      studentFullName: record.studentFullName,
      gradeLevel: record.gradeLevel,
      status: record.status,
      waitlistOrder: record.waitlistOrder,
      sessionLabel: record.sessionLabel,
      workshopDate: record.workshopDate,
      location: record.location,
      notes: record.notes,
    });
    setEditorOpen(true);
  };

  const handleSaveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError(null);
    try {
      await upsertApplication(formState, editingRecord);
      setEditorOpen(false);
      showToast(editingRecord ? 'Başvuru kaydı güncellendi.' : 'Yeni başvuru kaydı eklendi.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt kaydedilemedi.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleInlineStatusChange = async (
    record: ApplicationRecord,
    nextStatus: ApplicationStatus
  ) => {
    setUpdatingStatusHash(record.phoneHash);
    try {
      await upsertApplication(
        {
          phone: record.phoneDisplay,
          parentFullName: record.parentFullName,
          studentFullName: record.studentFullName,
          gradeLevel: record.gradeLevel,
          status: nextStatus,
          waitlistOrder: nextStatus === 'waitlist' ? record.waitlistOrder || 1 : 0,
          sessionLabel: record.sessionLabel,
          workshopDate: record.workshopDate,
          location: record.location,
          notes: record.notes,
        },
        record
      );
      showToast(`${record.parentFullName} durumu "${STATUS_LABELS[nextStatus]}" olarak güncellendi.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Durum güncellenemedi.');
    } finally {
      setUpdatingStatusHash(null);
    }
  };

  const handleConfirmDelete = async (phoneHash: string) => {
    try {
      await deleteApplication(phoneHash);
      setDeletingHash(null);
      showToast('Başvuru kaydı silindi.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kayıt silinemedi.');
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportText(reader.result);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleCommitBulkImport = async () => {
    if (validImportRows.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const count = await bulkImportApplications(
        validImportRows.map((r) => r.input),
        existingByHash
      );
      setImportOpen(false);
      setImportText('');
      showToast(`${count} başvuru kaydı başarıyla aktarıldı.`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Toplu aktarım sırasında hata oluştu.');
    } finally {
      setImporting(false);
    }
  };

  const handleSeedDemoData = async () => {
    setImporting(true);
    try {
      const count = await bulkImportApplications(SAMPLE_DEMO_APPLICANTS, existingByHash);
      showToast(`${count} örnek başvuru kaydı yüklendi. Sorgulama sayfasında 0532 111 22 33 ile deneyebilirsiniz.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Örnek veriler yüklenemedi.');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      await saveWorkshopSettings(settingsForm);
      onSettingsUpdated(settingsForm);
      setSettingsMessage('Atölye duyuru bilgileri kaydedildi ve canlı sayfada güncellendi.');
    } catch (err) {
      setSettingsMessage(
        err instanceof Error ? err.message : 'Ayarlar kaydedilirken bir hata oluştu.'
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!authReady) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>Oturum kontrol ediliyor…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-md mx-auto bg-white border border-neutral-200 rounded-xl p-8">
          <div className="text-xs font-medium text-neutral-500">Atölye Eğitmeni</div>
          <h1 className="mt-2 text-2xl font-display font-semibold tracking-tight text-neutral-900">
            Yönetici Girişi
          </h1>
          <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
            Başvuru listesini eklemek, Excel veya Google Forms CSV dosyanızı içe aktarmak ve
            başvuru durumlarını güncellemek için yetkili Google hesabınızla giriş yapın.
          </p>

          {authError ? (
            <p role="alert" className="mt-4 text-xs font-medium text-red-700">
              {authError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="mt-6 w-full h-11 px-4 inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            {authLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="w-4 h-4" aria-hidden="true" />
            )}
            Google ile Giriş Yap
          </button>
        </div>
      </main>
    );
  }

  if (!isVerifiedAdmin) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-md mx-auto bg-white border border-neutral-200 rounded-xl p-8">
          <h1 className="text-xl font-display font-semibold text-neutral-900">
            Yetkisiz Yönetici Hesabı
          </h1>
          <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
            Şu anda <span className="font-medium text-neutral-900">{user.email}</span> hesabı ile
            giriş yaptınız. Bu panel yalnızca atölye yöneticisi hesabına açıktır.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Çıkış Yap
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="text-xs font-medium text-neutral-500">
            Yönetici Paneli · {user.email}
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-neutral-900">
            Başvuru ve Duyuru Yönetimi
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Bağlantı Kopyalandı
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                Duyuru Bağlantısını Kopyala
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Excel / CSV Aktar
          </button>

          <button
            type="button"
            onClick={openNewApplicationModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Yeni Başvuru Ekle
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Çıkış
          </button>
        </div>
      </div>

      {feedbackBanner ? (
        <div
          role="status"
          className="bg-white border border-neutral-200 rounded-lg px-4 py-3 text-sm text-neutral-800 flex items-center justify-between gap-4"
        >
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="Bildirimi kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-b border-neutral-200 py-5 gap-6">
        <div>
          <div className="text-xs font-medium text-neutral-500">Toplam Başvuru</div>
          <div className="mt-1 text-2xl font-display font-semibold font-mono tabular-nums text-neutral-900">
            {counts.total}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-neutral-500">Onaylanan</div>
          <div className="mt-1 text-2xl font-display font-semibold font-mono tabular-nums text-emerald-800">
            {counts.approved}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-neutral-500">Yedek Liste</div>
          <div className="mt-1 text-2xl font-display font-semibold font-mono tabular-nums text-amber-800">
            {counts.waitlist}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-neutral-500">Değerlendirmede</div>
          <div className="mt-1 text-2xl font-display font-semibold font-mono tabular-nums text-[#1D4ED8]">
            {counts.pending}
          </div>
        </div>
      </div>

      {/* Workspace Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-neutral-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'applications'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            Başvuru Listesi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" aria-hidden="true" />
            Atölye ve Duyuru Ayarları
          </button>
        </div>

        {activeTab === 'applications' && applications.length > 0 ? (
          <button
            type="button"
            onClick={() => exportApplicationsCsv(applications)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            CSV Olarak İndir
          </button>
        ) : null}
      </div>

      {/* Tab 1: Applications List */}
      {activeTab === 'applications' ? (
        <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          {/* Search & Status Filter Toolbar */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative w-full lg:max-w-sm">
              <Search
                className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Veli, öğrenci veya telefon ara…"
                className="w-full h-10 pl-9 pr-3 text-sm bg-[#F8F9FA] border border-neutral-300 rounded-lg focus:bg-white focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg overflow-x-auto">
              {(
                [
                  ['all', `Tümü (${counts.total})`],
                  ['approved', `Onaylandı (${counts.approved})`],
                  ['waitlist', `Yedek (${counts.waitlist})`],
                  ['pending', `Değerlendirmede (${counts.pending})`],
                  ['rejected', `Kontenjan Dolu (${counts.rejected})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    statusFilter === key
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {listError ? (
            <div className="p-6 text-sm text-red-700">
              Kayıtlar yüklenirken hata oluştu: {listError}
            </div>
          ) : listLoading ? (
            <div className="p-12 flex items-center justify-center gap-2.5 text-sm text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Başvurular yükleniyor…
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center max-w-lg mx-auto">
              <h2 className="text-lg font-display font-semibold text-neutral-900">
                Henüz başvuru kaydı eklenmedi
              </h2>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                Google Forms veya Excel listenizi tek seferde içeri aktarabilir, tek tek kayıt
                ekleyebilir ya da sistemi hızlıca test etmek için 4 örnek başvuru yükleyebilirsiniz.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  Excel / CSV Aktar
                </button>
                <button
                  type="button"
                  onClick={handleSeedDemoData}
                  disabled={importing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Örnek 4 Kayıt Yükle
                </button>
              </div>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-10 text-center text-sm text-neutral-500">
              Arama kriterlerinize uygun başvuru bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-[#F8F9FA] text-xs font-medium text-neutral-500">
                    <th className="py-3 px-5">Veli ve Telefon</th>
                    <th className="py-3 px-4">Öğrenci</th>
                    <th className="py-3 px-4">Oturum</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-5 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-sm">
                  {filteredApplications.map((app) => (
                    <tr key={app.phoneHash} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-neutral-900">{app.parentFullName}</div>
                        <div className="mt-0.5 text-xs font-mono tabular-nums text-neutral-500">
                          {app.phoneDisplay}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-neutral-900">{app.studentFullName}</div>
                        {app.gradeLevel ? (
                          <div className="mt-0.5 text-xs text-neutral-500">{app.gradeLevel}</div>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-neutral-600 max-w-[220px]">
                        <div className="truncate">{app.sessionLabel || '—'}</div>
                        {app.workshopDate ? (
                          <div className="mt-0.5 text-neutral-400 truncate">{app.workshopDate}</div>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <StatusInlineLabel
                            status={app.status}
                            waitlistOrder={app.waitlistOrder}
                          />
                        </div>
                        <select
                          aria-label={`${app.parentFullName} durumunu değiştir`}
                          value={app.status}
                          disabled={updatingStatusHash === app.phoneHash}
                          onChange={(e) =>
                            handleInlineStatusChange(app, e.target.value as ApplicationStatus)
                          }
                          className="mt-1.5 text-xs text-neutral-700 bg-white border border-neutral-300 rounded-md px-2 py-1 focus:border-[#1D4ED8] focus:outline-none"
                        >
                          <option value="approved">Onaylandı</option>
                          <option value="waitlist">Yedek Liste</option>
                          <option value="pending">Değerlendirmede</option>
                          <option value="rejected">Kontenjan Dolu</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {deletingHash === app.phoneHash ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(app.phoneHash)}
                              className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                            >
                              Silmeyi Onayla
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingHash(null)}
                              className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                            >
                              Vazgeç
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditApplicationModal(app)}
                              aria-label={`${app.parentFullName} kaydını düzenle`}
                              className="p-2 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingHash(app.phoneHash)}
                              aria-label={`${app.parentFullName} kaydını sil`}
                              className="p-2 text-neutral-500 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        /* Tab 2: Workshop Announcement Settings */
        <section className="bg-white border border-neutral-200 rounded-xl p-6 sm:p-8 max-w-3xl">
          <h2 className="text-lg font-display font-semibold text-neutral-900">
            Atölye Duyuru Bilgileri
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Bu alanlarda yapacağınız değişiklikler ailelerin gördüğü sorgulama ve duyuru sayfasında
            anında güncellenir.
          </p>

          <form onSubmit={handleSaveSettings} className="mt-6 space-y-5">
            <div className="flex items-center justify-between gap-4 py-4 px-4 bg-[#F8F9FA] border border-neutral-200 rounded-lg">
              <div>
                <div className="text-sm font-semibold text-neutral-900">
                  Sorgulama Ekranı Yayında
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Kapalı olduğunda aileler sonuçların henüz açıklanmadığına dair bilgi mesajı görür.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settingsForm.resultsPublished}
                onClick={() =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    resultsPublished: !prev.resultsPublished,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                  settingsForm.resultsPublished ? 'bg-[#1D4ED8]' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform mt-0.5 ${
                    settingsForm.resultsPublished ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Atölye Başlığı
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                  className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Dönem Etiketi
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={settingsForm.termLabel}
                  onChange={(e) => setSettingsForm({ ...settingsForm, termLabel: e.target.value })}
                  placeholder="2026 Bahar Dönemi"
                  className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Alt Başlık Açıklaması
              </label>
              <textarea
                rows={2}
                maxLength={160}
                value={settingsForm.subtitle}
                onChange={(e) => setSettingsForm({ ...settingsForm, subtitle: e.target.value })}
                className="w-full p-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Atölye Tarihi
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={settingsForm.workshopDate}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, workshopDate: e.target.value })
                  }
                  placeholder="14 Mart 2026 Cumartesi"
                  className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Katılımcı Grubu
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={settingsForm.ageGroup}
                  onChange={(e) => setSettingsForm({ ...settingsForm, ageGroup: e.target.value })}
                  placeholder="İlkokul 1 – 4. Sınıf ve Velileri"
                  className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Oturum Saatleri Özeti
              </label>
              <input
                type="text"
                maxLength={120}
                value={settingsForm.sessionsSummary}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, sessionsSummary: e.target.value })
                }
                placeholder="Sabah 10:00 – 12:00 · Öğleden Sonra 14:00 – 16:00"
                className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Konum</label>
              <input
                type="text"
                maxLength={160}
                value={settingsForm.location}
                onChange={(e) => setSettingsForm({ ...settingsForm, location: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Genel Duyuru Notu
              </label>
              <textarea
                rows={3}
                maxLength={600}
                value={settingsForm.announcementNote}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, announcementNote: e.target.value })
                }
                className="w-full p-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  İletişim E-posta
                </label>
                <input
                  type="email"
                  maxLength={120}
                  value={settingsForm.contactEmail}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, contactEmail: e.target.value })
                  }
                  className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  İletişim Telefonu (Opsiyonel)
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={settingsForm.contactPhone}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, contactPhone: e.target.value })
                  }
                  placeholder="05XX XXX XX XX"
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            {settingsMessage ? (
              <p role="status" className="text-sm font-medium text-emerald-800">
                {settingsMessage}
              </p>
            ) : null}

            <div className="pt-2">
              <button
                type="submit"
                disabled={settingsSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                {settingsSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : null}
                Ayarları Kaydet
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Add / Edit Single Application Modal */}
      {editorOpen ? (
        <div
          className="fixed inset-0 z-50 bg-neutral-950/45 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editor-modal-title"
        >
          <div className="w-full max-w-xl bg-white border border-neutral-200 rounded-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 id="editor-modal-title" className="text-lg font-display font-semibold text-neutral-900">
                {editingRecord ? 'Başvuruyu Düzenle' : 'Yeni Başvuru Ekle'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                aria-label="Kapat"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveApplication} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Veli Adı Soyadı *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formState.parentFullName}
                    onChange={(e) =>
                      setFormState({ ...formState, parentFullName: e.target.value })
                    }
                    placeholder="Ayşe Yılmaz"
                    className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Cep Telefonu *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formState.phone}
                    onChange={(e) =>
                      setFormState({ ...formState, phone: formatPhoneAsTyping(e.target.value) })
                    }
                    placeholder="0532 111 22 33"
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Öğrenci Adı Soyadı *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formState.studentFullName}
                    onChange={(e) =>
                      setFormState({ ...formState, studentFullName: e.target.value })
                    }
                    placeholder="Kerem Yılmaz"
                    className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Sınıf / Yaş
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    value={formState.gradeLevel}
                    onChange={(e) => setFormState({ ...formState, gradeLevel: e.target.value })}
                    placeholder="3. Sınıf"
                    className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Başvuru Durumu
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as ApplicationStatus;
                      setFormState({
                        ...formState,
                        status: nextStatus,
                        waitlistOrder:
                          nextStatus === 'waitlist' ? formState.waitlistOrder || 1 : 0,
                      });
                    }}
                    className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="approved">Onaylandı (Kesin Kayıt)</option>
                    <option value="waitlist">Yedek Liste</option>
                    <option value="pending">Değerlendirmede</option>
                    <option value="rejected">Kontenjan Dolu</option>
                  </select>
                </div>

                {formState.status === 'waitlist' ? (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Yedek Sırası
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={formState.waitlistOrder}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          waitlistOrder: Math.max(0, Math.min(999, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Atölye Tarihi
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={formState.workshopDate}
                      onChange={(e) =>
                        setFormState({ ...formState, workshopDate: e.target.value })
                      }
                      className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Oturum / Grup
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={formState.sessionLabel}
                    onChange={(e) => setFormState({ ...formState, sessionLabel: e.target.value })}
                    placeholder="Cumartesi Sabah · 10:00 – 12:00"
                    className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Konum</label>
                  <input
                    type="text"
                    maxLength={160}
                    value={formState.location}
                    onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Aileye Özel Not (Sorgulama sonucunda görünür)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Örn. 15 dakika önce giriş masasında bulunmanızı rica ederiz."
                  className="w-full p-3 text-sm bg-white border border-neutral-300 rounded-lg focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              {formError ? (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 rounded-lg"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors"
                >
                  {formSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Bulk Import Modal (Excel / Google Forms CSV) */}
      {importOpen ? (
        <div
          className="fixed inset-0 z-50 bg-neutral-950/45 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
        >
          <div className="w-full max-w-2xl bg-white border border-neutral-200 rounded-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 id="import-modal-title" className="text-lg font-display font-semibold text-neutral-900">
                Excel veya Google Forms CSV Aktarımı
              </h2>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                aria-label="Kapat"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-neutral-600 leading-relaxed">
                Google Forms yanıtlarından indirdiğiniz <code className="font-mono text-xs">.csv</code>{' '}
                dosyasını yükleyin veya Excel / Google Sheets tablonuzdan satırları doğrudan kopyalayıp
                aşağıya yapıştırın. Sütun başlıkları (Veli Adı, Telefon, Öğrenci, Sınıf, Durum,
                Oturum, Not) otomatik algılanır.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  CSV Dosyası Seç
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleCsvFileUpload}
                    className="sr-only"
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setImportText(
                      'Veli Adı;Telefon;Öğrenci Adı;Sınıf;Durum;Oturum;Not\nAyşe Yılmaz;0532 111 22 33;Kerem Yılmaz;3. Sınıf;Onaylandı;Sabah 10:00;15 dk önce geliniz\nMehmet Demir;0533 222 33 44;Zeynep Demir;2. Sınıf;Yedek Liste;Öğleden Sonra 14:00;Kontenjan açılırsa aranacak'
                    )
                  }
                  className="text-xs font-medium text-[#1D4ED8] hover:text-[#1E40AF] underline underline-offset-4"
                >
                  Örnek formatı doldur
                </button>
              </div>

              <textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'Veli Adı, Telefon, Öğrenci Adı, Sınıf, Durum, Oturum, Not\nAyşe Yılmaz, 0532 111 22 33, Kerem Yılmaz, 3. Sınıf, Onaylandı, Sabah 10:00, Hoş geldiniz'}
                className="w-full p-3 text-xs font-mono bg-[#F8F9FA] border border-neutral-300 rounded-lg focus:bg-white focus:border-[#1D4ED8] focus:outline-none"
              />

              {parsedImportRows.length > 0 ? (
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-[#F8F9FA] border-b border-neutral-200 text-xs text-neutral-600 flex items-center justify-between">
                    <span>
                      Toplam <strong className="font-mono">{parsedImportRows.length}</strong> satır
                      algılandı ·{' '}
                      <strong className="font-mono text-emerald-800">{validImportRows.length}</strong>{' '}
                      geçerli
                    </span>
                    {parsedImportRows.length - validImportRows.length > 0 ? (
                      <span className="text-amber-800 font-medium">
                        {parsedImportRows.length - validImportRows.length} satır hatalı (atlanacak)
                      </span>
                    ) : null}
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-neutral-200 text-xs">
                    {parsedImportRows.slice(0, 20).map((row) => (
                      <div
                        key={row.rowNumber}
                        className="px-3.5 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="truncate">
                          <span className="font-mono text-neutral-400 mr-2">#{row.rowNumber}</span>
                          <span className="font-medium text-neutral-900">
                            {row.input.parentFullName || '(İsimsiz)'}
                          </span>
                          <span className="text-neutral-500">
                            {' '}
                            · {row.input.phone || 'Telefon yok'} · {row.input.studentFullName}
                          </span>
                        </div>
                        {row.valid ? (
                          <span className="text-emerald-800 font-medium whitespace-nowrap">
                            {STATUS_LABELS[row.input.status]}
                          </span>
                        ) : (
                          <span className="text-red-700 font-medium whitespace-nowrap">
                            {row.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {importError ? (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {importError}
                </p>
              ) : null}

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 rounded-lg"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={importing || validImportRows.length === 0}
                  onClick={handleCommitBulkImport}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 rounded-lg transition-colors"
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {validImportRows.length} Kaydı İçeri Aktar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
