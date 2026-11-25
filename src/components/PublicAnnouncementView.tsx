import React, { useState } from 'react';
import { AlertCircle, Loader2, Phone, Search, Shapes } from 'lucide-react';
import { lookupStatusByPhone } from '../services/workshopService';
import type { StatusLookup, WorkshopSettings } from '../types';
import { formatPhoneAsTyping, normalizeTurkishPhone } from '../utils/phone';
import { StatusResultCard } from './StatusResultCard';

const POSTER_IMAGE_PATH = '/assets/aistudio/VEL__KATILIM_DUYURU_29448191.jpg';

interface PublicAnnouncementViewProps {
  settings: WorkshopSettings;
  settingsLoading: boolean;
}

const WORKSHOP_ACTIVITIES = [
  {
    index: '01.',
    label: '1. Etkinlik',
    title: 'Fibonacci Sayıları ve Altın Oran',
    date: '27.11.2026',
    time: '15.00 – 16.20',
  },
  {
    index: '02.',
    label: '2. Etkinlik',
    title: 'Sihirli Kareler',
    date: '04.12.2026',
    time: '15.00 – 16.20',
  },
  {
    index: '03.',
    label: '3. Etkinlik',
    title: 'Topoloji Deneyleri (Möbius Şeridi, İmkânsız Kâğıt)',
    date: '11.12.2026',
    time: '15.00 – 16.20',
  },
  {
    index: '04.',
    label: '4. Etkinlik',
    title: 'String Art (İplik Sanatı)',
    date: '18.12.2026',
    time: '15.00 – 16.20',
  },
];

export function PublicAnnouncementView({
  settings,
  settingsLoading,
}: PublicAnnouncementViewProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    found: boolean;
    data?: StatusLookup;
    phoneDisplay: string;
  } | null>(null);
  const [posterImgFailed, setPosterImgFailed] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneInput(formatPhoneAsTyping(e.target.value));
    if (validationError) setValidationError(null);
    if (lookupError) setLookupError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setLookupError(null);

    const normalized = normalizeTurkishPhone(phoneInput);
    if (!normalized) {
      setValidationError(
        'Lütfen geçerli bir 10 haneli cep telefonu numarası girin (ör. 05XX XXX XX XX).'
      );
      return;
    }

    setIsSearching(true);
    try {
      const response = await lookupStatusByPhone(phoneInput);
      setResult({
        found: response.found,
        data: response.data,
        phoneDisplay: response.phoneDisplay || phoneInput,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_PHONE') {
        setValidationError('Lütfen geçerli bir cep telefonu numarası girin.');
      } else {
        setLookupError(
          'Sorgulama sırasında bir bağlantı hatası oluştu. Lütfen birkaç saniye sonra tekrar deneyin.'
        );
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetLookup = () => {
    setResult(null);
    setPhoneInput('');
    setValidationError(null);
    setLookupError(null);
  };

  return (
    <main>
      {/* Hero Split Section */}
      <section id="sorgulama" className="max-w-6xl mx-auto px-6 pt-10 pb-14 lg:pt-12 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Column: Poster Title, Purpose & Phone Lookup */}
          <div className="lg:col-span-7 flex flex-col gap-7">
            <div>
              <div className="text-xs font-medium text-neutral-500 flex flex-wrap items-center gap-2">
                <span>{settings.termLabel}</span>
                <span aria-hidden="true">·</span>
                <span>Danışman: {settings.advisorName}</span>
              </div>

              <h1
                className="mt-3 font-display font-semibold tracking-tight text-neutral-900 leading-[1.12]"
                style={{
                  fontSize: 'clamp(2.1rem, 3.6vw, 3.15rem)',
                  textWrap: 'balance',
                }}
              >
                {settings.title}
              </h1>

              <p className="mt-4 text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl">
                {settings.subtitle}
              </p>
            </div>

            {/* Lookup Panel or Live Result */}
            <div className="w-full">
              {!settingsLoading && !settings.resultsPublished ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <AlertCircle className="w-4 h-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
                    <span>Başvuru sonuçları henüz yayına açılmadı</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                    Başvurular değerlendirilmektedir. Sonuçlar açıklandığında telefon numaranızla bu
                    ekrandan sorgulama yapabileceksiniz.
                  </p>
                </div>
              ) : result?.found && result.data ? (
                <StatusResultCard
                  lookup={result.data}
                  phoneDisplay={result.phoneDisplay}
                  settings={settings}
                  onReset={handleResetLookup}
                />
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl p-6 sm:p-7">
                  <form onSubmit={handleSubmit} noValidate>
                    <label
                      htmlFor="phone-lookup-input"
                      className="block text-sm font-semibold text-neutral-900"
                    >
                      Başvuru Durumu Sorgulama
                    </label>
                    <p className="mt-1 text-xs text-neutral-500">
                      Başvuru formunda paylaştığınız cep telefonu numaranızı yazarak atölye başvuru
                      durumunuzu görüntüleyebilirsiniz.
                    </p>

                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Phone
                          className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="phone-lookup-input"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={phoneInput}
                          onChange={handlePhoneChange}
                          placeholder="05XX XXX XX XX"
                          aria-invalid={Boolean(validationError)}
                          aria-describedby="phone-lookup-help"
                          className="w-full h-12 pl-10 pr-4 font-mono tabular-nums text-base text-neutral-900 placeholder:text-neutral-400 bg-[#F8F9FA] border border-neutral-300 rounded-lg focus:bg-white focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 transition-colors"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSearching}
                        className="h-12 px-6 inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                      >
                        {isSearching ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            Sorgulanıyor
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4" aria-hidden="true" />
                            Durumu Sorgula
                          </>
                        )}
                      </button>
                    </div>

                    {validationError ? (
                      <p role="alert" className="mt-3 text-xs font-medium text-red-700">
                        {validationError}
                      </p>
                    ) : null}

                    {lookupError ? (
                      <p role="alert" className="mt-3 text-xs font-medium text-red-700">
                        {lookupError}
                      </p>
                    ) : null}

                    <p id="phone-lookup-help" className="mt-3 text-xs text-neutral-500">
                      Başında 0 ile veya 0 olmadan 10 haneli olarak girebilirsiniz.
                    </p>
                  </form>

                  {/* Not Found Feedback — Exact Requested Message */}
                  {result && !result.found ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mt-5 pt-5 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                          <AlertCircle
                            className="w-4 h-4 text-amber-700 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Başvurunuz Bulunmamaktadır.</span>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Sorgulanan numara:{' '}
                          <span className="font-mono tabular-nums text-neutral-700">
                            {result.phoneDisplay}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetLookup}
                        className="text-xs font-medium text-[#1D4ED8] hover:text-[#1E40AF] underline underline-offset-4 whitespace-nowrap shrink-0 self-start sm:self-center"
                      >
                        Yeni Sorgulama
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Official Uploaded Poster */}
          <div className="no-print lg:col-span-5">
            <div className="rounded-xl overflow-hidden border border-neutral-200 bg-white">
              {!posterImgFailed ? (
                <img
                  src={POSTER_IMAGE_PATH}
                  alt="Elazığ Bilim ve Sanat Merkezi Aile Atölyeleri ile Matematiği Birlikte İnşa Edelim duyuru afişi"
                  referrerPolicy="no-referrer"
                  onError={() => setPosterImgFailed(true)}
                  className="w-full h-auto object-contain block"
                />
              ) : (
                <div className="w-full aspect-[3/4] flex flex-col items-center justify-center p-8 text-center bg-neutral-100">
                  <Shapes className="w-10 h-10 text-neutral-400 mb-3" aria-hidden="true" />
                  <span className="font-display font-medium text-neutral-700">
                    {settings.title}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Key Workshop Info Strip (Directly matching focused #bilgiler elements) */}
        <div
          id="bilgiler"
          className="no-print mt-12 pt-8 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          <div>
            <div className="text-xs font-medium text-neutral-500">Etkinlik Tarihleri ve Saati</div>
            <div className="mt-1.5 text-sm font-semibold text-neutral-900 tabular-nums">
              {settings.workshopDate}
            </div>
            <div className="mt-0.5 text-xs font-mono tabular-nums text-neutral-600">
              Saat: {settings.sessionsSummary}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-neutral-500">Danışman</div>
            <div className="mt-1.5 text-sm font-semibold text-neutral-900">
              {settings.advisorName}
            </div>
            <div className="mt-0.5 text-xs text-neutral-600">Elazığ Bilim ve Sanat Merkezi</div>
          </div>

          <div>
            <div className="text-xs font-medium text-neutral-500">Yer</div>
            <div className="mt-1.5 text-sm font-semibold text-neutral-900">
              {settings.location}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-neutral-500">Hedef Kitle</div>
            <div className="mt-1.5 text-sm font-semibold text-neutral-900 leading-snug">
              {settings.ageGroup}
            </div>
          </div>
        </div>

        {/* Compact Single-Page Activities & Dates Schedule from Poster */}
        <div
          id="etkinlikler"
          className="no-print mt-12 pt-10 border-t border-neutral-200 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          <div className="lg:col-span-4">
            <div className="text-xs font-medium text-neutral-500">Etkinlik Programı · 4 Hafta</div>
            <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight text-neutral-900">
              Etkinlikler ve Tarihler
            </h2>
            <p className="mt-2.5 text-sm text-neutral-600 leading-relaxed">
              Tüm oturumlar Cuma günleri{' '}
              <span className="font-mono tabular-nums font-medium text-neutral-800">
                15.00 – 16.20
              </span>{' '}
              saatleri arasında {settings.location} alanında gerçekleştirilecektir.
            </p>
          </div>

          <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-200">
            {WORKSHOP_ACTIVITIES.map((activity) => (
              <div
                key={activity.index}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono tabular-nums text-xs font-medium text-neutral-400 shrink-0">
                    {activity.index}
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-neutral-900">
                    {activity.title}
                  </span>
                </div>
                <div className="pl-7 sm:pl-0 flex items-center gap-2 text-xs font-mono tabular-nums text-neutral-600 whitespace-nowrap shrink-0">
                  <span className="font-medium text-neutral-900">{activity.date}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
