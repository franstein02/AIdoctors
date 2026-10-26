import React from 'react';
import { 
  Activity, 
  Server, 
  UserCheck, 
  Layers, 
  CheckCircle2, 
  Database,
  ChevronDown
} from 'lucide-react';

export default function Header({ 
  currentScreen, 
  setCurrentScreen, 
  activePatient, 
  stats,
  patients,
  onSelectPatient 
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      {/* Baris 1: Identitas SIM RS & Navigasi Tab Layar */}
      <div className="px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between border-b border-slate-100 gap-3">
        {/* Brand & Identitas */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-red-500/20 flex-shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight m-0 leading-none">
                SIM RS - Radiologi
              </h1>
              <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">
                AIdoctors Middleware
              </span>
            </div>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Sistem Triase Cerdas CT Scan Kepala & Interoperabilitas SATUSEHAT HL7 FHIR
            </p>
          </div>
        </div>

        {/* Tab Layar (Layar 1, Layar 2, Layar 3) */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 flex-shrink-0">
          <button
            onClick={() => setCurrentScreen('triage')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              currentScreen === 'triage'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Layar 1: Antrean Triase</span>
            {stats.redCount > 0 && (
              <span className="ml-1 bg-red-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                {stats.redCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentScreen('viewer')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              currentScreen === 'viewer'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Layar 2: Detail Kasus & DICOM</span>
            {activePatient && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                activePatient.tier === 'MERAH' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-200'
              }`}>
                {activePatient.id}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentScreen('satusehat')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              currentScreen === 'satusehat'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>Layar 3: Interoperabilitas SATUSEHAT & Audit</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
              FHIR R4
            </span>
          </button>
        </div>
      </div>

      {/* Baris 2: Sub-Bar Status PACS, Dokter Radiologi, dan Pemilih Kasus (Konsisten di Semua Layar) */}
      <div className="px-4 lg:px-6 py-2 bg-slate-50/90 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status PACS: Orthanc Aktif */}
          <div className="flex items-center bg-white text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium shadow-sm">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Status PACS: <strong className="text-emerald-700">Orthanc Aktif</strong> (Port 8042)</span>
          </div>

          {/* Profil Dokter */}
          <div className="flex items-center bg-white text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
            <UserCheck className="w-3.5 h-3.5 text-slate-600 mr-1.5" />
            <span className="font-semibold text-slate-900">Dr. Ahmad Fauzi, Sp.Rad</span>
          </div>

          {/* Pemilih Kasus Cepat (Hanya tampil di Layar 2 & Layar 3 saat memeriksa spesifik kasus) */}
          {currentScreen !== 'triage' && (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-300 animate-fadeIn">
              <span className="text-slate-500 font-medium text-[11px]">Kasus:</span>
              <select
                value={activePatient?.id || ''}
                onChange={(e) => onSelectPatient(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg text-xs font-medium px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.tier}] {p.id} - {p.nama_pasien} ({p.subtipe_dominan})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Informasi Status Kanan */}
        <div className="hidden sm:flex items-center space-x-3 text-xs text-slate-500">
          <span className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mr-1.5"></span>
            Modalitas: <strong className="text-slate-700 ml-1">CT Kepala Non-Kontras</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
            SATUSEHAT: <strong className="ml-1">FHIR R4 Ready</strong>
          </span>
        </div>
      </div>
    </header>
  );
}
