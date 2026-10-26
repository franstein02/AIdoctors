import React, { useRef, useEffect, useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Ruler, 
  Crosshair, 
  Layers,
  Flame,
  Sun,
  Contrast,
  Sliders,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function DicomCanvasViewer({
  patient,
  currentSlice,
  setCurrentSlice,
  showHeatmap,
  setShowHeatmap,
  windowMode,
  setWindowMode
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [heatmapOpacity, setHeatmapOpacity] = useState(0.75);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isInverted, setIsInverted] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurement, setMeasurement] = useState(null); // { start: {x,y}, end: {x,y}, distMm }
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Windowing presets
  const windowSpecs = {
    brain: { name: 'Brain Window', w: 80, l: 40, desc: 'Parenkim & Perdarahan Akut' },
    subdural: { name: 'Subdural Window', w: 200, l: 80, desc: 'Diferensiasi Darah vs Kalvaria' },
    bone: { name: 'Bone Window', w: 2500, l: 500, desc: 'Korteks Tulang & Fraktur' },
  };

  // Reset viewport
  const handleReset = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
    setIsInverted(false);
    setMeasurement(null);
    setMeasureMode(false);
  };

  // Draw simulated DICOM CT image onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.save();
    ctx.fillStyle = isInverted ? '#E2E8F0' : '#04070D';
    ctx.fillRect(0, 0, width, height);

    // Apply Zoom & Pan transform
    ctx.translate(width / 2 + panOffset.x, height / 2 + panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-width / 2, -height / 2);

    const centerX = width / 2;
    const centerY = height / 2;
    const sliceRatio = (currentSlice - 1) / (patient.total_slices - 1); // 0.0 to 1.0

    // Color definitions based on Windowing & Inversion
    let bgParenchyma, boneColor, csfColor, bleedColor;

    if (windowMode === 'bone') {
      bgParenchyma = isInverted ? '#CBD5E1' : '#1E293B';
      boneColor = isInverted ? '#0F172A' : '#FFFFFF';
      csfColor = isInverted ? '#E2E8F0' : '#0B0F19';
      bleedColor = isInverted ? '#94A3B8' : '#334155';
    } else if (windowMode === 'subdural') {
      bgParenchyma = isInverted ? '#E2E8F0' : '#2D3748';
      boneColor = isInverted ? '#000000' : '#FFFFFF';
      csfColor = isInverted ? '#FFFFFF' : '#0A0E1A';
      bleedColor = isInverted ? '#1E293B' : '#E2E8F0'; // Subdural window separates fresh blood from skull
    } else {
      // Default Brain Window
      bgParenchyma = isInverted ? '#D1D5DB' : '#334155';
      boneColor = isInverted ? '#000000' : '#FFFFFF';
      csfColor = isInverted ? '#FFFFFF' : '#070A12';
      bleedColor = isInverted ? '#111827' : '#F1F5F9'; // Hyperdense fresh blood
    }

    // 1. Draw Outer Head Soft Tissue & Scalp
    const headRadiusX = 180 + Math.sin(sliceRatio * Math.PI) * 15;
    const headRadiusY = 215 + Math.sin(sliceRatio * Math.PI) * 18;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY - 5, headRadiusX + 8, headRadiusY + 8, 0, 0, 2 * Math.PI);
    ctx.fillStyle = isInverted ? '#E5E7EB' : '#1E2530';
    ctx.fill();

    // 2. Draw Calvarium / Skull Bone Ring (White dense bone)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - 5, headRadiusX, headRadiusY, 0, 0, 2 * Math.PI);
    ctx.lineWidth = windowMode === 'bone' ? 14 : 9;
    ctx.strokeStyle = boneColor;
    ctx.stroke();

    // 3. Draw Brain Parenchyma (Cerebral hemispheres)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - 5, headRadiusX - 9, headRadiusY - 9, 0, 0, 2 * Math.PI);
    ctx.fillStyle = bgParenchyma;
    ctx.fill();

    // Subtle Grey/White matter texture gradient
    const parenchGrad = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, headRadiusX - 10);
    parenchGrad.addColorStop(0, isInverted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)');
    parenchGrad.addColorStop(0.7, isInverted ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.15)');
    parenchGrad.addColorStop(1, isInverted ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.3)');
    ctx.fillStyle = parenchGrad;
    ctx.fill();

    // 4. Draw Falx Cerebri (Midline structure)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - headRadiusY + 14);
    ctx.lineTo(centerX, centerY + headRadiusY - 14);
    ctx.strokeStyle = isInverted ? '#9CA3AF' : '#64748B';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 5. Draw Ventricular System depending on slice height
    // Slices 12 - 24 have prominent lateral ventricles (butterfly wings)
    if (currentSlice >= 10 && currentSlice <= 26) {
      const ventScale = Math.sin(((currentSlice - 10) / 16) * Math.PI);
      const ventWidth = 24 * ventScale;
      const ventHeight = 55 * ventScale;

      // Left Lateral Ventricle (Anterior horn)
      ctx.beginPath();
      ctx.moveTo(centerX + 6, centerY - 45 * ventScale);
      ctx.bezierCurveTo(
        centerX + 6 + ventWidth, centerY - 20 * ventScale,
        centerX + 4 + ventWidth, centerY + 20 * ventScale,
        centerX + 4, centerY + ventHeight
      );
      ctx.bezierCurveTo(
        centerX + 2, centerY + 15 * ventScale,
        centerX + 3, centerY - 15 * ventScale,
        centerX + 6, centerY - 45 * ventScale
      );
      ctx.fillStyle = csfColor;
      ctx.fill();

      // Right Lateral Ventricle (may show mass effect if bleeding is on the right)
      const massEffectShift = (patient.tier === 'MERAH' && patient.lesion_type === 'subdural' && currentSlice >= 16) ? -4 : 0;
      ctx.beginPath();
      ctx.moveTo(centerX - 6 + massEffectShift, centerY - 45 * ventScale);
      ctx.bezierCurveTo(
        centerX - 6 - ventWidth * 0.75 + massEffectShift, centerY - 20 * ventScale,
        centerX - 4 - ventWidth * 0.75 + massEffectShift, centerY + 20 * ventScale,
        centerX - 4 + massEffectShift, centerY + ventHeight
      );
      ctx.bezierCurveTo(
        centerX - 2 + massEffectShift, centerY + 15 * ventScale,
        centerX - 3 + massEffectShift, centerY - 15 * ventScale,
        centerX - 6 + massEffectShift, centerY - 45 * ventScale
      );
      ctx.fillStyle = csfColor;
      ctx.fill();

      // Third Ventricle (Midline slit)
      if (currentSlice >= 12 && currentSlice <= 19) {
        ctx.beginPath();
        ctx.ellipse(centerX - 1 + massEffectShift * 0.5, centerY, 2.5, 14 * ventScale, 0, 0, 2 * Math.PI);
        ctx.fillStyle = csfColor;
        ctx.fill();
      }
    }

    // 6. Draw Cortical Sulci (Surface convolutions)
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = csfColor;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.35) {
      const rx = headRadiusX - 16;
      const ry = headRadiusY - 16;
      const sx = centerX + Math.cos(angle) * rx;
      const sy = centerY - 5 + Math.sin(angle) * ry;
      const ex = centerX + Math.cos(angle) * (rx - 14 - Math.sin(angle * 4) * 6);
      const ey = centerY - 5 + Math.sin(angle) * (ry - 14 - Math.sin(angle * 4) * 6);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // 7. Draw Bleeding Lesions (Pathology based on patient diagnosis)
    // Patient Tn. Budi: Acute Subdural Hematoma (SDH) on Right Frontoparietal (Axial CT Left side is Patient's Right: hemisfer dekstra!)
    if (patient.lesion_type === 'subdural') {
      // Visible on slices 13 to 22, peaking at slice 18
      if (currentSlice >= 13 && currentSlice <= 22) {
        const severity = 1 - Math.abs(currentSlice - 18) / 6; // 1.0 at slice 18
        if (severity > 0) {
          ctx.save();
          // Crescent shape hugging inner table of skull on patient's right (radiology standard: left of screen)
          ctx.beginPath();
          const startAngle = Math.PI * 0.75;
          const endAngle = Math.PI * 1.35;
          const rInner = headRadiusX - 12 - severity * 16;
          const rOuter = headRadiusX - 10;
          
          // Outer arc
          ctx.ellipse(centerX, centerY - 5, rOuter, rOuter * 1.15, 0, startAngle, endAngle);
          // Inner crescent arc
          ctx.ellipse(centerX + severity * 8, centerY - 5, rInner, rInner * 1.1, 0, endAngle, startAngle, true);
          ctx.closePath();

          ctx.fillStyle = bleedColor;
          ctx.fill();

          // High density core
          ctx.lineWidth = 2;
          ctx.strokeStyle = isInverted ? '#000000' : '#FFFFFF';
          ctx.stroke();
          ctx.restore();
        }
      }
    } else if (patient.lesion_type === 'intraparenchymal') {
      // Ny. Sari: Intraparenchymal Hemorrhage in Right Basal Ganglia (slices 12 - 18, peaking at 15)
      if (currentSlice >= 11 && currentSlice <= 19) {
        const severity = 1 - Math.abs(currentSlice - 15) / 5;
        if (severity > 0) {
          const lesionX = centerX - 42; // Patient right
          const lesionY = centerY - 15;

          // Edema ring (hypodense)
          ctx.beginPath();
          ctx.ellipse(lesionX, lesionY, (18 + 8) * severity, (15 + 8) * severity, 0.2, 0, 2 * Math.PI);
          ctx.fillStyle = isInverted ? '#F3F4F6' : '#1E293B';
          ctx.fill();

          // Acute hematoma core (hyperdense)
          ctx.beginPath();
          ctx.ellipse(lesionX, lesionY, 18 * severity, 15 * severity, 0.2, 0, 2 * Math.PI);
          ctx.fillStyle = bleedColor;
          ctx.fill();
        }
      }
    } else if (patient.lesion_type === 'epidural') {
      // Epidural Biconvex Lens (slices 14 - 20, peaking at 17)
      if (currentSlice >= 13 && currentSlice <= 21) {
        const severity = 1 - Math.abs(currentSlice - 17) / 5;
        if (severity > 0) {
          ctx.save();
          ctx.beginPath();
          // Biconvex lens on left side
          const epX = centerX + headRadiusX - 20;
          const epY = centerY - 10;
          ctx.ellipse(epX, epY, 20 * severity, 38 * severity, -0.3, 0, 2 * Math.PI);
          ctx.fillStyle = bleedColor;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 8. Grad-CAM Heatmap Overlay
    if (showHeatmap && patient.tier === 'MERAH') {
      ctx.save();
      ctx.globalAlpha = heatmapOpacity;

      if (patient.lesion_type === 'subdural') {
        const severity = Math.max(0, 1 - Math.abs(currentSlice - 18) / 6);
        if (severity > 0.1) {
          // Heatmap focused on right frontoparietal subdural space
          const hX = centerX - headRadiusX * 0.72;
          const hY = centerY - 10;
          const radius = (70 + severity * 35);

          const heatGrad = ctx.createRadialGradient(hX, hY, 10, hX, hY, radius);
          heatGrad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');   // Deep Red
          heatGrad.addColorStop(0.35, 'rgba(249, 115, 22, 0.85)'); // Orange
          heatGrad.addColorStop(0.65, 'rgba(234, 179, 8, 0.65)');  // Yellow
          heatGrad.addColorStop(0.85, 'rgba(34, 197, 94, 0.35)');  // Green
          heatGrad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');    // Transparent Blue

          ctx.fillStyle = heatGrad;
          ctx.beginPath();
          ctx.arc(hX, hY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (patient.lesion_type === 'intraparenchymal') {
        const severity = Math.max(0, 1 - Math.abs(currentSlice - 15) / 5);
        if (severity > 0.1) {
          const hX = centerX - 42;
          const hY = centerY - 15;
          const radius = 65 * severity + 25;

          const heatGrad = ctx.createRadialGradient(hX, hY, 8, hX, hY, radius);
          heatGrad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
          heatGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.85)');
          heatGrad.addColorStop(0.7, 'rgba(234, 179, 8, 0.60)');
          heatGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = heatGrad;
          ctx.beginPath();
          ctx.arc(hX, hY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (patient.lesion_type === 'epidural') {
        const severity = Math.max(0, 1 - Math.abs(currentSlice - 17) / 5);
        if (severity > 0.1) {
          const hX = centerX + headRadiusX - 25;
          const hY = centerY - 10;
          const radius = 60 * severity + 25;

          const heatGrad = ctx.createRadialGradient(hX, hY, 8, hX, hY, radius);
          heatGrad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
          heatGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.85)');
          heatGrad.addColorStop(0.7, 'rgba(234, 179, 8, 0.60)');
          heatGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = heatGrad;
          ctx.beginPath();
          ctx.arc(hX, hY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // 9. Caliper Measurement line if drawn
    if (measurement) {
      ctx.save();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2 / zoomLevel;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(measurement.start.x, measurement.start.y);
      ctx.lineTo(measurement.end.x, measurement.end.y);
      ctx.stroke();

      // End tick points
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(measurement.start.x, measurement.start.y, 4 / zoomLevel, 0, Math.PI * 2);
      ctx.arc(measurement.end.x, measurement.end.y, 4 / zoomLevel, 0, Math.PI * 2);
      ctx.fill();

      // Text label
      const midX = (measurement.start.x + measurement.end.x) / 2;
      const midY = (measurement.start.y + measurement.end.y) / 2 - 10;
      ctx.font = `bold ${Math.max(12, 14 / zoomLevel)}px Inter, sans-serif`;
      ctx.fillStyle = '#22C55E';
      ctx.fillText(`${measurement.distMm} mm`, midX + 5, midY);
      ctx.restore();
    }

    // 10. Crosshair Grid
    if (showCrosshair) {
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1 / zoomLevel;
      ctx.setLineDash([6, 6]);

      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // Restore base transform

  }, [
    currentSlice, 
    patient, 
    showHeatmap, 
    heatmapOpacity, 
    windowMode, 
    zoomLevel, 
    panOffset, 
    isInverted, 
    showCrosshair, 
    measurement
  ]);

  // Handle Mouse / Wheel interactions
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Scroll slice up
      setCurrentSlice(prev => Math.min(patient.total_slices, prev + 1));
    } else {
      // Scroll slice down
      setCurrentSlice(prev => Math.max(1, prev - 1));
    }
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (measureMode) {
      // Start measurement
      setMeasurement({
        start: { x: mouseX, y: mouseY },
        end: { x: mouseX, y: mouseY },
        distMm: 0
      });
      setIsDragging(true);
    } else {
      // Pan mode
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (measureMode && measurement) {
      const dx = mouseX - measurement.start.x;
      const dy = mouseY - measurement.start.y;
      const pixelDist = Math.sqrt(dx * dx + dy * dy);
      // Rough DICOM scale: 1 pixel ~ 0.45 mm
      const distMm = (pixelDist * 0.45 / zoomLevel).toFixed(1);
      setMeasurement(prev => ({
        ...prev,
        end: { x: mouseX, y: mouseY },
        distMm
      }));
    } else if (!measureMode) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative flex flex-col h-full bg-[#090D16] text-slate-200 select-none overflow-hidden rounded-xl border border-slate-800 shadow-2xl">
      {/* Viewport Top Bar (Cornerstone.js toolbar & metadata) */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between text-xs gap-2 z-20">
        {/* Slice & Series info */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded text-cyan-400 font-mono font-medium border border-cyan-900/40">
            <Layers className="w-3.5 h-3.5" />
            <span>Slice {currentSlice} / {patient.total_slices}</span>
          </div>
          <span className="hidden sm:inline text-slate-400 text-[11px]">
            {patient.modalitas} (Axial) • 512×512 px
          </span>
        </div>

        {/* Window Preset Selector */}
        <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          {Object.entries(windowSpecs).map(([key, item]) => (
            <button
              key={key}
              onClick={() => setWindowMode(key)}
              title={`${item.desc} (W:${item.w}, L:${item.l})`}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                windowMode === key
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {key === 'brain' ? 'Brain (W:80)' : key === 'subdural' ? 'Subdural (W:200)' : 'Bone (W:2500)'}
            </button>
          ))}
        </div>

        {/* Viewer Tools (Zoom, Invert, Crosshair, Measure) */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setZoomLevel(prev => Math.min(3.0, prev + 0.25))}
            title="Perbesar (Zoom In)"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
            title="Perkecil (Zoom Out)"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsInverted(!isInverted)}
            title="Invert Warna Grayscale"
            className={`p-1 rounded ${isInverted ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
          >
            <Contrast className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowCrosshair(!showCrosshair)}
            title="Toggle Garis Bidik (Crosshair)"
            className={`p-1 rounded ${showCrosshair ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setMeasureMode(!measureMode);
              if (measureMode) setMeasurement(null);
            }}
            title="Alat Ukur Jarak / Kaliper (Caliper mm)"
            className={`p-1 rounded ${measureMode ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
          >
            <Ruler className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            title="Reset Posisi & Tampilan"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="relative flex-1 flex items-center justify-center overflow-hidden cursor-crosshair min-h-[360px]"
      >
        <canvas
          ref={canvasRef}
          width={520}
          height={520}
          className="max-h-full max-w-full object-contain"
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

        {/* Top-Left DICOM Text Overlay */}
        <div className="absolute top-3 left-3 text-[11px] font-mono text-slate-300 leading-tight bg-slate-950/70 p-2 rounded backdrop-blur border border-slate-800/60 pointer-events-none">
          <div className="text-white font-bold">{patient.nama_pasien}</div>
          <div className="text-slate-400">ID: {patient.id} • {patient.usia} Th / {patient.jenis_kelamin === 'Laki-laki' ? 'M' : 'F'}</div>
          <div className="text-slate-400">No. RM: {patient.no_rm}</div>
          <div className="text-cyan-400 text-[10px] mt-0.5">PACS: Orthanc DICOM v1.12</div>
        </div>

        {/* Top-Right Technical Overlays */}
        <div className="absolute top-3 right-3 text-[11px] font-mono text-right text-slate-300 leading-tight bg-slate-950/70 p-2 rounded backdrop-blur border border-slate-800/60 pointer-events-none">
          <div className="text-slate-200">{patient.modalitas}</div>
          <div className="text-cyan-300">{windowSpecs[windowMode].name}</div>
          <div className="text-slate-400">W: {windowSpecs[windowMode].w} L: {windowSpecs[windowMode].l}</div>
          <div className="text-slate-400">Zoom: {(zoomLevel * 100).toFixed(0)}%</div>
        </div>

        {/* Bottom-Left Heatmap Legend Indicator when Active */}
        {showHeatmap && patient.tier === 'MERAH' && (
          <div className="absolute bottom-3 left-3 bg-slate-950/80 border border-red-900/60 p-2 rounded backdrop-blur text-[10px] flex items-center space-x-2 pointer-events-none">
            <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <div>
              <div className="font-semibold text-red-400">Grad-CAM Overlay Aktif</div>
              <div className="flex items-center space-x-1 mt-0.5">
                <span className="text-[9px] text-slate-400">Rendah</span>
                <div className="w-16 h-2 rounded bg-gradient-to-r from-blue-500 via-yellow-400 to-red-600"></div>
                <span className="text-[9px] text-slate-400">Kritis</span>
              </div>
            </div>
          </div>
        )}

        {/* Instruction badge at bottom center */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/80 px-2.5 py-0.5 rounded-full text-[10px] text-slate-400 border border-slate-800 pointer-events-none">
          Gulir roda mouse untuk irisan • Tarik untuk geser
        </div>
      </div>

      {/* Viewport Bottom Controls Bar: Heatmap Toggle, Slider, and Key Slices */}
      <div className="p-3 bg-slate-900/95 border-t border-slate-800 space-y-2 z-20">
        {/* Heatmap & Slider Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Heatmap Toggle Switch */}
          <div className="flex items-center space-x-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`flex items-center space-x-2 font-medium px-2 py-1 rounded transition-all ${
                showHeatmap
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>Toggle Heatmap Grad-CAM: {showHeatmap ? 'ON' : 'OFF'}</span>
            </button>

            {showHeatmap && (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <span className="text-[11px] text-slate-400">Opasitas:</span>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={heatmapOpacity}
                  onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                  className="w-20 accent-red-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-300">{(heatmapOpacity * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Interactive Slice Slider & Stepper */}
          <div className="flex-1 min-w-[220px] flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setCurrentSlice(prev => Math.max(1, prev - 1))}
              disabled={currentSlice <= 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="range"
              min="1"
              max={patient.total_slices}
              value={currentSlice}
              onChange={(e) => setCurrentSlice(parseInt(e.target.value))}
              className="flex-1 accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />

            <button
              onClick={() => setCurrentSlice(prev => Math.min(patient.total_slices, prev + 1))}
              disabled={currentSlice >= patient.total_slices}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="font-mono text-xs font-semibold text-cyan-400 w-12 text-right">
              #{currentSlice}
            </span>
          </div>
        </div>

        {/* Key Slices Shortcuts (Pintasan Irisan Kunci) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-400 font-medium flex items-center">
            Pintasan Irisan Kunci (irisan_kunci):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {patient.irisan_kunci && patient.irisan_kunci.map((k) => {
              const isSelected = currentSlice === k.slice;
              return (
                <button
                  key={k.slice}
                  onClick={() => setCurrentSlice(k.slice)}
                  title={`${k.note || 'Irisan Terdeteksi'} (Skor: ${k.score})`}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono flex items-center space-x-1 transition-all ${
                    isSelected
                      ? 'bg-red-600 text-white font-bold ring-2 ring-red-400 shadow-md'
                      : k.isPeak
                      ? 'bg-red-950/80 text-red-300 border border-red-600/60 hover:bg-red-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>Slice #{k.slice}</span>
                  {k.score && <span className="text-[10px] opacity-80">({k.score})</span>}
                  {k.isPeak && <span className="text-[10px] text-amber-300">★</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
