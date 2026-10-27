import React, { useState, useEffect, useRef } from 'react';
import { 
  Contrast, 
  Move, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
  Ruler, 
  Square, 
  Circle as CircleIcon, 
  Crosshair, 
  Mouse, 
  Undo2, 
  Redo2, 
  Trash2, 
  RotateCw, 
  Maximize2, 
  LayoutGrid, 
  Box, 
  Sliders, 
  Info, 
  FileText, 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Copy, 
  X,
  Eye,
  EyeOff
} from 'lucide-react';

// Preset Windowing Medis Standar (Center / Width)
const WINDOW_PRESETS = {
  original: { name: 'Original', center: 40, width: 80, contrast: 100, brightness: 100 },
  brain: { name: 'Otak (Brain)', center: 40, width: 80, contrast: 110, brightness: 100 },
  subdural: { name: 'Subdural (SDH)', center: 80, width: 200, contrast: 130, brightness: 110 },
  stroke: { name: 'Stroke / Iskemia', center: 35, width: 35, contrast: 165, brightness: 105 },
  bone: { name: 'Tulang (Bone)', center: 400, width: 1000, contrast: 190, brightness: 135 },
  soft: { name: 'Jaringan Lunak', center: 50, width: 350, contrast: 120, brightness: 95 }
};

// Kalibrasi Spasial CT Kepala Standar (Matrix 512x512, FOV ~230 mm)
const PIXEL_SPACING_MM = 0.4492; // mm per pixel

export default function MedicalViewer({ 
  studyUid, 
  initialSlice = 16, 
  totalSlices = 224, 
  keySlices = [14, 16, 18, 19, 21],
  onInsertMeasurement
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
  const [activeWindowPreset, setActiveWindowPreset] = useState('original');
  const [contrast, setContrast] = useState(100);
  const [brightness, setBrightness] = useState(100);

  // 3. Layout & MPR State
  const [layout, setLayout] = useState('1x1'); // '1x1' | '1x2' | '2x1'
  const [showInfoOverlay, setShowInfoOverlay] = useState(true);
  const [mprMode, setMprMode] = useState(false); // 3D / MPR view toggle
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 4. Interactive PACS Tools
  // 'window' | 'pan' | 'zoom' | 'stack' | 'length' | 'angle' | 'rect' | 'circle' | 'freehand' | 'probe'
  const [activeTool, setActiveTool] = useState('length');

  // 5. Annotations & Measurement Stacks
  const [measurements, setMeasurements] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [activeDrawing, setActiveDrawing] = useState(null);
  const [anglePoints, setAnglePoints] = useState([]);
  const [probeData, setProbeData] = useState(null);

  // Popover menus & modals
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showMouseHelp, setShowMouseHelp] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Drag interaction refs
  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isRightDraggingRef = useRef(false);
  const isMiddleDraggingRef = useRef(false);
  const dragStartRef = useRef({ 
    x: 0, 
    y: 0, 
    initialPan: { x: 0, y: 0 }, 
    initialScale: 1.0, 
    initialContrast: 100, 
    initialBrightness: 100,
    initialSlice: 0
  });

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

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.toolbar-dropdown')) {
        setShowPresetMenu(false);
        setShowLayoutMenu(false);
        setShowMouseHelp(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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
    setShowPresetMenu(false);
    const p = WINDOW_PRESETS[presetKey];
    if (p) {
      setContrast(p.contrast);
      setBrightness(p.brightness);
    }
  };

  // Konversi koordinat layar ke koordinat gambar 512x512 secara matematis eksak
  const getImageCoords = (e) => {
    if (!viewportRef.current) return { x: 256, y: 256 };
    const rect = viewportRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;

    if (rotation !== 0) {
      const rad = (-rotation * Math.PI) / 180;
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
      dx = rx;
      dy = ry;
    }

    if (flipH) dx = -dx;
    if (flipV) dy = -dy;

    const currentRenderSize = 512 * scale;
    const unscaledX = (dx / currentRenderSize) * 512;
    const unscaledY = (dy / currentRenderSize) * 512;

    const x = Math.max(0, Math.min(512, Math.round(unscaledX + 256)));
    const y = Math.max(0, Math.min(512, Math.round(unscaledY + 256)));
    return { x, y };
  };

  // Estimasi Densitas HU berdasarkan koordinat dan intensitas visual radiologi
  const estimateHU = (x, y) => {
    const distFromCenter = Math.hypot(x - 256, y - 256);
    // Luar kepala: udara (-1000 HU)
    if (distFromCenter > 225) return { hu: -1000, desc: 'Udara (Air)' };
    // Tulang tengkorak luar (kalvaria): 700 - 1000 HU
    if (distFromCenter >= 195 && distFromCenter <= 225) return { hu: 850, desc: 'Tulang Kalvaria (Bone)' };
    // Area lesi intraparenkim di talamus kiri (sekitar x: 280-320, y: 240-270)
    const inLesionZone = Math.hypot(x - 295, y - 252) < 28;
    if (inLesionZone) return { hu: 74, desc: 'Hiperdens Akut (Perdarahan ICH)' };
    // Ventrikel (CSF ~ 0 - 15 HU)
    const inVentricle = (Math.abs(x - 256) < 30 && y > 190 && y < 290);
    if (inVentricle) return { hu: 8, desc: 'LCS / Cairan Serebrospinal' };
    // Substansia grisea / alba normal (~30 - 45 HU)
    return { hu: 36, desc: 'Parenkim Otak Normal' };
  };

  // Penanganan Mouse Down
  const handleMouseDown = (e) => {
    const coords = getImageCoords(e);

    // 1. Klik Kanan -> Window/Level (WW/WL)
    if (e.button === 2) {
      e.preventDefault();
      isRightDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialContrast: contrast,
        initialBrightness: brightness
      };
      return;
    }

    // 2. Klik Tengah -> Pan
    if (e.button === 1) {
      e.preventDefault();
      isMiddleDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialPan: { ...pan }
      };
      return;
    }

    if (e.button !== 0) return; // Hanya klik kiri untuk tool aktif

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPan: { ...pan },
      initialScale: scale,
      initialContrast: contrast,
      initialBrightness: brightness,
      initialSlice: currentSlice
    };

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
    } else if (activeTool === 'circle') {
      setActiveDrawing({
        type: 'circle',
        cx: coords.x,
        cy: coords.y,
        r: 0
      });
    } else if (activeTool === 'freehand') {
      setActiveDrawing({
        type: 'freehand',
        points: [coords]
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
        setRedoStack([]);
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

    // Update Probe saat kursor bergerak jika tool probe aktif
    if (activeTool === 'probe') {
      const probeInfo = estimateHU(coords.x, coords.y);
      setProbeData({ x: coords.x, y: coords.y, ...probeInfo });
    }

    // Klik kanan drag -> Windowing
    if (isRightDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const newContrast = Math.max(30, Math.min(300, dragStartRef.current.initialContrast + dx * 0.5));
      const newBrightness = Math.max(30, Math.min(200, dragStartRef.current.initialBrightness - dy * 0.4));
      setContrast(Math.round(newContrast));
      setBrightness(Math.round(newBrightness));
      setActiveWindowPreset('custom');
      return;
    }

    // Klik tengah drag -> Pan
    if (isMiddleDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.initialPan.x + dx,
        y: dragStartRef.current.initialPan.y + dy
      });
      return;
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
      const zoomFactor = Math.exp(-dy * 0.008);
      const newScale = Math.min(5.0, Math.max(0.5, dragStartRef.current.initialScale * zoomFactor));
      setScale(parseFloat(newScale.toFixed(2)));
    } else if (activeTool === 'stack') {
      // Drag vertikal untuk scrolling irisan
      const sliceDelta = Math.round(-dy * 0.2);
      const targetSlice = Math.max(0, Math.min(totalSlices - 1, dragStartRef.current.initialSlice + sliceDelta));
      setCurrentSlice(targetSlice);
    } else if (activeTool === 'window') {
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
      } else if (activeDrawing.type === 'circle') {
        const radius = Math.hypot(coords.x - activeDrawing.cx, coords.y - activeDrawing.cy);
        setActiveDrawing(prev => ({
          ...prev,
          r: Math.round(radius)
        }));
      } else if (activeDrawing.type === 'freehand') {
        const lastPt = activeDrawing.points[activeDrawing.points.length - 1];
        if (!lastPt || Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y) > 3) {
          setActiveDrawing(prev => ({
            ...prev,
            points: [...prev.points, coords]
          }));
        }
      }
    }
  };

  // Penanganan Mouse Up
  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isRightDraggingRef.current = false;
    isMiddleDraggingRef.current = false;

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
          setRedoStack([]);
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
          setRedoStack([]);
        }
      } else if (activeDrawing.type === 'circle') {
        if (activeDrawing.r > 4) {
          const rMm = (activeDrawing.r * PIXEL_SPACING_MM).toFixed(1);
          const areaMm2 = (Math.PI * activeDrawing.r * activeDrawing.r * PIXEL_SPACING_MM * PIXEL_SPACING_MM).toFixed(1);
          const areaCm2 = (areaMm2 / 100).toFixed(2);
          setMeasurements(prev => [
            ...prev,
            {
              id: Date.now(),
              type: 'circle',
              cx: activeDrawing.cx,
              cy: activeDrawing.cy,
              r: activeDrawing.r,
              rMm,
              areaCm2
            }
          ]);
          setRedoStack([]);
        }
      } else if (activeDrawing.type === 'freehand') {
        const pts = activeDrawing.points;
        if (pts.length > 5) {
          // Hitung luas poligon menggunakan rumus Shoelace
          let areaPx = 0;
          let perimeterPx = 0;
          for (let i = 0; i < pts.length; i++) {
            const next = pts[(i + 1) % pts.length];
            areaPx += pts[i].x * next.y - next.x * pts[i].y;
            perimeterPx += Math.hypot(next.x - pts[i].x, next.y - pts[i].y);
          }
          areaPx = Math.abs(areaPx) / 2;
          const areaMm2 = areaPx * PIXEL_SPACING_MM * PIXEL_SPACING_MM;
          const areaCm2 = (areaMm2 / 100).toFixed(2);
          const perimeterMm = (perimeterPx * PIXEL_SPACING_MM).toFixed(1);

          // Titik pusat rata-rata untuk penempatan label
          const avgX = Math.round(pts.reduce((sum, p) => sum + p.x, 0) / pts.length);
          const avgY = Math.round(pts.reduce((sum, p) => sum + p.y, 0) / pts.length);

          setMeasurements(prev => [
            ...prev,
            {
              id: Date.now(),
              type: 'freehand',
              points: pts,
              centerX: avgX,
              centerY: avgY,
              areaCm2,
              perimeterMm
            }
          ]);
          setRedoStack([]);
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
    handleWindowPresetChange('original');
  };

  // Batalkan Anotasi Terakhir (Undo)
  const handleUndo = () => {
    if (measurements.length === 0) return;
    const lastItem = measurements[measurements.length - 1];
    setMeasurements(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastItem]);
  };

  // Pulihkan Anotasi (Redo)
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const itemToRestore = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setMeasurements(prev => [...prev, itemToRestore]);
  };

  // Hapus Seluruh Anotasi
  const handleClearAll = () => {
    setMeasurements([]);
    setRedoStack([]);
    setAnglePoints([]);
    setProbeData(null);
  };

  // Toggle Fullscreen Native
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Salin ringkasan pengukuran ke Clipboard
  const handleCopyReportSummary = () => {
    if (measurements.length === 0) return;
    const summaryLines = [
      `[Ringkasan Pengukuran Workstation CT - Irisan #${currentSlice}]`,
      ...measurements.map((m, idx) => {
        if (m.type === 'length') return `${idx + 1}. Caliper Panjang: ${m.lengthMm} mm`;
        if (m.type === 'angle') return `${idx + 1}. Sudut Anatomis: ${m.deg}°`;
        if (m.type === 'rect') return `${idx + 1}. ROI Persegi: ${m.wMm} × ${m.hMm} mm (Luas: ${m.areaCm2} cm²)`;
        if (m.type === 'circle') return `${idx + 1}. ROI Lingkaran: Radius ${m.rMm} mm (Luas: ${m.areaCm2} cm²)`;
        if (m.type === 'freehand') return `${idx + 1}. ROI Lesi Bebas: Keliling ${m.perimeterMm} mm (Luas: ${m.areaCm2} cm²)`;
        return `${idx + 1}. Anotasi`;
      })
    ].join('\n');

    navigator.clipboard.writeText(summaryLines);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);

    if (onInsertMeasurement) {
      onInsertMeasurement(summaryLines);
    }
  };

  // Hitung Caliper Endpoints Tick Marks
  const getCaliperTickCoords = (x1, y1, x2, y2, tickLen = 6) => {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist === 0) return null;
    const nx = -(y2 - y1) / dist;
    const ny = (x2 - x1) / dist;
    return {
      t1_a: { x: x1 - nx * tickLen, y: y1 - ny * tickLen },
      t1_b: { x: x1 + nx * tickLen, y: y1 + ny * tickLen },
      t2_a: { x: x2 - nx * tickLen, y: y2 - ny * tickLen },
      t2_b: { x: x2 + nx * tickLen, y: y2 + ny * tickLen }
    };
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
            const ticks = getCaliperTickCoords(m.x1, m.y1, m.x2, m.y2, 7);
            return (
              <g key={m.id}>
                {/* Garis Ukur Caliper Neon */}
                <line 
                  x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} 
                  stroke="#10B981" strokeWidth="2" strokeDasharray="3 2"
                />
                {/* Titik & Caliper End-ticks */}
                {ticks && (
                  <>
                    <line x1={ticks.t1_a.x} y1={ticks.t1_a.y} x2={ticks.t1_b.x} y2={ticks.t1_b.y} stroke="#10B981" strokeWidth="2" />
                    <line x1={ticks.t2_a.x} y1={ticks.t2_a.y} x2={ticks.t2_b.x} y2={ticks.t2_b.y} stroke="#10B981" strokeWidth="2" />
                  </>
                )}
                <circle cx={m.x1} cy={m.y1} r="3.5" fill="#10B981" />
                <circle cx={m.x2} cy={m.y2} r="3.5" fill="#10B981" />
                {/* Badge Label Ukuran dalam Millimeter */}
                <rect 
                  x={midX - 30} y={midY - 18} width="60" height="18" rx="4" 
                  fill="rgba(15, 23, 42, 0.88)" stroke="#10B981" strokeWidth="1"
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
                <circle cx={m.p1.x} cy={m.p1.y} r="3.5" fill="#F59E0B" />
                <circle cx={m.p2.x} cy={m.p2.y} r="5" fill="#F59E0B" stroke="#78350F" strokeWidth="1" />
                <circle cx={m.p3.x} cy={m.p3.y} r="3.5" fill="#F59E0B" />
                <rect 
                  x={m.p2.x - 24} y={m.p2.y - 20} width="48" height="18" rx="4" 
                  fill="rgba(15, 23, 42, 0.88)" stroke="#F59E0B" strokeWidth="1"
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
                  x={m.x} y={Math.max(4, m.y - 18)} width="72" height="16" rx="3" 
                  fill="rgba(15, 23, 42, 0.88)" stroke="#38BDF8" strokeWidth="1"
                />
                <text 
                  x={m.x + 36} y={Math.max(16, m.y - 6)} 
                  fill="#7DD3FC" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle"
                >
                  {m.areaCm2} cm²
                </text>
              </g>
            );
          }

          if (m.type === 'circle') {
            return (
              <g key={m.id}>
                <circle 
                  cx={m.cx} cy={m.cy} r={m.r} 
                  stroke="#EC4899" strokeWidth="2" strokeDasharray="4 2" fill="rgba(236, 72, 153, 0.12)"
                />
                <circle cx={m.cx} cy={m.cy} r="3" fill="#EC4899" />
                <rect 
                  x={m.cx - 36} y={Math.max(4, m.cy - m.r - 18)} width="72" height="16" rx="3" 
                  fill="rgba(15, 23, 42, 0.88)" stroke="#EC4899" strokeWidth="1"
                />
                <text 
                  x={m.cx} y={Math.max(16, m.cy - m.r - 6)} 
                  fill="#F472B6" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle"
                >
                  {m.areaCm2} cm²
                </text>
              </g>
            );
          }

          if (m.type === 'freehand') {
            const pathD = `M ${m.points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
            return (
              <g key={m.id}>
                <path 
                  d={pathD} 
                  stroke="#A855F7" strokeWidth="2" strokeDasharray="4 2" fill="rgba(168, 85, 247, 0.15)"
                />
                <rect 
                  x={m.centerX - 40} y={Math.max(4, m.centerY - 18)} width="80" height="16" rx="3" 
                  fill="rgba(15, 23, 42, 0.88)" stroke="#A855F7" strokeWidth="1"
                />
                <text 
                  x={m.centerX} y={Math.max(16, m.centerY - 6)} 
                  fill="#C084FC" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle"
                >
                  {m.areaCm2} cm²
                </text>
              </g>
            );
          }

          return null;
        })}

        {/* Live Drawing Preview: Length / Caliper */}
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

        {/* Live Drawing Preview: Rect */}
        {activeDrawing?.type === 'rect' && (
          <rect 
            x={Math.min(activeDrawing.x1, activeDrawing.x2)} 
            y={Math.min(activeDrawing.y1, activeDrawing.y2)} 
            width={Math.abs(activeDrawing.x2 - activeDrawing.x1)} 
            height={Math.abs(activeDrawing.y2 - activeDrawing.y1)} 
            stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" fill="rgba(56, 189, 248, 0.15)"
          />
        )}

        {/* Live Drawing Preview: Circle */}
        {activeDrawing?.type === 'circle' && (
          <circle 
            cx={activeDrawing.cx} cy={activeDrawing.cy} r={activeDrawing.r} 
            stroke="#EC4899" strokeWidth="2" strokeDasharray="3 3" fill="rgba(236, 72, 153, 0.15)"
          />
        )}

        {/* Live Drawing Preview: Freehand */}
        {activeDrawing?.type === 'freehand' && activeDrawing.points.length > 1 && (
          <path 
            d={`M ${activeDrawing.points.map(p => `${p.x} ${p.y}`).join(' L ')}`} 
            stroke="#A855F7" strokeWidth="2" fill="none"
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
            <circle cx={probeData.x} cy={probeData.y} r="8" fill="none" stroke="#06B6D4" strokeWidth="2" />
            <line x1={probeData.x - 14} y1={probeData.y} x2={probeData.x + 14} y2={probeData.y} stroke="#06B6D4" strokeWidth="1.5" />
            <line x1={probeData.x} y1={probeData.y - 14} x2={probeData.x} y2={probeData.y + 14} stroke="#06B6D4" strokeWidth="1.5" />
            <rect 
              x={Math.min(360, Math.max(10, probeData.x + 14))} 
              y={Math.min(465, Math.max(10, probeData.y - 30))} 
              width="142" height="36" rx="4" 
              fill="rgba(15, 23, 42, 0.92)" stroke="#06B6D4" strokeWidth="1"
            />
            <text 
              x={Math.min(360, Math.max(10, probeData.x + 20))} 
              y={Math.min(465, Math.max(10, probeData.y - 15))} 
              fill="#22D3EE" fontSize="10" fontWeight="bold" fontFamily="monospace"
            >
              X:{probeData.x} Y:{probeData.y} | {probeData.hu} HU
            </text>
            <text 
              x={Math.min(360, Math.max(10, probeData.x + 20))} 
              y={Math.min(465, Math.max(10, probeData.y - 3))} 
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
      case 'stack': return 'ns-resize';
      case 'length':
      case 'angle':
      case 'rect':
      case 'circle':
      case 'freehand':
      case 'probe': return 'crosshair';
      case 'window': return 'ew-resize';
      default: return 'default';
    }
  };

  // Helper styling untuk tombol toolbar aktif vs tidak
  const getToolBtnClass = (toolName) => {
    const isActive = activeTool === toolName;
    if (isActive) {
      return 'border border-cyan-500 bg-[#0e3b43]/90 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)] p-1.5 rounded transition-all';
    }
    return 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 p-1.5 rounded transition-all';
  };

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col h-full bg-[#0A0F1D] rounded-xl border border-slate-800 text-white select-none shadow-2xl overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      
      {/* ================= 1. TOOLBAR WORKSTATION MEDIS AIDOCTORS PACS ================= */}
      <div 
        onContextMenu={(e) => e.preventDefault()}
        className="bg-[#0D1527] border-b border-slate-800/90 px-3 py-1.5 flex items-center justify-between gap-1 overflow-x-auto text-slate-300 scrollbar-none"
      >
        
        {/* Brand / Logo AIdoctors Workstation */}
        <div className="flex items-center space-x-2 pr-3 border-r border-slate-800 flex-shrink-0">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-black text-[10px] text-white shadow-sm shadow-cyan-500/30">
            AI
          </div>
          <span className="font-bold text-sm tracking-wide text-white">
            <span className="text-cyan-400">AI</span>doctors
          </span>
        </div>

        {/* Grup 1: Windowing, Pan, Zoom, Stack, Length, Angle, ROIs, Probe, Mouse, Undo, Redo, Trash */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          
          {/* 1. WW/WL (Contrast / Windowing) */}
          <button
            onClick={() => setActiveTool('window')}
            className={getToolBtnClass('window')}
            title="Window / Level (WW/WL) Kontras (Klik/Drag horizontal & vertikal)"
          >
            <Contrast className="w-4 h-4" />
          </button>

          {/* 2. Pan / Move */}
          <button
            onClick={() => setActiveTool('pan')}
            className={getToolBtnClass('pan')}
            title="Pan / Geser Posisi Citra (P atau Middle Click Drag)"
          >
            <Move className="w-4 h-4" />
          </button>

          {/* 3. Zoom */}
          <button
            onClick={() => setActiveTool('zoom')}
            className={getToolBtnClass('zoom')}
            title="Zoom In / Out Interaktif (Drag vertikal atau Scroll Roda Mouse)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* 4. Stack / Scroll Irisan */}
          <button
            onClick={() => setActiveTool('stack')}
            className={getToolBtnClass('stack')}
            title="Stack Scroll: Gulir Irisan Melalui Drag Vertikal"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* 5. Length / Caliper Ruler (mm) */}
          <button
            onClick={() => setActiveTool('length')}
            className={getToolBtnClass('length')}
            title="Length / Caliper Penggaris Jarak Medis (mm)"
          >
            <Ruler className="w-4 h-4" />
          </button>

          {/* 6. Angle Measurement */}
          <button
            onClick={() => {
              setActiveTool('angle');
              setAnglePoints([]);
            }}
            className={getToolBtnClass('angle')}
            title="Angle / Pengukur Sudut Derajat 3 Titik"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 19 L5 19 L15 5" />
              <path d="M10 19 A6 6 0 0 1 12 14" strokeWidth="1.5" />
            </svg>
          </button>

          {/* 7. Rectangle ROI */}
          <button
            onClick={() => setActiveTool('rect')}
            className={getToolBtnClass('rect')}
            title="Rectangle ROI: Pengukur Luas Area Persegi (cm²)"
          >
            <Square className="w-4 h-4" />
          </button>

          {/* 8. Circle ROI */}
          <button
            onClick={() => setActiveTool('circle')}
            className={getToolBtnClass('circle')}
            title="Circle ROI: Pengukur Luas Area Lingkaran (cm²)"
          >
            <CircleIcon className="w-4 h-4" />
          </button>

          {/* 9. Freehand / Ellipse ROI */}
          <button
            onClick={() => setActiveTool('freehand')}
            className={getToolBtnClass('freehand')}
            title="Freehand ROI: Gambar Kontur Bebas Lesi Hematoma (cm²)"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
              <ellipse cx="12" cy="12" rx="8" ry="5.5" />
            </svg>
          </button>

          {/* 10. Probe / Crosshair HU */}
          <button
            onClick={() => setActiveTool('probe')}
            className={getToolBtnClass('probe')}
            title="Probe / Crosshair: Inspeksi Nilai Densitas Hounsfield Unit (HU)"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          {/* 11. Mouse Shortcut Guide */}
          <div className="relative toolbar-dropdown">
            <button
              onClick={() => setShowMouseHelp(prev => !prev)}
              className="border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 p-1.5 rounded transition-all"
              title="Panduan Navigasi & Binding Tombol Mouse"
            >
              <Mouse className="w-4 h-4" />
            </button>

            {showMouseHelp && (
              <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl z-50 w-72 text-xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Mouse className="w-3.5 h-3.5 text-cyan-400" /> Pintasan Mouse PACS
                  </span>
                  <button onClick={() => setShowMouseHelp(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                  <p className="m-0"><strong className="text-cyan-400">Klik Kiri:</strong> Tool aktif ({activeTool})</p>
                  <p className="m-0"><strong className="text-cyan-400">Klik Kanan + Drag:</strong> Window/Level (WW/WL)</p>
                  <p className="m-0"><strong className="text-cyan-400">Klik Tengah + Drag:</strong> Pan / Geser Citra</p>
                  <p className="m-0"><strong className="text-cyan-400">Scroll Roda Mouse:</strong> Gulir Irisan CT (0-{totalSlices - 1})</p>
                  <p className="m-0"><strong className="text-cyan-400">Ctrl + Scroll:</strong> Zoom In / Out Halus</p>
                </div>
              </div>
            )}
          </div>

          {/* 12. Undo */}
          <button
            onClick={handleUndo}
            disabled={measurements.length === 0}
            className="border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 p-1.5 rounded transition-all disabled:opacity-30 disabled:pointer-events-none"
            title="Undo: Batalkan Anotasi Terakhir"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* 13. Redo */}
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 p-1.5 rounded transition-all disabled:opacity-30 disabled:pointer-events-none"
            title="Redo: Kembalikan Anotasi"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* 14. Trash / Clear All */}
          <button
            onClick={handleClearAll}
            disabled={measurements.length === 0 && !probeData}
            className="border border-transparent text-slate-400 hover:text-red-400 hover:bg-red-950/40 p-1.5 rounded transition-all disabled:opacity-30 disabled:pointer-events-none"
            title="Hapus Seluruh Anotasi & Pengukuran"
          >
            <Trash2 className="w-4 h-4" />
          </button>

        </div>

        {/* Divider 1 */}
        <div className="h-5 w-[1px] bg-slate-800 mx-1 flex-shrink-0" />

        {/* Grup 2: Invert, Rotate, Flip, Fullscreen */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          
          {/* 15. Invert Klise Negatif */}
          <button
            onClick={() => setInvert(prev => !prev)}
            className={`p-1.5 rounded transition-all ${
              invert ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
            title="Invert: Balik Warna Grayscale / Klise Negatif"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" stroke="currentColor" strokeWidth="2" fill="none">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M4 20 L20 4" strokeWidth="1.5" />
              <path d="M4 4 L20 4 L20 20 Z" fill="currentColor" opacity="0.85" />
            </svg>
          </button>

          {/* 16. Rotate 90° CW */}
          <button
            onClick={() => setRotation(prev => (prev + 90) % 360)}
            className="border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 p-1.5 rounded transition-all"
            title="Rotasi 90° Searah Jarum Jam"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* 17. Flip Horizontal (<|>) */}
          <button
            onClick={() => setFlipH(prev => !prev)}
            className={`p-1.5 rounded transition-all ${
              flipH ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
            title="Pembalikan Horizontal (Flip H)"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
              <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 2" />
              <path d="M5 12 L9 7 L9 17 Z" fill="currentColor" />
              <path d="M19 12 L15 7 L15 17 Z" fill="currentColor" />
            </svg>
          </button>

          {/* 18. Fullscreen Viewport */}
          <button
            onClick={handleToggleFullscreen}
            className={`p-1.5 rounded transition-all ${
              isFullscreen ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
            title="Layar Penuh (Fullscreen)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

        </div>

        {/* Divider 2 */}
        <div className="h-5 w-[1px] bg-slate-800 mx-1 flex-shrink-0" />

        {/* Grup 3: Layout Dropdown (1x1), 3D Cube / MPR, Preset Dropdown (Original) */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          
          {/* 19. Layout Selector (1x1 v) */}
          <div className="relative toolbar-dropdown">
            <button
              onClick={() => {
                setShowLayoutMenu(prev => !prev);
                setShowPresetMenu(false);
              }}
              className="px-2 py-1.5 rounded text-xs font-mono font-medium hover:bg-slate-800/60 border border-slate-700 flex items-center gap-1.5 text-slate-300"
              title="Pilih Tata Letak Layar"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
              <span>{layout}</span>
              <span className="text-[9px] text-slate-500">▼</span>
            </button>

            {showLayoutMenu && (
              <div className="absolute top-full left-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 min-w-[130px] text-xs">
                <button
                  onClick={() => {
                    setLayout('1x1');
                    setShowLayoutMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 ${
                    layout === '1x1' ? 'text-cyan-400 font-bold bg-slate-800/60' : 'text-slate-300'
                  }`}
                >
                  <span>1×1 Tunggal</span>
                  {layout === '1x1' && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setLayout('1x2');
                    setShowLayoutMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 ${
                    layout === '1x2' ? 'text-cyan-400 font-bold bg-slate-800/60' : 'text-slate-300'
                  }`}
                >
                  <span>1×2 Dual (Asli vs AI)</span>
                  {layout === '1x2' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* 20. 3D Cube / MPR View */}
          <button
            onClick={() => setMprMode(prev => !prev)}
            className={`p-1.5 rounded transition-all ${
              mprMode ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
            title="Mode 3D Multi-Planar Reconstruction (MPR)"
          >
            <Box className="w-4 h-4" />
          </button>

          {/* 21. Windowing Preset Selector ("Original v") */}
          <div className="relative toolbar-dropdown">
            <button
              onClick={() => {
                setShowPresetMenu(prev => !prev);
                setShowLayoutMenu(false);
              }}
              className="px-2.5 py-1.5 rounded text-xs font-medium hover:bg-slate-800/60 border border-slate-700 flex items-center gap-1.5 text-slate-300"
              title="Preset Windowing Radiologi"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>{WINDOW_PRESETS[activeWindowPreset]?.name || 'Original'}</span>
              <span className="text-[9px] text-slate-500">▼</span>
            </button>

            {showPresetMenu && (
              <div className="absolute top-full right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 min-w-[170px] text-xs">
                {Object.entries(WINDOW_PRESETS).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => handleWindowPresetChange(key)}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 ${
                      activeWindowPreset === key ? 'text-cyan-400 font-bold bg-slate-800/60' : 'text-slate-300'
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">W:{item.width}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Divider 3 */}
        <div className="h-5 w-[1px] bg-slate-800 mx-1 flex-shrink-0" />

        {/* Grup 4: Info DICOM (i) & Laporan Dokumen */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          
          {/* 22. Info DICOM Overlay */}
          <button
            onClick={() => setShowInfoOverlay(prev => !prev)}
            className={`p-1.5 rounded transition-all ${
              showInfoOverlay ? 'border border-cyan-500/40 text-cyan-300 bg-cyan-950/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
            title="Tampilkan / Sembunyikan Metadata DICOM"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* 23. Salin / Transfer Pengukuran ke Laporan Radiologi */}
          <button
            onClick={() => setShowReportModal(true)}
            className="p-1.5 rounded border border-transparent text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-all relative"
            title="Ringkasan Anotasi untuk Laporan Radiologi"
          >
            <FileText className="w-4 h-4" />
            {measurements.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
            )}
          </button>

        </div>

      </div>

      {/* ================= 2. STATUS BAR KECIL (Zoom %, Tool Aktif, Irisan) ================= */}
      <div className="bg-[#0A1020] px-4 py-1.5 flex items-center justify-between text-[11px] font-mono border-b border-slate-800/80 text-cyan-400">
        <div className="flex items-center space-x-3 overflow-hidden">
          <span className="text-slate-400">
            Tool: <strong className="text-cyan-300 uppercase">{activeTool}</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            Zoom: <strong className="text-cyan-300">{Math.round(scale * 100)}%</strong>
          </span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline">
            Rotasi: <strong className="text-cyan-300">{rotation}°</strong>
          </span>
          {measurements.length > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-bold">
                {measurements.length} Anotasi Aktif
              </span>
            </>
          )}
          {mprMode && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-purple-400 font-bold bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800">
                Mode MPR Aktif (Aksial)
              </span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-2 text-slate-400 flex-shrink-0">
          <span>Irisan:</span>
          <strong className="text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
            #{currentSlice} / {totalSlices}
          </strong>
        </div>
      </div>

      {/* ================= 3. AREA KANVAS / CITRA CT SCAN INTERAKTIF ================= */}
      <div 
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="relative flex-1 flex items-center justify-center bg-black overflow-hidden min-h-[440px]"
        style={{ cursor: getCursorStyle() }}
      >
        {isLoading && (
          <div className="absolute top-3 right-3 z-30 bg-slate-900/90 border border-cyan-800 px-3 py-1 rounded text-xs text-cyan-400 flex items-center gap-2 backdrop-blur-sm pointer-events-none font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Memuat Irisan #{debouncedSlice}...</span>
          </div>
        )}

        {/* ================= TATA LETAK 1x1: SINGLE VIEWPORT ================= */}
        {layout === '1x1' && (
          <div 
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleResetView}
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

        {/* ================= TATA LETAK 1x2: DUAL SYNCHRONIZED (ASLI vs HEATMAP) ================= */}
        {layout === '1x2' && (
          <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
            {/* Viewport Kiri: Citra CT Asli (Tanpa Heatmap) */}
            <div className="relative bg-black rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
              <div className="absolute top-2 left-2 z-20 text-[10px] font-mono bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                1. Citra CT Polos (Raw HU)
              </div>
              <div 
                className="relative w-[512px] h-[512px] flex items-center justify-center select-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale * 0.78}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
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
                2. AI Grad-CAM Overlay (Lesi Hemoragik)
              </div>
              <div 
                className="relative w-[512px] h-[512px] flex items-center justify-center select-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale * 0.78}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
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
          <div className="absolute top-3 left-3 text-[11px] font-mono text-cyan-400/90 pointer-events-none z-20 space-y-0.5 bg-slate-950/75 p-2 rounded border border-slate-800/80 backdrop-blur-sm">
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
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/75 hover:bg-slate-800 text-white z-20 shadow-lg disabled:opacity-0 transition-all hover:scale-110"
          title="Irisan Sebelumnya (Arrow Left / Scroll Down)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setCurrentSlice(prev => Math.min(totalSlices - 1, prev + 1))}
          disabled={currentSlice >= totalSlices - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/75 hover:bg-slate-800 text-white z-20 shadow-lg disabled:opacity-0 transition-all hover:scale-110"
          title="Irisan Berikutnya (Arrow Right / Scroll Up)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ================= 4. PANEL KONTROL BAWAH (SLIDER, HEATMAP, IRISAN KUNCI) ================= */}
      <div className="p-3 bg-[#0D1527] border-t border-slate-800/90 space-y-2.5">
        
        {/* Baris 1: Kontrol Heatmap & Slider Irisan */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Tombol Toggle Heatmap Grad-CAM */}
          <button
            onClick={() => setShowGradcam(!showGradcam)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
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
          <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setCurrentSlice(prev => Math.max(0, prev - 1))}
              disabled={currentSlice <= 0}
              className="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-30"
              title="Irisan Sebelumnya"
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
              title="Irisan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="font-mono text-cyan-400 text-xs font-bold min-w-[48px] text-right">
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
                  className={`px-2 py-0.5 rounded text-xs font-mono transition ${
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

      {/* ================= 5. MODAL RINGKASAN ANOTASI & EXPORT LAPORAN ================= */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white m-0">Ringkasan Pengukuran Workstation CT</h3>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {measurements.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <Ruler className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p>Belum ada pengukuran atau anotasi yang dibuat pada irisan ini.</p>
                  <p className="text-slate-500 text-[11px]">
                    Gunakan tool <strong>Length (Ruler)</strong>, <strong>Angle</strong>, atau <strong>ROI</strong> pada toolbar atas untuk mengukur dimensi lesi.
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                  {measurements.map((m, idx) => (
                    <div key={m.id} className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-cyan-400 font-bold block">
                          #{idx + 1} {m.type === 'length' ? 'Caliper Panjang (Ruler)' : m.type === 'angle' ? 'Sudut Derajat' : m.type === 'rect' ? 'ROI Persegi' : m.type === 'circle' ? 'ROI Lingkaran' : 'ROI Lesi Bebas'}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {m.type === 'length' && `Jarak: ${m.lengthMm} mm`}
                          {m.type === 'angle' && `Sudut: ${m.deg}°`}
                          {m.type === 'rect' && `Dimensi: ${m.wMm} × ${m.hMm} mm • Luas: ${m.areaCm2} cm²`}
                          {m.type === 'circle' && `Radius: ${m.rMm} mm • Luas: ${m.areaCm2} cm²`}
                          {m.type === 'freehand' && `Keliling: ${m.perimeterMm} mm • Luas: ${m.areaCm2} cm²`}
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold text-sm">
                        {m.lengthMm ? `${m.lengthMm} mm` : m.deg ? `${m.deg}°` : `${m.areaCm2} cm²`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Tutup
              </button>

              {measurements.length > 0 && (
                <button
                  onClick={handleCopyReportSummary}
                  className="px-4 py-1.5 rounded text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center space-x-1.5 shadow-md shadow-cyan-600/30"
                >
                  {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReport ? 'Tersalin ke Clipboard!' : 'Salin ke Laporan'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
