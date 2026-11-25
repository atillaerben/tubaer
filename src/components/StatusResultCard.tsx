import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileSearch,
  Info,
  Printer,
  RotateCcw,
} from 'lucide-react';
import {
  APPROVED_WORKSHOP_MESSAGE,
  type ApplicationStatus,
  type StatusLookup,
  type WorkshopSettings,
} from '../types';
import { downloadWorkshopCalendarIcs } from '../utils/phone';

interface StatusResultCardProps {
  lookup: StatusLookup;
  phoneDisplay: string;
  settings: WorkshopSettings;
  onReset: () => void;
}

const STATUS_PRESENTATION: Record<
  ApplicationStatus,
  {
    headline: string;
    fallbackSummary: string;
    label: string;
    accentText: string;
    surfaceBg: string;
    borderColor: string;
    Icon: typeof CheckCircle2;
  }
> = {
  approved: {
    headline: 'Başvurunuz Onaylandı',
    fallbackSummary: APPROVED_WORKSHOP_MESSAGE,
    label: 'Başvuru Durumu · Onaylandı',
    accentText: 'text-emerald-800',
    surfaceBg: 'bg-emerald-50/60',
    borderColor: 'border-emerald-200',
    Icon: CheckCircle2,
  },
  waitlist: {
    headline: 'Yedek Listedesiniz',
    fallbackSummary:
      'Yoğun ilgi nedeniyle başvurunuz yedek listeye alınmıştır. Kontenjan açılması durumunda telefon numaranız üzerinden bilgilendirme yapılacaktır.',
    label: 'Yedek Liste',
    accentText: 'text-amber-800',
    surfaceBg: 'bg-amber-50/60',
    borderColor: 'border-amber-200',
    Icon: Clock,
  },
  pending: {
    headline: 'Başvurunuz Değerlendirmede',
    fallbackSummary:
      'Başvuru kaydınız ulaşmıştır. Değerlendirme tamamlandığında kesin sonucunuz bu ekranda güncellenecektir.',
    label: 'Değerlendirmede',
    accentText: 'text-[#1E40AF]',
    surfaceBg: 'bg-blue-50/50',
    borderColor: 'border-blue-200',
    Icon: FileSearch,
  },
  rejected: {
    headline: 'Bu Dönem Kontenjan Doldu',
    fallbackSummary:
      'İlginiz için teşekkür ederiz. Bu dönem için ayrılan atölye kontenjanı dolduğundan başvurunuza olumlu yanıt veremiyoruz.',
    label: 'Kontenjan Dolu',
    accentText: 'text-neutral-700',
    surfaceBg: 'bg-neutral-50',
    borderColor: 'border-neutral-200',
    Icon: Info,
  },
};

export function StatusResultCard({
  lookup,
  phoneDisplay,
  settings,
  onReset,
}: StatusResultCardProps) {
  const meta = STATUS_PRESENTATION[lookup.status];
  const StatusIcon = meta.Icon;

  const displayDate = lookup.workshopDate || '27 Kasım 2026 Cuma';
  const displaySession = lookup.sessionLabel || settings.sessionsSummary;
  const displayLocation = lookup.location || settings.location;
  const primaryMessage = lookup.notes || meta.fallbackSummary;

  return (
    <div
      className={`print-card rounded-xl border ${meta.borderColor} bg-white overflow-hidden transition-opacity duration-200`}
      role="status"
      aria-live="polite"
    >
      {/* Top Semantic Status Banner */}
      <div className={`${meta.surfaceBg} px-6 py-5 border-b ${meta.borderColor}`}>
        <div className={`flex items-center gap-2 text-xs font-semibold ${meta.accentText}`}>
          <StatusIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {meta.label}
            {lookup.status === 'waitlist' && lookup.waitlistOrder > 0
              ? ` · ${lookup.waitlistOrder}. Sıra`
              : ''}
          </span>
        </div>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          {meta.headline}
        </h2>
        <p className="mt-2 text-sm sm:text-base text-neutral-800 leading-relaxed font-medium">
          {primaryMessage}
        </p>
      </div>

      {/* Application Metadata Grid */}
      <div className="p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
          {lookup.parentDisplayName ? (
            <div>
              <dt className="text-xs font-medium text-neutral-500">Veli</dt>
              <dd className="mt-1 font-medium text-neutral-900">{lookup.parentDisplayName}</dd>
            </div>
          ) : null}

          {lookup.studentFirstName ? (
            <div>
              <dt className="text-xs font-medium text-neutral-500">Öğrenci</dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {lookup.studentFirstName}
                {lookup.gradeLevel ? (
                  <span className="text-neutral-500 font-normal"> · {lookup.gradeLevel}</span>
                ) : null}
              </dd>
            </div>
          ) : null}

          <div>
            <dt className="text-xs font-medium text-neutral-500">Sorgulanan Telefon</dt>
            <dd className="mt-1 font-mono tabular-nums text-neutral-900">{phoneDisplay}</dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-neutral-500">Danışman</dt>
            <dd className="mt-1 font-medium text-neutral-900">{settings.advisorName}</dd>
          </div>

          {lookup.status !== 'rejected' ? (
            <>
              <div>
                <dt className="text-xs font-medium text-neutral-500">İlk Etkinlik Tarihi</dt>
                <dd className="mt-1 font-medium text-neutral-900">{displayDate}</dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-neutral-500">Etkinlik Saati</dt>
                <dd className="mt-1 font-mono tabular-nums font-medium text-neutral-900">
                  {displaySession}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-neutral-500">Yer</dt>
                <dd className="mt-1 font-medium text-neutral-900">{displayLocation}</dd>
              </div>
            </>
          ) : null}
        </dl>

        {/* Functional Actions */}
        <div className="no-print mt-6 pt-5 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {lookup.status === 'approved' ? (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  Katılım Bilgisini Yazdır
                </button>
                <button
                  type="button"
                  onClick={() => downloadWorkshopCalendarIcs(lookup, settings)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                  Takvime Ekle
                </button>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] rounded-lg"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Yeni Sorgulama
          </button>
        </div>
      </div>
    </div>
  );
}
