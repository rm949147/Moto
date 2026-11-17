import {
  ChevronDown,
  ChevronUp,
  LogOut,
  Palette,
  Play,
  Sliders,
  Smartphone,
  User,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import {
  CHAIN_MODS,
  EXHAUST_MODS,
  LIGHT_MODS,
  MOD_PRESETS,
  MOTORCYCLE_CATALOG,
  getBikeById,
  getChainMod,
  getExhaustMod,
  getLightMod,
  type BikeId,
  type BikeMods,
  type MotorcycleSpec,
} from '../moto/catalog';
import type { RiderProfile } from './LoginScreen';

type GarageTab = 'bikes' | 'mods' | 'paint';

interface GarageOverlayProps {
  rider: RiderProfile;
  selectedBike: MotorcycleSpec;
  liveryIndex: number;
  mods: BikeMods;
  isMuted: boolean;
  showRider: boolean;
  onSelectBike: (id: BikeId) => void;
  onSelectLivery: (idx: number) => void;
  onChangeMods: (next: BikeMods) => void;
  onToggleMute: () => void;
  onToggleRider: () => void;
  onOpenApkModal: () => void;
  onStartRide: () => void;
  onLogout: () => void;
}

export default function GarageOverlay({
  rider,
  selectedBike,
  liveryIndex,
  mods,
  isMuted,
  showRider,
  onSelectBike,
  onSelectLivery,
  onChangeMods,
  onToggleMute,
  onToggleRider,
  onOpenApkModal,
  onStartRide,
  onLogout,
}: GarageOverlayProps) {
  const [activeTab, setActiveTab] = useState<GarageTab>('bikes');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeLivery =
    selectedBike.liveries[liveryIndex % selectedBike.liveries.length] ?? selectedBike.liveries[0];
  const baseSpec = getBikeById(selectedBike.id);
  const hpGain = Number((selectedBike.horsepowerHp - baseSpec.horsepowerHp).toFixed(1));
  const speedGain = selectedBike.topSpeedKmh - baseSpec.topSpeedKmh;

  const activeExhaust = getExhaustMod(mods.exhaust);
  const activeLight = getLightMod(mods.light);
  const activeChain = getChainMod(mods.chain);

  const isPresetActive = (presetMods: BikeMods) =>
    presetMods.exhaust === mods.exhaust &&
    presetMods.light === mods.light &&
    presetMods.chain === mods.chain;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Slim Top Bar: Compact Specs + Utility Icons */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="pointer-events-auto rounded-xl border border-white/12 px-4 py-2.5 max-w-[420px] shadow-xl"
          style={{ backgroundColor: 'rgba(13, 17, 25, 0.88)' }}
        >
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="font-semibold text-amber-400">{rider.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{rider.plate}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{selectedBike.category}</span>
          </div>

          <div className="flex items-baseline gap-2 mt-0.5">
            <h2 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
              {selectedBike.brand} {selectedBike.model}
            </h2>
            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
              {selectedBike.engineType}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-4 gap-2.5 text-left">
            <div>
              <div className="text-[10px] text-slate-400">Mesin</div>
              <div className="text-xs font-bold font-mono-tabular text-white">
                {selectedBike.displacementCc} cc
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Tenaga</div>
              <div className="text-xs font-bold font-mono-tabular text-white">
                {selectedBike.horsepowerHp} HP
                {hpGain > 0 && <span className="text-[10px] text-emerald-400 ml-1">+{hpGain}</span>}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Top Speed</div>
              <div className="text-xs font-bold font-mono-tabular text-amber-400">
                {selectedBike.topSpeedKmh} km/h
                {speedGain > 0 && <span className="text-[10px] text-emerald-400 ml-1">+{speedGain}</span>}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Bobot</div>
              <div className="text-xs font-bold font-mono-tabular text-white">
                {selectedBike.weightKg} kg
              </div>
            </div>
          </div>
        </div>

        {/* Compact Top-Right Utility Toolbar */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleRider}
            aria-label={showRider ? 'Sembunyikan Rider' : 'Tampilkan Rider'}
            className={`h-9 px-2.5 rounded-lg border border-white/12 flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              showRider ? 'text-amber-300 hover:text-amber-200' : 'text-slate-300 hover:text-white'
            }`}
            style={{ backgroundColor: 'rgba(13, 17, 25, 0.88)' }}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{showRider ? 'Rider: On' : 'Rider: Off'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenApkModal}
            aria-label="Pasang Aplikasi Android atau APK"
            className="h-9 px-2.5 rounded-lg border border-white/12 flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200 transition-colors whitespace-nowrap cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 17, 25, 0.88)' }}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">APK</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Aktifkan suara mesin' : 'Bisukan suara mesin'}
            className="w-9 h-9 rounded-lg border border-white/12 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 17, 25, 0.88)' }}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Keluar ke halaman login"
            className="h-9 px-2.5 rounded-lg border border-white/12 flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 17, 25, 0.88)' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* Single Compact Collapsible Bottom Garage Console */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="pointer-events-auto w-full max-w-[840px] rounded-xl border border-white/12 shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'rgba(13, 17, 25, 0.90)' }}
        >
          {/* Console Header: Mode Tabs + Active Setup Summary + Collapse + Start CTA */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
            <div className="flex items-center gap-1" role="tablist" aria-label="Menu Garasi">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'bikes' && !isCollapsed}
                onClick={() => {
                  setActiveTab('bikes');
                  setIsCollapsed(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'bikes' && !isCollapsed
                    ? 'bg-white text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Motor ({MOTORCYCLE_CATALOG.length})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'mods' && !isCollapsed}
                onClick={() => {
                  setActiveTab('mods');
                  setIsCollapsed(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'mods' && !isCollapsed
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Modifikasi</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'paint' && !isCollapsed}
                onClick={() => {
                  setActiveTab('paint');
                  setIsCollapsed(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'paint' && !isCollapsed
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Warna & Preset</span>
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 px-2 py-1 rounded-md bg-white/5">
                <span className="text-slate-200 font-medium">{activeExhaust.shortName}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: activeLight.swatchHex }}
                  />
                  {activeLight.shortName}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeChain.shortName}</span>
              </div>

              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? 'Buka Panel Garasi' : 'Sembunyikan Panel Garasi'}
                className="h-8 px-2 rounded-lg bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                {isCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Buka</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Lipat</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStartRide();
                }}
                className="h-8 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 px-3.5 text-xs font-bold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Mulai Berkendara</span>
              </button>
            </div>
          </div>

          {/* Expandable Console Body */}
          {!isCollapsed && (
            <div className="p-2.5 sm:p-3">
              {activeTab === 'bikes' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                    <span>Pilih Motor ({MOTORCYCLE_CATALOG.length} model · gulir atas/bawah)</span>
                    <span className="font-mono-tabular text-slate-300">
                      {selectedBike.brand} {selectedBike.model}
                    </span>
                  </div>

                  <div
                    className="garage-scroll max-h-[158px] overflow-y-auto overscroll-contain pr-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2"
                    role="tablist"
                    aria-label="Pilih Motor"
                  >
                    {MOTORCYCLE_CATALOG.map((bike) => {
                      const isSelected = bike.id === selectedBike.id;
                      const leadLivery = bike.liveries[0];
                      return (
                        <button
                          key={bike.id}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => onSelectBike(bike.id)}
                          className={`px-3 py-2 rounded-lg text-left transition-colors cursor-pointer border ${
                            isSelected
                              ? 'bg-white text-slate-950 border-white shadow-sm'
                              : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/25"
                                style={{ backgroundColor: leadLivery.primary }}
                              />
                              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-75 truncate">
                                {bike.brand} · {bike.category}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono-tabular font-semibold shrink-0 opacity-85">
                              {bike.displacementCc}cc
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-2 mt-1">
                            <span className="text-xs sm:text-sm font-bold truncate">
                              {bike.model}
                            </span>
                            <span className="text-[10px] font-mono-tabular shrink-0 opacity-85">
                              {bike.horsepowerHp} HP · {bike.topSpeedKmh} km/h
                            </span>
                          </div>

                          <div className="text-[10px] opacity-70 truncate mt-0.5">
                            {bike.engineType}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick inline livery + preset bar inside Bikes tab */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/8 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Warna:</span>
                      <span className="text-slate-200 font-medium">{activeLivery.name}</span>
                      <div className="flex items-center gap-1.5">
                        {selectedBike.liveries.map((liv, idx) => {
                          const active = idx === liveryIndex % selectedBike.liveries.length;
                          return (
                            <button
                              key={liv.id}
                              type="button"
                              onClick={() => onSelectLivery(idx)}
                              aria-label={`Pilih warna ${liv.name}`}
                              className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                                active ? 'border-white scale-115' : 'border-white/30 hover:scale-105'
                              }`}
                              style={{ backgroundColor: liv.primary }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 mr-1 hidden sm:inline">Preset:</span>
                      {MOD_PRESETS.map((preset) => {
                        const active = isPresetActive(preset.mods);
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => onChangeMods(preset.mods)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                              active
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'mods' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/8">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">Preset Cepat:</span>
                      {MOD_PRESETS.map((preset) => {
                        const active = isPresetActive(preset.mods);
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => onChangeMods(preset.mods)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border ${
                              active
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[11px] font-mono-tabular text-emerald-400">
                      {hpGain > 0 || speedGain > 0
                        ? `Efek Upgrade: +${hpGain} HP · +${speedGain} km/h`
                        : 'Setelan Standar Pabrik · gulir atas/bawah'}
                    </span>
                  </div>

                  <div
                    className="garage-scroll max-h-[172px] overflow-y-auto overscroll-contain pr-1.5 space-y-3"
                    aria-label="Daftar Modifikasi Motor"
                  >
                    {/* Knalpot Racing */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1.5">
                        <span>Knalpot Racing</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          Aktif: {activeExhaust.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {EXHAUST_MODS.map((ex) => {
                          const active = mods.exhaust === ex.id;
                          return (
                            <button
                              key={ex.id}
                              type="button"
                              onClick={() => onChangeMods({ ...mods, exhaust: ex.id })}
                              className={`px-2.5 py-2 rounded-lg text-[11px] text-left transition-colors cursor-pointer border ${
                                active
                                  ? 'bg-rose-600/25 border-rose-500 text-white'
                                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <div className="font-semibold truncate">{ex.name}</div>
                              <div className="text-[10px] font-mono-tabular opacity-80 mt-0.5">
                                {ex.hpBonus > 0
                                  ? `+${ex.hpBonus} HP · +${ex.topSpeedBonus} km/h · +${ex.accelBonus} m/s²`
                                  : 'Spesifikasi Pabrikan (OEM)'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Lampu & DRL */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1.5">
                        <span>Lampu & DRL Projector</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          Aktif: {activeLight.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {LIGHT_MODS.map((lt) => {
                          const active = mods.light === lt.id;
                          return (
                            <button
                              key={lt.id}
                              type="button"
                              onClick={() => onChangeMods({ ...mods, light: lt.id })}
                              className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-2 transition-colors cursor-pointer border ${
                                active
                                  ? 'bg-sky-500/20 border-sky-400 text-white'
                                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0 border border-white/40"
                                style={{ backgroundColor: lt.swatchHex }}
                              />
                              <div className="min-w-0 text-left">
                                <div className="truncate">{lt.name}</div>
                                <div className="text-[10px] font-normal opacity-75">
                                  {lt.shortName} · DRL & Projie
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rantai & Gir */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1.5">
                        <span>Rantai & Gir Belakang</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          Aktif: {activeChain.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {CHAIN_MODS.map((ch) => {
                          const active = mods.chain === ch.id;
                          return (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => onChangeMods({ ...mods, chain: ch.id })}
                              className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-2 transition-colors cursor-pointer border ${
                                active
                                  ? 'bg-amber-500/20 border-amber-400 text-white'
                                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0 border border-white/40"
                                style={{ backgroundColor: ch.swatchHex }}
                              />
                              <div className="min-w-0 text-left">
                                <div className="truncate">{ch.name}</div>
                                <div className="text-[10px] font-normal font-mono-tabular opacity-75">
                                  {ch.accelBonus > 0
                                    ? `+${ch.accelBonus} m/s² Akselerasi`
                                    : 'Rasio Gear Standar'}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'paint' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-white/8">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Livery Resmi {selectedBike.brand} {selectedBike.model}
                    </span>
                    <button
                      type="button"
                      onClick={onToggleRider}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                        showRider
                          ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {showRider ? 'Rider 3D: Tampil' : 'Rider 3D: Sembunyi'}
                    </button>
                  </div>

                  <div className="garage-scroll max-h-[164px] overflow-y-auto overscroll-contain pr-1.5 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedBike.liveries.map((liv, idx) => {
                        const active = idx === liveryIndex % selectedBike.liveries.length;
                        return (
                          <button
                            key={liv.id}
                            type="button"
                            onClick={() => onSelectLivery(idx)}
                            aria-label={`Pilih warna ${liv.name}`}
                            className={`px-3 py-2 rounded-lg text-left transition-colors cursor-pointer border flex items-center gap-2.5 ${
                              active
                                ? 'bg-white/14 border-white text-white'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center -space-x-1 shrink-0">
                              <span
                                className="w-4 h-4 rounded-full border border-white/40"
                                style={{ backgroundColor: liv.primary }}
                              />
                              <span
                                className="w-4 h-4 rounded-full border border-white/40"
                                style={{ backgroundColor: liv.accent }}
                              />
                              <span
                                className="w-4 h-4 rounded-full border border-white/40"
                                style={{ backgroundColor: liv.rimColor }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{liv.name}</div>
                              <div className="text-[10px] text-slate-400">
                                Velg & Fairing Match
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-white/8">
                      <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                        Preset Tampilan & Tuning
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {MOD_PRESETS.map((preset) => {
                          const active = isPresetActive(preset.mods);
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => onChangeMods(preset.mods)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-colors cursor-pointer border ${
                                active
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              {preset.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400">
          Geser 360° untuk inspeksi fairing, knalpot, lampu & rantai · Panel bawah bisa dilipat
        </p>
      </div>
    </div>
  );
}
