import { Camera, Pause, Volume2, VolumeX } from 'lucide-react';
import type { MotorcycleSpec } from '../moto/catalog';
import type { RideInput } from '../moto/physics';
import type { RiderProfile } from './LoginScreen';
import type { CameraViewMode, LiveHudMetrics } from './MotoViewport';

interface RideHudProps {
  rider: RiderProfile;
  bike: MotorcycleSpec;
  metrics: LiveHudMetrics;
  cameraMode: CameraViewMode;
  isMuted: boolean;
  nearMissBanner: string;
  onCycleCamera: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  touchInputRef: React.MutableRefObject<Partial<RideInput>>;
}

export default function RideHud({
  rider,
  bike,
  metrics,
  cameraMode,
  isMuted,
  nearMissBanner,
  onCycleCamera,
  onToggleMute,
  onPause,
  touchInputRef,
}: RideHudProps) {
  const rpmRatio = Math.min(1, metrics.rpm / Math.max(1, metrics.redlineRpm));
  const integrityColor =
    metrics.integrity > 60
      ? 'bg-emerald-400'
      : metrics.integrity > 30
        ? 'bg-amber-400'
        : 'bg-rose-500';

  const cameraLabel =
    cameraMode === 'chase'
      ? 'Chase Cam'
      : cameraMode === 'cockpit'
        ? 'Stang / Kokpit'
        : 'Sudut Samping';

  const setTouch = (key: keyof RideInput, active: boolean) => {
    touchInputRef.current[key] = active;
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Top Row: Integrity & Bike Info (Left) + Utility Controls (Right) */}
      <div className="flex items-start justify-between gap-4">
        <div
          className="rounded-lg border border-white/12 px-4 py-2.5"
          style={{ backgroundColor: 'rgba(11, 14, 20, 0.82)' }}
        >
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-white">{bike.brand} {bike.model}</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400">{rider.name}</span>
          </div>

          <div className="mt-2 flex items-center gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Kondisi
            </span>
            <div className="w-28 h-2 rounded-sm bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${integrityColor}`}
                style={{ width: `${metrics.integrity}%` }}
              />
            </div>
            <span className="text-xs font-mono-tabular font-bold text-white">
              {metrics.integrity}%
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleCamera();
            }}
            aria-label={`Ganti kamera (${cameraLabel})`}
            className="h-10 px-3 rounded-lg border border-white/12 flex items-center gap-2 text-xs font-medium text-slate-100 hover:text-white transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(11, 14, 20, 0.82)' }}
          >
            <Camera className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">{cameraLabel} [C]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={isMuted ? 'Aktifkan audio [M]' : 'Bisukan audio [M]'}
            className="w-10 h-10 rounded-lg border border-white/12 flex items-center justify-center text-slate-100 hover:text-white transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(11, 14, 20, 0.82)' }}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Jeda simulasi [Esc]"
            className="w-10 h-10 rounded-lg border border-white/12 flex items-center justify-center text-slate-100 hover:text-white transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(11, 14, 20, 0.82)' }}
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Near-Miss Feedback (kept above center clear of playfield) */}
      {nearMissBanner && (
        <div className="self-center -mt-20">
          <div
            className="rounded-lg border border-amber-400/40 px-4 py-1.5 text-sm font-display font-bold text-amber-300"
            style={{ backgroundColor: 'rgba(11, 14, 20, 0.88)' }}
          >
            {nearMissBanner}
          </div>
        </div>
      )}

      {/* Bottom Telemetry Cluster, Pedal Buttons & Control Hint */}
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          {/* Touch Steering on Mobile Only */}
          <div className="pointer-events-auto flex md:hidden items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={() => setTouch('left', true)}
              onPointerUp={() => setTouch('left', false)}
              onPointerLeave={() => setTouch('left', false)}
              onPointerCancel={() => setTouch('left', false)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Belok kiri"
              className="w-12 h-12 rounded-lg border border-white/15 text-white font-bold text-lg touch-none select-none cursor-pointer"
              style={{ backgroundColor: 'rgba(11, 14, 20, 0.84)' }}
            >
              ←
            </button>
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={() => setTouch('right', true)}
              onPointerUp={() => setTouch('right', false)}
              onPointerLeave={() => setTouch('right', false)}
              onPointerCancel={() => setTouch('right', false)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Belok kanan"
              className="w-12 h-12 rounded-lg border border-white/15 text-white font-bold text-lg touch-none select-none cursor-pointer"
              style={{ backgroundColor: 'rgba(11, 14, 20, 0.84)' }}
            >
              →
            </button>
          </div>

          {/* Score & Distance (Bottom-Left on Desktop) */}
          <div
            className="hidden md:flex items-center gap-6 rounded-lg border border-white/12 px-4 py-2.5"
            style={{ backgroundColor: 'rgba(11, 14, 20, 0.82)' }}
          >
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Jarak</div>
              <div className="text-lg font-bold font-mono-tabular text-white">
                {metrics.distanceKm.toFixed(2)} <span className="text-xs text-slate-400">KM</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Skor</div>
              <div className="text-lg font-bold font-mono-tabular text-amber-400">
                {metrics.score}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Salip Tipis</div>
              <div className="text-lg font-bold font-mono-tabular text-white">
                {metrics.nearMissCount}x
              </div>
            </div>
          </div>

          {/* Bottom-Right: Digital TFT Speedometer + Compact Gas / Brake / Nitro Pedals */}
          <div className="flex flex-col sm:flex-row items-end gap-2.5">
            {/* Digital TFT Speedometer & Gear Cluster */}
            <div
              className="rounded-xl border border-white/12 px-4 sm:px-5 py-2.5 sm:py-3 min-w-[205px] sm:min-w-[225px]"
              style={{ backgroundColor: 'rgba(11, 14, 20, 0.86)' }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <div
                    className="font-display text-3xl sm:text-4xl font-bold tabular-nums leading-none text-white"
                    style={{ textShadow: '0 2px 10px rgba(0,0,0,0.65)' }}
                  >
                    {metrics.speedKmh}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                    KM/JAM
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">Gear</div>
                  <div className="font-display text-2xl font-bold font-mono-tabular text-amber-400 leading-none">
                    {metrics.gear === 0 ? 'N' : metrics.gear}
                  </div>
                </div>
              </div>

              {/* RPM Bar */}
              <div className="mt-2">
                <div className="flex justify-between text-[11px] font-mono-tabular text-slate-400 mb-1">
                  <span>{metrics.rpm} RPM</span>
                  <span>NOS {metrics.nitroFuel}%</span>
                </div>
                <div className="w-full h-2 rounded-sm bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      rpmRatio > 0.85 ? 'bg-rose-500' : rpmRatio > 0.65 ? 'bg-amber-400' : 'bg-sky-400'
                    }`}
                    style={{ width: `${Math.round(rpmRatio * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Always-Visible Compact Gas, Brake & Nitro Buttons */}
            <div
              className="pointer-events-auto flex items-stretch gap-1.5 rounded-xl border border-white/12 p-1.5"
              style={{ backgroundColor: 'rgba(11, 14, 20, 0.86)' }}
            >
              <button
                type="button"
                tabIndex={-1}
                data-control="brake"
                onPointerDown={(e) => {
                  e.currentTarget.blur();
                  setTouch('brake', true);
                }}
                onPointerUp={() => setTouch('brake', false)}
                onPointerLeave={() => setTouch('brake', false)}
                onPointerCancel={() => setTouch('brake', false)}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="Rem motor"
                className={`w-14 sm:w-[60px] h-14 sm:h-[76px] rounded-lg border flex flex-col items-center justify-center gap-0.5 font-display font-bold transition-transform touch-none select-none cursor-pointer ${
                  metrics.activeBrake
                    ? 'bg-rose-600 border-rose-400 text-white scale-95'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-200 hover:bg-rose-900/70'
                }`}
              >
                <span className="text-xs tracking-wider">REM</span>
                <span className="text-[10px] font-mono-tabular opacity-75">S/↓</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                data-control="throttle"
                onPointerDown={(e) => {
                  e.currentTarget.blur();
                  setTouch('throttle', true);
                }}
                onPointerUp={() => setTouch('throttle', false)}
                onPointerLeave={() => setTouch('throttle', false)}
                onPointerCancel={() => setTouch('throttle', false)}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="Gas motor"
                className={`w-16 sm:w-[68px] h-14 sm:h-[76px] rounded-lg border flex flex-col items-center justify-center gap-0.5 font-display font-bold transition-transform touch-none select-none cursor-pointer ${
                  metrics.activeThrottle
                    ? 'bg-emerald-500 border-emerald-300 text-slate-950 scale-95'
                    : 'bg-emerald-600/90 border-emerald-400/50 text-white hover:bg-emerald-500'
                }`}
              >
                <span className="text-xs tracking-wider">GAS</span>
                <span className="text-[10px] font-mono-tabular opacity-80">W/↑</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                data-control="nitro"
                onPointerDown={(e) => {
                  e.currentTarget.blur();
                  setTouch('nitro', true);
                }}
                onPointerUp={() => setTouch('nitro', false)}
                onPointerLeave={() => setTouch('nitro', false)}
                onPointerCancel={() => setTouch('nitro', false)}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="Aktifkan Nitro"
                className={`w-14 sm:w-[60px] h-14 sm:h-[76px] rounded-lg border flex flex-col items-center justify-center gap-0.5 font-display font-bold transition-transform touch-none select-none cursor-pointer ${
                  metrics.isNitroActive || metrics.activeNitro
                    ? 'bg-sky-400 border-sky-200 text-slate-950 scale-95'
                    : metrics.nitroFuel >= 5
                      ? 'bg-sky-950/70 border-sky-400/45 text-sky-200 hover:bg-sky-900/80'
                      : 'bg-slate-900/60 border-white/10 text-slate-500'
                }`}
              >
                <span className="text-xs tracking-wider">NOS</span>
                <span className="text-[10px] font-mono-tabular">{metrics.nitroFuel}%</span>
              </button>
            </div>
          </div>
        </div>

        <div className="hidden md:block text-center text-xs text-slate-300/90" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          W/↑ atau Tombol GAS · S/↓ atau REM · A/D Belok · Shift/Spasi/NOS Nitro · C Kamera · M Audio · Esc Jeda
        </div>
      </div>
    </div>
  );
}
