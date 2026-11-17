import type { MotorcycleSpec } from '../moto/catalog';
import type { CrashSummary } from './MotoViewport';

interface PauseModalProps {
  bike: MotorcycleSpec;
  onResume: () => void;
  onRestart: () => void;
  onOpenGarage: () => void;
}

export function PauseModal({ bike, onResume, onRestart, onOpenGarage }: PauseModalProps) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 8, 12, 0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/15 p-6 shadow-2xl"
        style={{ backgroundColor: '#111622' }}
      >
        <p className="text-xs font-medium text-amber-400">
          {bike.brand} {bike.model}
        </p>
        <h2 id="pause-modal-title" className="font-display text-2xl font-bold text-white mt-1">
          Simulasi Dijeda
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Lanjutkan perjalanan, ulangi lintasan, atau kembali ke garasi untuk mengganti motor.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            Lanjutkan Berkendara
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            Ulangi Lintasan
          </button>
          <button
            type="button"
            onClick={onOpenGarage}
            className="w-full rounded-lg border border-white/15 bg-transparent hover:bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors cursor-pointer"
          >
            Ganti Motor di Garasi
          </button>
        </div>
      </div>
    </div>
  );
}

interface CrashModalProps {
  bike: MotorcycleSpec;
  summary: CrashSummary;
  bestScore: number;
  onRetry: () => void;
  onOpenGarage: () => void;
}

export function CrashModal({
  bike,
  summary,
  bestScore,
  onRetry,
  onOpenGarage,
}: CrashModalProps) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 8, 12, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crash-modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-rose-500/35 p-6 shadow-2xl"
        style={{ backgroundColor: '#111622' }}
      >
        <p className="text-xs font-semibold text-rose-400">
          Laporan Tabrakan · {bike.brand} {bike.model}
        </p>
        <h2 id="crash-modal-title" className="font-display text-2xl font-bold text-white mt-1">
          Motor Mengalami Tabrakan
        </h2>
        <p className="text-sm text-slate-300 mt-1.5">{summary.cause}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-black/25 p-3.5">
          <div>
            <div className="text-[11px] text-slate-400">Kecepatan Benturan</div>
            <div className="text-lg font-bold font-mono-tabular text-rose-400">
              {summary.impactSpeedKmh} km/h
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Jarak Tempuh</div>
            <div className="text-lg font-bold font-mono-tabular text-white">
              {summary.distanceKm.toFixed(2)} km
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Skor Akhir</div>
            <div className="text-lg font-bold font-mono-tabular text-amber-400">
              {summary.score}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Rekor Terbaik</div>
            <div className="text-lg font-bold font-mono-tabular text-white">
              {bestScore}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onRetry}
            className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
          <button
            type="button"
            onClick={onOpenGarage}
            className="flex-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors cursor-pointer"
          >
            Pilih Motor Lain
          </button>
        </div>
      </div>
    </div>
  );
}
