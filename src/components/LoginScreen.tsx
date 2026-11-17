import { useState, type FormEvent } from 'react';
import { validateRiderLogin } from '../moto/physics';

export interface RiderProfile {
  name: string;
  plate: string;
}

interface LoginScreenProps {
  onLogin: (profile: RiderProfile) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('B 2504 R');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateRiderLogin(name, plate);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError('');
    onLogin({
      name: name.trim(),
      plate: plate.trim().toUpperCase() || 'RIDER-01',
    });
  };

  const handleDemoFill = () => {
    setError('');
    setName('Raka Pratama');
    setPlate('B 4015 ZX');
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-start p-6 sm:p-12">
      <div
        className="pointer-events-auto w-full max-w-[420px] rounded-xl border border-white/12 p-7 sm:p-8 shadow-2xl"
        style={{ backgroundColor: 'rgba(13, 17, 25, 0.90)' }}
      >
        {/* Custom Inline SVG Motorsport Emblem */}
        <div className="flex items-center gap-3 mb-5">
          <svg
            viewBox="0 0 40 40"
            className="w-10 h-10 shrink-0"
            aria-hidden="true"
          >
            <polygon
              points="4,32 14,8 36,8 26,32"
              fill="#E11D48"
            />
            <polygon
              points="13,32 20,14 31,14 24,32"
              fill="#F8FAFC"
            />
          </svg>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white leading-none">
              MotoApex 3D
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Simulasi Motor Sport · Jalan Raya Realistis
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          Masuk ke garasi untuk memilih 8 motor sport nyata — R15M, CBR150R, CBR250RR, ZX-25R, GSX-R150, R1M, BMW M 1000 RR, hingga Panigale V4R dengan modifikasi lengkap.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="rider-name-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Nama Rider
            </label>
            <input
              id="rider-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Contoh: Raka Pratama"
              autoComplete="nickname"
              className="w-full rounded-lg border border-white/15 bg-[#151B26] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label
              htmlFor="rider-plate-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Nomor Pelat Motor
            </label>
            <input
              id="rider-plate-input"
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Contoh: B 2504 R"
              maxLength={12}
              className="w-full rounded-lg border border-white/15 bg-[#151B26] px-3.5 py-2.5 text-sm font-mono-tabular uppercase text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-xs font-medium text-rose-400"
            >
              {error}
            </p>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Masuk Garasi
            </button>
            <button
              type="button"
              onClick={handleDemoFill}
              className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              Isi Rider Demo
            </button>
          </div>
        </form>

        <p className="mt-5 pt-4 border-t border-white/10 text-xs text-slate-400">
          Putar kamera 3D di garasi dengan geser mouse sebelum mulai berkendara.
        </p>
      </div>
    </div>
  );
}
