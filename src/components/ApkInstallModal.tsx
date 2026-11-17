import { Check, Copy, Download, Smartphone, X } from 'lucide-react';
import { useState } from 'react';

interface ApkInstallModalProps {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstallPwa: () => Promise<boolean>;
  onClose: () => void;
}

export default function ApkInstallModal({
  isInstallable,
  isInstalled,
  isIOS,
  onInstallPwa,
  onClose,
}: ApkInstallModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const capCmd =
    'npm run build && npm i @capacitor/core @capacitor/android && npx cap add android && npx cap sync && cd android && ./gradlew assembleRelease';

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 8, 12, 0.82)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/15 p-6 shadow-2xl"
        style={{ backgroundColor: '#121722' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 id="apk-modal-title" className="font-display text-xl font-bold text-white">
                Pasang di Android / Build APK Ringan
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Aset 3D dibangun secara prosedural tanpa file model eksternal besar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal APK"
            className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {/* Option 1: Instant WebAPK / PWA Install */}
          <div className="rounded-xl border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  1. Instal Langsung di Android (WebAPK ~1.5 MB)
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Berjalan layar penuh (standalone), ikon di layar utama, dan mendukung mode offline.
                </p>
              </div>
              {isInstalled ? (
                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold shrink-0">
                  Terpasang
                </span>
              ) : isInstallable ? (
                <button
                  type="button"
                  onClick={() => void onInstallPwa()}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Pasang App
                </button>
              ) : null}
            </div>
            {!isInstallable && !isInstalled && (
              <p className="text-[11px] text-amber-300/90 mt-2">
                {isIOS
                  ? 'Di Safari iOS: ketuk tombol Share lalu pilih "Add to Home Screen".'
                  : 'Buka URL aplikasi ini di Chrome Android, lalu ketuk menu ⋮ → "Tambahkan ke Layar Utama / Instal Aplikasi".'}
              </p>
            )}
          </div>

          {/* Option 2: Native APK via PWABuilder / Capacitor */}
          <div className="rounded-xl border border-white/10 bg-white/4 p-4 space-y-2.5">
            <div className="text-sm font-semibold text-white">
              2. Kemas Menjadi File .APK Native (~3–4 MB)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Karena container web tidak memiliki Android SDK/Gradle, gunakan konfigurasi{' '}
              <code className="text-slate-200">capacitor.config.json</code> yang sudah tersedia atau
              masukkan URL aplikasi ke{' '}
              <span className="text-slate-200 font-medium">pwabuilder.com</span> untuk mengunduh{' '}
              <code className="text-slate-200">.apk</code> siap pasang:
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                aria-label="URL Aplikasi PWA"
                className="flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-1.5 text-xs font-mono-tabular text-slate-200 outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCopy(appUrl, 'url')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/16 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer"
              >
                {copiedId === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'url' ? 'Disalin' : 'Salin URL'}
              </button>
            </div>

            <div className="rounded-lg bg-black/45 border border-white/10 p-2.5 flex items-center justify-between gap-2">
              <code className="text-[11px] font-mono-tabular text-slate-300 overflow-x-auto whitespace-nowrap">
                {capCmd}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy(capCmd, 'cmd')}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/16 text-[11px] text-white shrink-0 cursor-pointer"
              >
                {copiedId === 'cmd' ? 'Disalin' : 'Salin'}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-white text-slate-950 hover:bg-slate-200 py-2.5 text-sm font-bold transition-colors cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
