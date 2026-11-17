/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ApkInstallModal from './components/ApkInstallModal';
import GarageOverlay from './components/GarageOverlay';
import LoginScreen, { type RiderProfile } from './components/LoginScreen';
import MotoViewport, {
  type AppPhase,
  type CameraViewMode,
  type CrashSummary,
  type LiveHudMetrics,
} from './components/MotoViewport';
import RideHud from './components/RideHud';
import { CrashModal, PauseModal } from './components/StatusModals';
import { usePWAInstall } from './hooks/usePWAInstall';
import { MotoAudioEngine } from './moto/audio';
import {
  applyBikeModsToSpec,
  DEFAULT_BIKE_MODS,
  getBikeById,
  type BikeId,
  type BikeMods,
} from './moto/catalog';
import type { RideInput } from './moto/physics';

const INITIAL_METRICS: LiveHudMetrics = {
  speedKmh: 50,
  rpm: 3200,
  redlineRpm: 10500,
  gear: 2,
  nitroFuel: 100,
  isNitroActive: false,
  integrity: 100,
  distanceKm: 0,
  score: 0,
  nearMissCount: 0,
  comboMultiplier: 1,
  activeThrottle: false,
  activeBrake: false,
  activeNitro: false,
};

function getInitialAutostart(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  } catch {
    return false;
  }
}

function loadSavedBestScore(): number {
  try {
    const raw = localStorage.getItem('motoapex_best_score');
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

export default function App() {
  const autostart = useMemo(() => getInitialAutostart(), []);

  const [phase, setPhase] = useState<AppPhase>(autostart ? 'playing' : 'login');
  const [rider, setRider] = useState<RiderProfile>({
    name: autostart ? 'Raka Pratama' : '',
    plate: 'B 4015 ZX',
  });
  const [selectedBikeId, setSelectedBikeId] = useState<BikeId>('r15m');
  const [liveryIndex, setLiveryIndex] = useState(0);
  const [mods, setMods] = useState<BikeMods>(DEFAULT_BIKE_MODS);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');
  const [rideSessionId, setRideSessionId] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showRiderInGarage, setShowRiderInGarage] = useState(true);
  const [showApkModal, setShowApkModal] = useState(false);

  const [metrics, setMetrics] = useState<LiveHudMetrics>(INITIAL_METRICS);
  const [crashSummary, setCrashSummary] = useState<CrashSummary | null>(null);
  const [bestScore, setBestScore] = useState<number>(() => loadSavedBestScore());
  const [nearMissBanner, setNearMissBanner] = useState('');

  const pwa = usePWAInstall();

  const audioRef = useRef<MotoAudioEngine | null>(null);
  if (!audioRef.current) {
    audioRef.current = new MotoAudioEngine();
  }
  const touchInputRef = useRef<Partial<RideInput>>({});
  const nearMissTimerRef = useRef<number | null>(null);

  const selectedBike = useMemo(
    () => applyBikeModsToSpec(getBikeById(selectedBikeId), mods),
    [selectedBikeId, mods],
  );

  // Mirror state machine to document.body.dataset.state
  useEffect(() => {
    const mappedState =
      phase === 'login' || phase === 'garage'
        ? 'title'
        : phase === 'playing'
          ? 'playing'
          : phase === 'paused'
            ? 'paused'
            : 'gameover';
    document.body.dataset.state = mappedState;
  }, [phase]);

  useEffect(() => {
    return () => {
      if (nearMissTimerRef.current) clearTimeout(nearMissTimerRef.current);
      audioRef.current?.dispose();
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    audioRef.current?.unlock();
    setIsMuted((prev) => {
      const next = !prev;
      audioRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleCycleCamera = useCallback(() => {
    setCameraMode((prev) =>
      prev === 'chase' ? 'cockpit' : prev === 'cockpit' ? 'action' : 'chase',
    );
  }, []);

  const handleLogin = useCallback((profile: RiderProfile) => {
    audioRef.current?.unlock();
    setRider(profile);
    setPhase('garage');
  }, []);

  const handleSelectBike = useCallback((id: BikeId) => {
    audioRef.current?.unlock();
    setSelectedBikeId(id);
    setLiveryIndex(0);
  }, []);

  const handleStartRide = useCallback(() => {
    audioRef.current?.unlock();
    touchInputRef.current = {};
    setCrashSummary(null);
    setNearMissBanner('');
    setMetrics({
      ...INITIAL_METRICS,
      redlineRpm: getBikeById(selectedBikeId).redlineRpm,
    });
    setRideSessionId((s) => s + 1);
    setPhase('playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [selectedBikeId]);

  const handleCrash = useCallback((summary: CrashSummary) => {
    setCrashSummary(summary);
    setBestScore((prev) => {
      const updated = Math.max(prev, summary.score);
      try {
        localStorage.setItem('motoapex_best_score', String(updated));
      } catch {
        // ignore storage restrictions
      }
      return updated;
    });
    setPhase('gameover');
  }, []);

  const handleNearMissEvent = useCallback((combo: number) => {
    setNearMissBanner(`SALIP TIPIS! +${120 * combo} (${combo}x)`);
    if (nearMissTimerRef.current) clearTimeout(nearMissTimerRef.current);
    nearMissTimerRef.current = window.setTimeout(() => {
      setNearMissBanner('');
    }, 1200);
  }, []);

  // Global hotkeys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (phase === 'garage' && !showApkModal && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartRide();
        return;
      }

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (phase === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          audioRef.current?.silence();
          setPhase('paused');
        } else if (e.code === 'KeyC') {
          handleCycleCamera();
        }
      } else if (phase === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setPhase('playing');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, showApkModal, handleStartRide, handleToggleMute, handleCycleCamera]);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0B0E14]">
      <MotoViewport
        phase={phase}
        selectedBikeId={selectedBikeId}
        liveryIndex={liveryIndex}
        mods={mods}
        cameraMode={cameraMode}
        showRiderInGarage={showRiderInGarage}
        rideSessionId={rideSessionId}
        audio={audioRef.current}
        touchInputRef={touchInputRef}
        onHudTick={setMetrics}
        onCrash={handleCrash}
        onNearMissEvent={handleNearMissEvent}
      />

      {phase === 'login' && <LoginScreen onLogin={handleLogin} />}

      {phase === 'garage' && (
        <GarageOverlay
          rider={rider}
          selectedBike={selectedBike}
          liveryIndex={liveryIndex}
          mods={mods}
          isMuted={isMuted}
          showRider={showRiderInGarage}
          onSelectBike={handleSelectBike}
          onSelectLivery={setLiveryIndex}
          onChangeMods={setMods}
          onToggleMute={handleToggleMute}
          onToggleRider={() => setShowRiderInGarage((prev) => !prev)}
          onOpenApkModal={() => setShowApkModal(true)}
          onStartRide={handleStartRide}
          onLogout={() => setPhase('login')}
        />
      )}

      {(phase === 'playing' || phase === 'paused') && (
        <RideHud
          rider={rider}
          bike={selectedBike}
          metrics={metrics}
          cameraMode={cameraMode}
          isMuted={isMuted}
          nearMissBanner={nearMissBanner}
          onCycleCamera={handleCycleCamera}
          onToggleMute={handleToggleMute}
          onPause={() => {
            audioRef.current?.silence();
            setPhase('paused');
          }}
          touchInputRef={touchInputRef}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          bike={selectedBike}
          onResume={() => setPhase('playing')}
          onRestart={handleStartRide}
          onOpenGarage={() => setPhase('garage')}
        />
      )}

      {phase === 'gameover' && crashSummary && (
        <CrashModal
          bike={selectedBike}
          summary={crashSummary}
          bestScore={bestScore}
          onRetry={handleStartRide}
          onOpenGarage={() => setPhase('garage')}
        />
      )}

      {showApkModal && (
        <ApkInstallModal
          isInstallable={pwa.isInstallable}
          isInstalled={pwa.isInstalled}
          isIOS={pwa.isIOS}
          onInstallPwa={pwa.install}
          onClose={() => setShowApkModal(false)}
        />
      )}
    </main>
  );
}
