import { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicAnnouncementView } from './components/PublicAnnouncementView';
import { DEFAULT_WORKSHOP_SETTINGS, type WorkshopSettings } from './types';

function AppShell() {
  const [settings] = useState<WorkshopSettings>(DEFAULT_WORKSHOP_SETTINGS);

  const handleNavClick = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFocusLookup = () => {
    document.getElementById('sorgulama')?.scrollIntoView({ behavior: 'smooth' });
    window.setTimeout(() => {
      document.getElementById('phone-lookup-input')?.focus();
    }, 220);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#111827]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => handleNavClick('sorgulama')}
            className="font-display text-lg font-semibold tracking-tight text-neutral-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] rounded-sm"
          >
            Elazığ BİLSEM
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Ana menü"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600"
          >
            <button
              type="button"
              onClick={() => handleNavClick('sorgulama')}
              className="hover:text-neutral-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Sorgulama
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('bilgiler')}
              className="hover:text-neutral-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Bilgiler
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('etkinlikler')}
              className="hover:text-neutral-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Etkinlikler
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleFocusLookup}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
            >
              Durum Sorgula
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <PublicAnnouncementView settings={settings} settingsLoading={false} />
      </div>

      {/* Quiet Editorial Footer */}
      <footer className="no-print border-t border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-neutral-500">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display font-semibold text-neutral-900">
              Elazığ Bilim ve Sanat Merkezi
            </span>
            <span aria-hidden="true">·</span>
            <span>{settings.title}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Danışman:</span>
            <span className="font-medium text-neutral-800">{settings.advisorName}</span>
            <span aria-hidden="true">·</span>
            <span>2026–2027</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
