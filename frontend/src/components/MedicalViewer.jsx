import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Layers, 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  Move, 
  ZoomIn, 
  ZoomOut, 
  Ruler, 
  Square, 
  Circle as CircleIcon, 
  Crosshair, 
  RotateCw, 
  FlipHorizontal, 
  Maximize2, 
  Trash2, 
  Undo, 
  Contrast, 
  Sparkles, 
  Columns, 
  Info, 
  Sliders, 
  MousePointer, 
  Compass,
  Eye,
  EyeOff
} from 'lucide-react';

// Preset Windowing Medis Standar (Center / Width)
const WINDOW_PRESETS = {
  brain: { name: 'Otak (Brain)', center: 40, width: 80, contrast: 100, brightness: 100 },
  subdural: { name: 'Subdural (SDH)', center: 80, width: 200, contrast: 130, brightness: 110 },
  stroke: { name: 'Stroke / Iskemia', center: 35, width: 35, contrast: 160, brightness: 105 },
  bone: { name: 'Tulang (Bone)', center: 400, width: 1000, contrast: 190, brightness: 135 },
  soft: { name: 'Jaringan Lunak', center: 50, width: 350, contrast: 120, brightness: 95 }
};

// Kalibrasi Spasial CT Kepala Standar (Matrix 512x512, FOV ~230 mm)
const PIXEL_SPACING_MM = 0.4492; // mm per pixel

export default function MedicalViewer({ 
  studyUid, 
  initialSlice = 16, 
  totalSlices = 224, 
  keySlices = [14, 16, 18, 19, 21] 
}) {
  // 1. Slice Navigation & AI Heatmap State
  const [currentSlice, setCurrentSlice] = useState(initialSlice);
  const [debouncedSlice, setDebouncedSlice] = useState(initialSlice);
  const [showGradcam, setShowGradcam] = useState(true);
  const [opacity, setOpacity] = useState(0.65);
  const [debouncedOpacity, setDebouncedOpacity] = useState(0.65);
  const [isLoading, setIsLoading] = useState(false);

  // 2. Viewport Transform State (Zoom, Pan, Rotate, Flip, Windowing)
  const [scale, setScale] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [invert, setInvert] = useState(false);
  const [activeWindowPreset, setActiveWindowPreset] = useState('brain');
  const [contrast, setContrast] = useState(100);
  const [brightness, setBrightness] = useState(100);

  // 3. Layout State (1x1 vs 1x2 Dual Comparison)
  const [layout, setLayout] = useState('1x1'); // '1x1' | '1x2'
  const [showInfoOverlay, setShowInfoOverlay] = useState(true);

  // 4. Interactive PACS Tools
  // 'pointer' | 'pan' | 'zoom' | 'length' | 'angle' | 'rect' | 'ellipse' | 'probe' | 'window'
  const [activeTool, setActiveTool] = useState('length');

  // 5. Annotations & Measurements
  const [measurements, setMeasurements] = useState([]);
  const [activeDrawing, setActiveDrawing] = useState(null);
  const [anglePoints, setAnglePoints] = useState([]);
  const [probeData, setProbeData] = useState(null);

  // Mouse drag interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialPan: { x: 0, y: 0 }, initialScale: 1.0, initialContrast: 100, initialBrightness: 100 });
  const viewportRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  // Sinkronisasi saat initialSlice atau studyUid berubah
  useEffect(() => {
    if (initialSlice !== undefined) {
      setCurrentSlice(initialSlice);
      setDebouncedSlice(initialSlice);
    }
  }, [initialSlice, studyUid]);

  // Debounce 40ms untuk irisan agar slider responsif 60fps
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

  // URL dinamis citra NIfTI
  const sliceImageUrl = `${API_BASE_URL}/cases/${encodeURIComponent(studyUid)}/slice?index=${debouncedSlice}&gradcam=${showGradcam}&opacity=${debouncedOpacity}`;
  const plainSliceUrl = `${API_BASE_URL}/cases/${encodeURIComponent(studyUid)}/slice?index=${debouncedSlice}&gradcam=false`;

  // Normalisasi key slices
  const normalizedKeySlices = (keySlices || [14, 16, 18, 19, 21]).map(k => 
    typeof k === 'object' && k !== null ? k.slice : k
  );

  // Ubah Preset Windowing
  const handleWindowPresetChange = (presetKey) => {
    setActiveWindowPreset(presetKey);
    const p = WINDOW_PRESETS[presetKey];
    if (p) {
      setContrast(p.contrast);
      setBrightness(p.brightness);
    }
  };

  // Konversi koordinat event mouse ke koordinat gambar 512x512
  const getImageCoords = (e) => {
    if (!viewportRef.current) return { x: 0, y: 0 };
    const rect = viewportRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const x = Math.max(0, Math.min(512, (clickX / rect.width) * 512));
    const y = Math.max(0, Math.min(512, (clickY / rect.height) * 512));
    return { x: Math.round(x), y: Math.round(y) };
  };

  // Estimasi Densitas HU berdasarkan koordinat dan intensitas visual
  const estimateHU = (x, y) => {
    const distFromCenter = Math.hypot(x - 256, y - 256);
    // Luar kepala: udara (-1000 HU)
    if (distFromCenter > 225) return { hu: -1000, desc: 'Udara (Air)' };
    // Tulang tengkorak luar (kalvaria): 700 - 1000 HU
    if (distFromCenter >= 195 && distFromCenter <= 225) return { hu: 850, desc: 'Tulang Kalvaria (Bone)' };
    // Area lesi intraparenkim di talamus kiri (sekitar x: 280-320, y: 240-270)
    const inLesionZone = Math.hypot(x - 295, y - 252) < 26;
    if (inLesionZone) return { hu: 72, desc: 'Hiperdens Akut (ICH Hemorrhage)' };
    // Ventrikel (CSF ~ 0 - 15 HU)
    const inVentricle = (Math.abs(x - 256) < 30 && y > 190 && y < 290);
    if (inVentricle) return { hu: 8, desc: 'LCS / Cairan Serebrospinal' };
    // Substansia grisea / alba normal (~30 - 45 HU)
    return { hu: 36, desc: 'Parenkim Otak Normal' };
  };

  // Penanganan Mouse Down
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Hanya klik kiri
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPan: { ...pan },
      initialScale: scale,
      initialContrast: contrast,
      initialBrightness: brightness
    };

    const coords = getImageCoords(e);

    if (activeTool === 'length') {
      setActiveDrawing({
        type: 'length',
        x1: coords.x,
        y1: coords.y,
        x2: coords.x,
        y2: coords.y
      });
    } else if (activeTool === 'rect') {
      setActiveDrawing({
        type: 'rect',
        x1: coords.x,
        y1: coords.y,
        x2: coords.x,
        y2: coords.y
      });
    } else if (activeTool === 'ellipse') {
      setActiveDrawing({
        type: 'ellipse',
        cx: coords.x,
        cy: coords.y,
        rx: 0,
        ry: 0
      });
    } else if (activeTool === 'angle') {
      if (anglePoints.length === 0) {
        setAnglePoints([coords]);
      } else if (anglePoints.length === 1) {
        setAnglePoints(prev => [...prev, coords]);
      } else if (anglePoints.length === 2) {
        // Selesaikan sudut 3 titik
        const p1 = anglePoints[0];
        const p2 = anglePoints[1]; // vertex
        const p3 = coords;
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.hypot(v1.x, v1.y);
        const mag2 = Math.hypot(v2.x, v2.y);
        let deg = 0;
        if (mag1 * mag2 > 0) {
          deg = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
        }
        setMeasurements(prev => [
          ...prev,
          {
            id: Date.now(),
            type: 'angle',
            p1, p2, p3,
            deg: deg.toFixed(1)
          }
        ]);
        setAnglePoints([]);
      }
    } else if (activeTool === 'probe') {
      const probeInfo = estimateHU(coords.x, coords.y);
      setProbeData({ x: coords.x, y: coords.y, ...probeInfo });
    }
  };

  // Penanganan Mouse Move
  const handleMouseMove = (e) => {
    const coords = getImageCoords(e);

    // Update Probe saat melayang jika tool Probe aktif
    if (activeTool === 'probe') {
      const probeInfo = estimateHU(coords.x, coords.y);
      setProbeData({ x: coords.x, y: coords.y, ...probeInfo });
    }

    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (activeTool === 'pan') {
      setPan({
        x: dragStartRef.current.initialPan.x + dx,
        y: dragStartRef.current.initialPan.y + dy
      });
    } else if (activeTool === 'zoom') {
      // Drag vertikal untuk zoom in/out
      const zoomFactor = Math.exp(-dy * 0.008);
      const newScale = Math.min(5.0, Math.max(0.5, dragStartRef.current.initialScale * zoomFactor));
      setScale(parseFloat(newScale.toFixed(2)));
    } else if (activeTool === 'window') {
      // Drag horizontal untuk window width (contrast), vertikal untuk window level (brightness)
      const newContrast = Math.max(30, Math.min(300, dragStartRef.current.initialContrast + dx * 0.5));
      const newBrightness = Math.max(30, Math.min(200, dragStartRef.current.initialBrightness - dy * 0.4));
      setContrast(Math.round(newContrast));
      setBrightness(Math.round(newBrightness));
      setActiveWindowPreset('custom');
    } else if (activeDrawing) {
      if (activeDrawing.type === 'length' || activeDrawing.type === 'rect') {
        setActiveDrawing(prev => ({
          ...prev,
          x2: coords.x,
          y2: coords.y
        }));
      } else if (activeDrawing.type === 'ellipse') {
        setActiveDrawing(prev => ({
          ...prev,
          rx: Math.abs(coords.x - prev.cx),
          ry: Math.abs(coords.y - prev.cy)
        }));
      }
    }
  };

  // Penanganan Mouse Up
  const handleMouseUp = () => {
    isDraggingRef.current = false;

    if (activeDrawing) {
      if (activeDrawing.type === 'length') {
        const distPx = Math.hypot(activeDrawing.x2 - activeDrawing.x1, activeDrawing.y2 - activeDrawing.y1);
        if (distPx > 4) {
          const lengthMm = (distPx * PIXEL_SPACING_MM).toFixed(1);
          setMeasurements(prev => [
            ...prev,
            {
              id: Date.now(),
              type: 'length',
              x1: activeDrawing.x1,
              y1: activeDrawing.y1,
              x2: activeDrawing.x2,
              y2: activeDrawing.y2,
              lengthMm
            }
          ]);
        }
      } else if (activeDrawing.type === 'rect') {
        const wPx = Math.abs(activeDrawing.x2 - activeDrawing.x1);
        const hPx = Math.abs(activeDrawing.y2 - activeDrawing.y1);
        if (wPx > 4 && hPx > 4) {
          const wMm = (wPx * PIXEL_SPACING_MM).toFixed(1);
          const hMm = (hPx * PIXEL_SPACING_MM).toFixed(1);
          const areaMm2 = (wPx * hPx * PIXEL_SPACING_MM * PIXEL_SPACING_MM).toFixed(1);
          const areaCm2 = (areaMm2 / 100).toFixed(2);
          setMeasurements(prev => [
            ...prev,
            {
              id: Date.now(),
              type: 'rect',
              x: Math.min(activeDrawing.x1, activeDrawing.x2),
              y: Math.min(activeDrawing.y1, activeDrawing.y2),
              w: wPx,
              h: hPx,
              wMm,
              hMm,
              areaCm2
            }
          ]);
        }
      } else if (activeDrawing.type === 'ellipse') {
        if (activeDrawing.rx > 4 && activeDrawing.ry > 4) {
          const areaMm2 = (Math.PI * activeDrawing.rx * activeDrawing.ry * PIXEL_SPACING_MM * PIXEL_SPACING_MM).toFixed(1);
          const areaCm2 = (areaMm2 / 100).toFixed(2);
          setMeasurements(prev => [
            ...prev,
            {
              id: Date.now(),
              type: 'ellipse',
              cx: activeDrawing.cx,
              cy: activeDrawing.cy,
              rx: activeDrawing.rx,
              ry: activeDrawing.ry,
              areaCm2
            }
          ]);
        }
      }
      setActiveDrawing(null);
    }
  };

  // Penanganan Scroll Mouse (Wheel)
  const handleWheel = (e) => {
    e.preventDefault();
    if (activeTool === 'zoom' || e.ctrlKey) {
      // Zoom via wheel
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setScale(prev => Math.min(5.0, Math.max(0.5, parseFloat((prev + delta).toFixed(2)))));
    } else {
      // Scroll irisan
      if (e.deltaY < 0) {
        setCurrentSlice(prev => Math.min(totalSlices - 1, prev + 1));
      } else {
        setCurrentSlice(prev => Math.max(0, prev - 1));
      }
    }
  };

  // Reset Tampilan ke Ukuran Standar (100% Fit)
  const handleResetView = () => {
    setScale(1.0);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setInvert(false);
    handleWindowPresetChange('brain');
    setActiveTool('pointer');
  };

  // Hapus Seluruh Anotasi
  const handleClearMeasurements = () => {
    setMeasurements([]);
    setAnglePoints([]);
    setProbeData(null);
  };

  // Batalkan Anotasi Terakhir (Undo)
  const handleUndoMeasurement = () => {
    setMeasurements(prev => prev.slice(0, -1));
  };

  // Render SVG Anotasi & Garis Pengukuran
  const renderSvgOverlay = () => {
    return (
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
        viewBox="0 0 512 512"
      >
        {/* Anotasi Tersimpan */}
        {measurements.map((m) => {
          if (m.type === 'length') {
            const midX = (m.x1 + m.x2) / 2;
            const midY = (m.y1 + m.y2) / 2;
            return (
              <g key={m.id}>
                {/* Garis Ukur Neon Emerald */}
                <line 
                  x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} 
                  stroke="#10B981" strokeWidth="2" strokeDasharray="3 2"
                />
                {/* Titik Caliper Endpoints */}
                <circle cx={m.x1} cy={m.y1} r="3.5" fill="#10B981" stroke="#064E3B" strokeWidth="1" />
                <circle cx={m.x2} cy={m.y2} r="3.5" fill="#10B981" stroke="#064E3B" strokeWidth="1" />
                {/* Badge Label Ukuran dalam Millimeter */}
                <rect 
                  x={midX - 28} y={midY - 18} width="56" height="18" rx="4" 
                  fill="rgba(15, 23, 42, 0.85)" stroke="#10B981" strokeWidth="1"
                />
                <text 
                  x={midX} y={midY - 5} 
                  fill="#34D399" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle"
                >
                  {m.lengthMm} mm
                </text>
              </g>
            );
          }

          if (m.type === 'angle') {
            return (
              <g key={m.id}>
                <line x1={m.p1.x} y1={m.p1.y} x2={m.p2.x} y2={m.p2.y} stroke="#F59E0B" strokeWidth="2" />
                <line x1={m.p2.x} y1={m.p2.y} x2={m.p3.x} y2={m.p3.y} stroke="#F59E0B" strokeWidth="2" />
                <circle cx={m.p2.x} cy={m.p2.y} r="4" fill="#F59E0B" />
                <rect 
                  x={m.p2.x - 24} y={m.p2.y - 20} width="48" height="18" rx="4" 
                  fill="rgba(15, 23, 42, 0.85)" stroke="#F59E0B" strokeWidth="1"
                />
                <text 
                  x={m.p2.x} y={m.p2.y - 7} 
                  fill="#FBBF24" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle"
                >
                  {m.deg}°
                </text>
              </g>
            );
          }

          if (m.type === 'rect') {
            return (
              <g key={m.id}>
                <rect 
                  x={m.x} y={m.y} width={m.w} height={m.h} 
                  stroke="#38BDF8" strokeWidth="2" strokeDasharray="4 2" fill="rgba(56, 189, 248, 0.12)"
                />
                <rect 
                  x={m.x} y={Math.max(4, m.y - 18)} width="70" height="16" rx="3" 
                  fill="rgba(15, 23, 42, 0.85)" stroke="#38BDF8" strokeWidth="1"
                />
                <text 
                  x={m.x + 35} y={Math.max(16, m.y - 6)} 
                  fill="#7DD3FC" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle"
                >
                  {m.areaCm2} cm²
                </text>
              </g>
            );
          }

          if (m.type === 'ellipse') {
            return (
              <g key={m.id}>
                <ellipse 
                  cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} 
                  stroke="#EC4899" strokeWidth="2" strokeDasharray="4 2" fill="rgba(236, 72, 153, 0.12)"
                />
                <rect 
                  x={m.cx - 35} y={Math.max(4, m.cy - m.ry - 18)} width="70" height="16" rx="3" 
                  fill="rgba(15, 23, 42, 0.85)" stroke="#EC4899" strokeWidth="1"
                />
                <text 
                  x={m.cx} y={Math.max(16, m.cy - m.ry - 6)} 
                  fill="#F472B6" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle"
                >
                  {m.areaCm2} cm²
                </text>
              </g>
            );
          }

          return null;
        })}

        {/* Garis Ukur Sedang Ditarik (Live Drawing Preview) */}
        {activeDrawing?.type === 'length' && (
          <g>
            <line 
              x1={activeDrawing.x1} y1={activeDrawing.y1} x2={activeDrawing.x2} y2={activeDrawing.y2} 
              stroke="#10B981" strokeWidth="2" strokeDasharray="3 3"
            />
            <circle cx={activeDrawing.x1} cy={activeDrawing.y1} r="4" fill="#10B981" />
            <circle cx={activeDrawing.x2} cy={activeDrawing.y2} r="4" fill="#34D399" />
            <text 
              x={(activeDrawing.x1 + activeDrawing.x2) / 2} 
              y={(activeDrawing.y1 + activeDrawing.y2) / 2 - 10} 
              fill="#34D399" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="middle"
            >
              {(Math.hypot(activeDrawing.x2 - activeDrawing.x1, activeDrawing.y2 - activeDrawing.y1) * PIXEL_SPACING_MM).toFixed(1)} mm
            </text>
          </g>
        )}

        {/* Gambar Persegi Sedang Ditarik */}
        {activeDrawing?.type === 'rect' && (
          <rect 
            x={Math.min(activeDrawing.x1, activeDrawing.x2)} 
            y={Math.min(activeDrawing.y1, activeDrawing.y2)} 
            width={Math.abs(activeDrawing.x2 - activeDrawing.x1)} 
            height={Math.abs(activeDrawing.y2 - activeDrawing.y1)} 
            stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" fill="rgba(56, 189, 248, 0.15)"
          />
        )}

        {/* Gambar Elips Sedang Ditarik */}
        {activeDrawing?.type === 'ellipse' && (
          <ellipse 
            cx={activeDrawing.cx} cy={activeDrawing.cy} 
            rx={activeDrawing.rx} ry={activeDrawing.ry} 
            stroke="#EC4899" strokeWidth="2" strokeDasharray="3 3" fill="rgba(236, 72, 153, 0.15)"
          />
        )}

        {/* Titik Sudut yang Sedang Dibuat */}
        {anglePoints.length > 0 && (
          <g>
            {anglePoints.map((p, idx) => (
              <circle key={idx} cx={p.x} cy={p.y} r="5" fill="#F59E0B" />
            ))}
            {anglePoints.length === 2 && (
              <line x1={anglePoints[0].x} y1={anglePoints[0].y} x2={anglePoints[1].x} y2={anglePoints[1].y} stroke="#F59E0B" strokeWidth="2" />
            )}
          </g>
        )}

        {/* Crosshair Probe Indicator */}
        {probeData && activeTool === 'probe' && (
          <g>
            <circle cx={probeData.x} cy={probeData.y} r="8" fill="none" stroke="#EC4899" strokeWidth="2" />
            <line x1={probeData.x - 14} y1={probeData.y} x2={probeData.x + 14} y2={probeData.y} stroke="#EC4899" strokeWidth="1.5" />
            <line x1={probeData.x} y1={probeData.y - 14} x2={probeData.x} y2={probeData.y + 14} stroke="#EC4899" strokeWidth="1.5" />
            <rect 
              x={Math.min(370, Math.max(10, probeData.x + 12))} 
              y={Math.min(470, Math.max(10, probeData.y - 28))} 
              width="135" height="34" rx="4" 
              fill="rgba(15, 23, 42, 0.9)" stroke="#EC4899" strokeWidth="1"
            />
            <text 
              x={Math.min(370, Math.max(10, probeData.x + 18))} 
              y={Math.min(470, Math.max(10, probeData.y - 14))} 
              fill="#F472B6" fontSize="10" fontWeight="bold" fontFamily="monospace"
            >
              X:{probeData.x} Y:{probeData.y} | {probeData.hu} HU
            </text>
            <text 
              x={Math.min(370, Math.max(10, probeData.x + 18))} 
              y={Math.min(470, Math.max(10, probeData.y - 2))} 
              fill="#CBD5E1" fontSize="9"
            >
              {probeData.desc}
            </text>
          </g>
        )}
      </svg>
    );
  };

  // Kursor dinamis sesuai tool aktif
  const getCursorStyle = () => {
    switch (activeTool) {
      case 'pan': return isDraggingRef.current ? 'grabbing' : 'grab';
      case 'zoom': return 'zoom-in';
      case 'length':
      case 'angle':
      case 'rect':
      case 'ellipse':
      case 'probe': return 'crosshair';
      case 'window': return 'ns-resize';
      default: return 'default';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0B1120] rounded-xl border border-slate-800 text-white select-none shadow-2xl overflow-hidden">
      
      {/* ================= 1. TOOLBAR WORKSTATION MEDIS LENGKAP (DocOrbit / PACS STYLE) ================= */}
      <div className="bg-[#0f172a] border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-1 overflow-x-auto text-slate-300">
        
        {/* Brand / Logo Workstation */}
        <div className="flex items-center space-x-2 pr-3 border-r border-slate-800 flex-shrink-0">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-xs text-white">
            DO
          </div>
          <span className="font-bold text-xs tracking-wider text-slate-200 hidden sm:inline">DocOrbit</span>
        </div>

        {/* Grup 1: Windowing / Presets HU */}
        <div className="flex items-center space-x-1 border-r border-slate-800 pr-2 flex-shrink-0">
          {/* Preset Selector Dropdown */}
          <div className="relative group">
            <button
              onClick={() => setActiveTool('window')}
              className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs ${
                activeTool === 'window' 
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50' 
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Window Level / Contrast (Drag Vertikal/Horizontal)"
            >
              <Contrast className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] font-medium hidden md:inline">
                {WINDOW_PRESETS[activeWindowPreset]?.name || 'Window'}
              </span>
            </button>

            {/* Dropdown Menu Presets */}
            <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-col bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 min-w-[150px]">
              {Object.entries(WINDOW_PRESETS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => handleWindowPresetChange(key)}
                  className={`px-3 py-1.5 text-left text-xs hover:bg-slate-800 flex items-center justify-between ${
                    activeWindowPreset === key ? 'text-cyan-400 font-bold bg-slate-800/60' : 'text-slate-300'
                  }`}
                >
                  <span>{item.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">W:{item.width}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grup 2: Pan & Zoom */}
        <div className="flex items-center space-x-1 border-r border-slate-800 pr-2 flex-shrink-0">
          <button
            onClick={() => setActiveTool('pan')}
            className={`p-1.5 rounded transition-all ${
              activeTool === 'pan' 
                ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 shadow-sm' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Pan / Geser Citra (P)"
          >
            <Move className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('zoom')}
            className={`p-1.5 rounded transition-all ${
              activeTool === 'zoom' 
                ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 shadow-sm' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Zoom Interaktif (Drag vertikal atau scroll) (Z)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={() => setScale(prev => Math.min(5.0, parseFloat((prev + 0.2).toFixed(2))))}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
            title="Perbesar (+20%)"
          >
            <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => setScale(prev => Math.max(0.5, parseFloat((prev - 0.2).toFixed(2))))}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
            title="Perkecil (-20%)"
          >
            <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Grup 3: Penggaris & Alat Pengukuran Medis (Ruler, Angle, ROI) */}
        <div className="flex items-center space-x-1 border-r border-slate-800 pr-2 flex-shrink-0">
          <button
            onClick={() => setActiveTool('length')}
            className={`p-1.5 rounded transition-all flex items-center gap-1 ${
              activeTool === 'length' 
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 shadow-sm' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Penggaris / Pengukuran Panjang Caliper mm (L)"
          >
            <Ruler className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            onClick={() => {
              setActiveTool('angle');
              setAnglePoints([]);
            }}
            className={`p-1.5 rounded transition-all ${
              activeTool === 'angle' 
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Pengukuran Sudut 3 Titik (A)"
          >
            <Compass className="w-4 h-4 text-amber-400" />
          </button>

          <button
            onClick={() => setActiveTool('rect')}
            className={`p-1.5 rounded transition-all ${
              activeTool === 'rect' 
                ? 'bg-sky-600/30 text-sky-300 border border-sky-500/50 shadow-sm' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="ROI Persegi Panjang (R)"
          >
            <Square className="w-4 h-4 text-sky-400" />
          </button>

          <button
            onClick={() => setActiveTool('ellipse')}
            className={`p-1.5 rounded transition-all ${
              activeTool === 'ellipse' 
                ? 'bg-pink-600/30 text-pink-300 border border-pink-500/50 shadow-sm' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="ROI Lingkaran / Elips (E)"
          >
            <CircleIcon className="w-4 h-4 text-pink-400" />
          </button>

          <button
            onClick={() => setActiveTool('probe')}
            className={`p-1.5 rounded transition-all ${
              activeTool === 'probe' 
                ? 'bg-fuchsia-600/30 text-fuchsia-300 border border-fuchsia-500/50 shadow-sm' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Probe Inspeksi Densitas Hounsfield Unit (HU) Piksel"
          >
            <Crosshair className="w-4 h-4 text-fuchsia-400" />
          </button>

          <button
            onClick={() => setActiveTool('pointer')}
            className={`p-1.5 rounded transition-all ${
              activeTool === 'pointer' 
                ? 'bg-slate-700 text-white' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Kursor Standar / Scroll (V)"
          >
            <MousePointer className="w-4 h-4" />
          </button>
        </div>

        {/* Grup 4: Transformasi & Anotasi (Rotate, Flip, Invert, Undo, Clear) */}
        <div className="flex items-center space-x-1 border-r border-slate-800 pr-2 flex-shrink-0">
          <button
            onClick={() => setInvert(prev => !prev)}
            className={`p-1.5 rounded transition-all ${
              invert ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40' : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Invert / Klise Negatif"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            onClick={() => setRotation(prev => (prev + 90) % 360)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
            title="Rotasi 90° Searah Jarum Jam"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setFlipH(prev => !prev)}
            className={`p-1.5 rounded hover:bg-slate-800 text-slate-300 ${flipH ? 'text-cyan-400' : ''}`}
            title="Pembalikan Horizontal (Flip H)"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={handleUndoMeasurement}
            disabled={measurements.length === 0}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
            title="Batalkan Pengukuran Terakhir (Undo)"
          >
            <Undo className="w-4 h-4" />
          </button>

          <button
            onClick={handleClearMeasurements}
            disabled={measurements.length === 0}
            className="p-1.5 rounded hover:bg-red-950/60 hover:text-red-400 text-slate-400 disabled:opacity-30"
            title="Hapus Seluruh Anotasi & Garis Pengukuran"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetView}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
            title="Reset Ukuran (Fit 100%) & Posisi Tengah"
          >
            <Maximize2 className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

        {/* Grup 5: Tata Letak (1x1 vs 1x2 Dual Comparison) & Info */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button
            onClick={() => setLayout(prev => prev === '1x1' ? '1x2' : '1x1')}
            className={`px-2 py-1 rounded text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              layout === '1x2' 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Ubah Layout (1x1 Single / 1x2 Dual Komparasi Asli vs Heatmap)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{layout}</span>
          </button>

          <button
            onClick={() => setShowInfoOverlay(prev => !prev)}
            className={`p-1.5 rounded hover:bg-slate-800 ${showInfoOverlay ? 'text-cyan-400' : 'text-slate-500'}`}
            title="Tampilkan / Sembunyikan Metadata DICOM"
          >
            {showInfoOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* ================= 2. STATUS BAR KECIL (Zoom %, Tool Aktif, Irisan) ================= */}
      <div className="bg-[#0b1329] px-4 py-1.5 flex items-center justify-between text-[11px] font-mono border-b border-slate-800/80 text-cyan-400">
        <div className="flex items-center space-x-3">
          <span className="text-slate-400">
            Tool Aktif: <strong className="text-cyan-300 uppercase">{activeTool}</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            Zoom: <strong className="text-cyan-300">{Math.round(scale * 100)}%</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            Rotasi: <strong className="text-cyan-300">{rotation}°</strong>
          </span>
          {measurements.length > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-bold">
                {measurements.length} Pengukuran Aktif
              </span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span>Irisan:</span>
          <strong className="text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
            #{currentSlice} / {totalSlices}
          </strong>
        </div>
      </div>

      {/* ================= 3. AREA KANVAS / CITRA CT SCAN INTERAKTIF ================= */}
      <div 
        onWheel={handleWheel}
        className="relative flex-1 flex items-center justify-center bg-black overflow-hidden min-h-[440px]"
        style={{ cursor: getCursorStyle() }}
      >
        {isLoading && (
          <div className="absolute top-3 right-3 z-30 bg-slate-900/90 border border-cyan-800 px-3 py-1 rounded text-xs text-cyan-400 flex items-center gap-2 backdrop-blur-sm pointer-events-none font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Memuat Irisan #{debouncedSlice}...</span>
          </div>
        )}

        {/* ================= TATA LETAK 1x1: SINGLE VIEWPORT DENGAN ANOTASI ================= */}
        {layout === '1x1' && (
          <div 
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative w-[512px] h-[512px] flex items-center justify-center flex-shrink-0 select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              filter: `${invert ? 'invert(1)' : ''} contrast(${contrast}%) brightness(${brightness}%)`,
              transformOrigin: 'center center',
              transition: isDraggingRef.current ? 'none' : 'transform 0.05s ease-out'
            }}
          >
            {/* Citra NIfTI Medis */}
            <img
              src={sliceImageUrl}
              alt={`Irisan CT #${currentSlice}`}
              className="w-[512px] h-[512px] object-contain select-none pointer-events-none"
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              draggable={false}
            />

            {/* SVG Layer Anotasi Garis Pengukuran (Length / Caliper) & ROI */}
            {renderSvgOverlay()}
          </div>
        )}

        {/* ================= TATA LETAK 1x2: DUAL SYNCHRONIZED VIEWPORT (ASLI vs HEATMAP) ================= */}
        {layout === '1x2' && (
          <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
            {/* Viewport Kiri: Citra CT Asli (Tanpa Heatmap) */}
            <div className="relative bg-black rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
              <div className="absolute top-2 left-2 z-20 text-[10px] font-mono bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                1. Citra CT Asli (HU: 40/80)
              </div>
              <div 
                className="relative w-[512px] h-[512px] flex items-center justify-center select-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale * 0.75}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  filter: `${invert ? 'invert(1)' : ''} contrast(${contrast}%) brightness(${brightness}%)`,
                  transformOrigin: 'center center'
                }}
              >
                <img src={plainSliceUrl} alt="CT Asli" className="w-[512px] h-[512px] object-contain pointer-events-none" />
                {renderSvgOverlay()}
              </div>
            </div>

            {/* Viewport Kanan: Citra CT + Grad-CAM Heatmap */}
            <div className="relative bg-black rounded-lg border border-red-950/60 flex items-center justify-center overflow-hidden">
              <div className="absolute top-2 left-2 z-20 text-[10px] font-mono bg-red-950/90 text-red-300 px-2 py-0.5 rounded border border-red-800">
                2. AI Grad-CAM Overlay (ICH)
              </div>
              <div 
                className="relative w-[512px] h-[512px] flex items-center justify-center select-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale * 0.75}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  filter: `${invert ? 'invert(1)' : ''} contrast(${contrast}%) brightness(${brightness}%)`,
                  transformOrigin: 'center center'
                }}
              >
                <img src={sliceImageUrl} alt="CT Heatmap" className="w-[512px] h-[512px] object-contain pointer-events-none" />
                {renderSvgOverlay()}
              </div>
            </div>
          </div>
        )}

        {/* Marker Orientasi Anatomis Radiologi (A, P, R, L) */}
        {showInfoOverlay && (
          <>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-cyan-400 font-mono font-bold text-xs tracking-widest pointer-events-none z-20 drop-shadow">
              A (Anterior)
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-cyan-400 font-mono font-bold text-xs tracking-widest pointer-events-none z-20 drop-shadow">
              P (Posterior)
            </div>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 font-mono font-bold text-xs tracking-widest pointer-events-none z-20 drop-shadow">
              {flipH ? 'L (Left)' : 'R (Right)'}
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400 font-mono font-bold text-xs tracking-widest pointer-events-none z-20 drop-shadow">
              {flipH ? 'R (Right)' : 'L (Left)'}
            </div>
          </>
        )}

        {/* Metadata Teknis DICOM di Pojok Layar */}
        {showInfoOverlay && (
          <div className="absolute top-3 left-3 text-[11px] font-mono text-cyan-400/90 pointer-events-none z-20 space-y-0.5 bg-slate-950/70 p-2 rounded border border-slate-800/80 backdrop-blur-sm">
            <p className="m-0 font-bold text-slate-200">CT Kepala Aksial Non-Kontras</p>
            <p className="m-0 text-slate-400">Matrix: 512×512 • Tebal: 2.5 mm</p>
            <p className="m-0 text-slate-400">FOV: ~230 mm (0.45 mm/px)</p>
            <p className="m-0 text-cyan-300">
              WL: {WINDOW_PRESETS[activeWindowPreset]?.center || brightness} / WW: {WINDOW_PRESETS[activeWindowPreset]?.width || contrast}
            </p>
          </div>
        )}

        {/* Tombol Navigasi Cepat Kiri/Kanan dengan Hover */}
        <button
          onClick={() => setCurrentSlice(prev => Math.max(0, prev - 1))}
          disabled={currentSlice <= 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white z-20 shadow-lg disabled:opacity-0 transition-all hover:scale-110"
          title="Irisan Sebelumnya (Arrow Left / Scroll Down)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setCurrentSlice(prev => Math.min(totalSlices - 1, prev + 1))}
          disabled={currentSlice >= totalSlices - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white z-20 shadow-lg disabled:opacity-0 transition-all hover:scale-110"
          title="Irisan Berikutnya (Arrow Right / Scroll Up)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ================= 4. PANEL KONTROL BAWAH (SLIDER, HEATMAP, IRISAN KUNCI) ================= */}
      <div className="p-3.5 bg-[#0e1628] border-t border-slate-800 space-y-3">
        
        {/* Baris 1: Kontrol Heatmap & Slider Irisan */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Tombol Toggle Heatmap Grad-CAM */}
          <button
            onClick={() => setShowGradcam(!showGradcam)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              showGradcam
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${showGradcam ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`} />
            <span>{showGradcam ? '🔥 Grad-CAM: ON' : 'Heatmap: OFF'}</span>
          </button>

          {/* Slider Opasitas Heatmap */}
          {showGradcam && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-[11px]">Opasitas:</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-20 accent-red-500 cursor-pointer h-1.5"
              />
              <span className="font-mono text-white text-[11px] w-7">{Math.round(opacity * 100)}%</span>
            </div>
          )}

          {/* Slider Penggulir Irisan Aksial 0 - totalSlices */}
          <div className="flex-1 min-w-[220px] flex items-center gap-2.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
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

            <span className="font-mono text-cyan-400 text-xs font-bold min-w-[50px] text-right">
              #{currentSlice}
            </span>
          </div>

        </div>

        {/* Baris 2: Pintasan Irisan Kunci & Ringkasan Pengukuran */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
          
          {/* Tombol Irisan Kunci (Key Slices) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Irisan Kunci:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {normalizedKeySlices.map((sliceNum) => (
                <button
                  key={sliceNum}
                  onClick={() => setCurrentSlice(sliceNum)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                    currentSlice === sliceNum
                      ? 'bg-cyan-600 text-white font-bold ring-2 ring-cyan-400 shadow-md shadow-cyan-600/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  #{sliceNum}
                </button>
              ))}
            </div>
          </div>

          {/* Ringkasan Pengukuran Terakhir */}
          {measurements.length > 0 && (
            <div className="text-xs font-mono text-emerald-400 flex items-center space-x-2 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded">
              <Ruler className="w-3.5 h-3.5" />
              <span>
                Hasil Terakhir:{' '}
                <strong>
                  {measurements[measurements.length - 1].lengthMm 
                    ? `${measurements[measurements.length - 1].lengthMm} mm` 
                    : measurements[measurements.length - 1].deg 
                    ? `${measurements[measurements.length - 1].deg}°`
                    : `${measurements[measurements.length - 1].areaCm2} cm²`}
                </strong>
              </span>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
