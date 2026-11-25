import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID, type FirestoreErrorInfo } from '../firebase';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
  isFreeReadQuota: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isQuotaError: false,
      isFreeReadQuota: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'Beklenmeyen bir hata oluştu.';
    try {
      const parsed = JSON.parse(error.message) as Partial<FirestoreErrorInfo>;
      if (parsed && typeof parsed.error === 'string') {
        message = parsed.error;
      }
    } catch {
      // Non-JSON error message
    }

    const lower = message.toLowerCase();
    const isQuotaError = lower.includes('quota exceeded') || lower.includes('resource-exhausted');
    const isFreeReadQuota = message.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
    );

    return {
      hasError: true,
      errorMessage: message,
      isQuotaError,
      isFreeReadQuota,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  handleReload = (): void => {
    this.setState({
      hasError: false,
      errorMessage: '',
      isQuotaError: false,
      isFreeReadQuota: false,
    });
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const upgradeUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;

    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-neutral-200 rounded-xl p-8">
          <div className="flex items-center gap-3 text-amber-800 mb-4">
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-neutral-900">Bir sorun oluştu</h1>
          </div>

          {this.state.isQuotaError ? (
            <div className="space-y-3 text-sm text-neutral-600 leading-relaxed">
              <p>
                Günlük ücretsiz veritabanı kullanım kotasına ulaşıldı. Kota ertesi gün otomatik
                olarak yenilenecektir.
              </p>
              {this.state.isFreeReadQuota ? (
                <p>
                  Kapasiteyi yükseltmek için{' '}
                  <a
                    href={upgradeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1D4ED8] underline underline-offset-4 hover:text-[#1E40AF]"
                  >
                    Firebase veritabanı panelini
                  </a>{' '}
                  açabilirsiniz.
                </p>
              ) : (
                <p>
                  Ayrıntılı kota bilgileri için{' '}
                  <a
                    href="https://firebase.google.com/pricing#cloud-firestore"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1D4ED8] underline underline-offset-4 hover:text-[#1E40AF]"
                  >
                    Firebase fiyatlandırma sayfasını
                  </a>{' '}
                  inceleyebilirsiniz.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-600 leading-relaxed">
              İşlem tamamlanırken beklenmeyen bir bağlantı veya yetki hatası oluştu. Lütfen sayfayı
              yenileyip tekrar deneyin.
            </p>
          )}

          <div className="mt-6 pt-6 border-t border-neutral-200 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Sayfayı Yenile
            </button>
          </div>
        </div>
      </div>
    );
  }
}
