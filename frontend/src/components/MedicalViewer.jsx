import React, { useState, useEffect } from 'react';
import { Flame, ChevronLeft, ChevronRight, Layers, Sparkles } from 'lucide-react';

export default function MedicalViewer({ 
  studyUid, 
  initialSlice = 16, 
  totalSlices = 224, 
  keySlices = [14, 16, 18, 19, 21] 
}) {
  const [currentSlice, setCurrentSlice] = useState(initialSlice);
  const [debouncedSlice, setDebouncedSlice] = useState(initialSlice);
  const [showGradcam, setShowGradcam] = useState(true);
  const [opacity, setOpacity] = useState(0.65);
  const [debouncedOpacity, setDebouncedOpacity] = useState(0.65);
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  // Sinkronisasi saat initialSlice atau studyUid berubah
  useEffect(() => {
    if (initialSlice !== undefined) {
      setCurrentSlice(initialSlice);
      setDebouncedSlice(initialSlice);
    }
  }, [initialSlice, studyUid]);

  // Debounce 40ms untuk irisan agar slider terasa responsif (60fps) tanpa membanjiri (spam) backend
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSlice(currentSlice);
    }, 40);
    return () => clearTimeout(timer);
  }, [currentSlice]);

  // Debounce 50ms untuk opasitas heatmap
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOpacity(opacity);
    }, 50);
    return () => clearTimeout(timer);
  }, [opacity]);

  // URL dinamis menuju endpoint irisan backend ter-debounce
  const sliceImageUrl = `${API_BASE_URL}/cases/${encodeURIComponent(studyUid)}/slice?index=${debouncedSlice}&gradcam=${showGradcam}&opacity=${debouncedOpacity}`;

  // Penanganan scroll mouse untuk berpindah irisan
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setCurrentSlice(prev => Math.min(totalSlices - 1, prev + 1));
    } else {
      setCurrentSlice(prev => Math.max(0, prev - 1));
    }
  };

  // Normalisasi key slices (bisa array integer atau object {slice: int})
  const normalizedKeySlices = (keySlices || [14, 16, 18, 19, 21]).map(k => 
    typeof k === 'object' && k !== null ? k.slice : k
  );

  return (
    <div className="flex flex-col h-full bg-[#0B1120] rounded-xl p-4 border border-slate-800 text-white select-none shadow-2xl">
      {/* Header Viewer */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-xs text-cyan-400 font-mono">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">CT Kepala Non-Kontras (Aksial)</span>
          <span className="hidden sm:inline text-slate-500">• 512×512 px (HU: 40/80)</span>
        </div>
        <div className="bg-cyan-950/60 px-3 py-1 rounded border border-cyan-800 font-mono text-cyan-300">
          Irisan: <strong>{currentSlice}</strong> / {totalSlices}
        </div>
      </div>

      {/* Area Tampilan Citra NIfTI Riil */}
      <div 
        onWheel={handleWheel}
        className="relative flex-1 flex items-center justify-center my-4 overflow-hidden rounded-lg bg-black min-h-[420px] border border-slate-900 group"
      >
        {isLoading && (
          <div className="absolute top-3 right-3 z-10 bg-slate-900/80 border border-cyan-800/80 px-2.5 py-1 rounded text-[11px] text-cyan-400 flex items-center gap-1.5 backdrop-blur-sm pointer-events-none font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Sinkronisasi #{debouncedSlice}...</span>
          </div>
        )}

        <img
          src={sliceImageUrl}
          alt={`Irisan CT Scan #${currentSlice}`}
          className="max-h-[440px] w-auto object-contain select-none"
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          draggable={false}
        />

        {/* DICOM Anatomical Orientation Markers */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-cyan-400/80 font-mono font-bold text-xs tracking-widest pointer-events-none">
          A (Anterior)
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-cyan-400/80 font-mono font-bold text-xs tracking-widest pointer-events-none">
          P (Posterior)
        </div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/80 font-mono font-bold text-xs tracking-widest pointer-events-none">
          R (Right)
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400/80 font-mono font-bold text-xs tracking-widest pointer-events-none">
          L (Left)
        </div>

        {/* Badge Penanda Heatmap */}
        {showGradcam && (
          <div className="absolute bottom-3 left-3 bg-red-950/90 border border-red-700/80 px-3 py-1.5 rounded-lg text-xs text-red-200 flex items-center gap-2 backdrop-blur-sm shadow-lg pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="font-semibold text-red-300">Grad-CAM Overlay Aktif</span>
            <span className="text-[10px] text-red-400 font-mono">({Math.round(opacity * 100)}%)</span>
          </div>
        )}

        {/* Navigasi Cepat Kiri/Kanan dengan Hover Overlay */}
        <button
          onClick={() => setCurrentSlice(prev => Math.max(0, prev - 1))}
          disabled={currentSlice <= 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white opacity-0 group-hover:opacity-80 hover:opacity-100 disabled:opacity-0 transition-opacity"
          title="Irisan Sebelumnya"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setCurrentSlice(prev => Math.min(totalSlices - 1, prev + 1))}
          disabled={currentSlice >= totalSlices - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white opacity-0 group-hover:opacity-80 hover:opacity-100 disabled:opacity-0 transition-opacity"
          title="Irisan Berikutnya"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Panel Kontrol Slider & Toggle */}
      <div className="space-y-4 pt-2 border-t border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setShowGradcam(!showGradcam)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
              showGradcam
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${showGradcam ? 'text-amber-300' : 'text-slate-400'}`} />
            <span>{showGradcam ? '🔥 Heatmap Grad-CAM: ON' : 'Heatmap: OFF'}</span>
          </button>

          {showGradcam && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <span>Opasitas:</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-24 accent-red-500 cursor-pointer"
              />
              <span className="font-mono text-white text-[11px] w-8">{Math.round(opacity * 100)}%</span>
            </div>
          )}

          {/* Slider Penggulir Irisan */}
          <div className="flex-1 min-w-[200px] flex items-center gap-3 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setCurrentSlice(prev => Math.max(0, prev - 1))}
              disabled={currentSlice <= 0}
              className="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="range"
              min="0"
              max={totalSlices - 1}
              value={currentSlice}
              onChange={(e) => setCurrentSlice(parseInt(e.target.value))}
              className="flex-1 accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            <button
              onClick={() => setCurrentSlice(prev => Math.min(totalSlices - 1, prev + 1))}
              disabled={currentSlice >= totalSlices - 1}
              className="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="font-mono text-cyan-400 text-xs font-bold w-12 text-right">
              #{currentSlice}
            </span>
          </div>
        </div>

        {/* Pintasan Tombol Irisan Kunci (Key Slices) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Irisan Kunci:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {normalizedKeySlices.map((sliceNum) => (
              <button
                key={sliceNum}
                onClick={() => setCurrentSlice(sliceNum)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                  currentSlice === sliceNum
                    ? 'bg-cyan-600 text-white font-bold ring-2 ring-cyan-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                #{sliceNum}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
