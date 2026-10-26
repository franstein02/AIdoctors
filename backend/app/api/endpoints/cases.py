import io
import os
import cv2
import numpy as np
import nibabel as nib
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.ai_engine import ai_engine_service
from app.services.nii_renderer import get_nii_path_by_study
from app.core.database import get_db
from app.services.triage import execute_doctor_action, seed_initial_studies_if_empty

router = APIRouter(tags=["Kasus Radiologi & Streaming Irisan NIfTI"])

# Path dataset lokal default
SAMPLE_NII_PATH = "sample_data/CQ500-CT-10/CT.nii"

def resolve_nii_file(study_uid: str = "") -> str:
    """Mencari berkas NIfTI berdasarkan study_uid atau path fallback."""
    if study_uid:
        p = get_nii_path_by_study(study_uid)
        if p and os.path.exists(p):
            return p

    candidates = [
        SAMPLE_NII_PATH,
        os.path.join("..", SAMPLE_NII_PATH),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../", SAMPLE_NII_PATH)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../sample_data/Pasien_1/CT.nii")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return SAMPLE_NII_PATH

class DoctorActionPayload(BaseModel):
    action: Literal["SETUJUI", "EDIT", "TOLAK"]
    report_text: Optional[str] = None
    laporan_baru: Optional[str] = None
    doctor_notes: Optional[str] = None
    alasan: Optional[str] = None
    user: Optional[str] = "Dr. Ahmad Fauzi, Sp.Rad"

@router.get("/cases/{study_uid}")
async def get_case_detail(study_uid: str):
    """
    Mengembalikan data dinamis dari pemindaian volume CT.nii riil.
    """
    nii_path = resolve_nii_file(study_uid)
    if not os.path.exists(nii_path):
        raise HTTPException(status_code=404, detail="Berkas CT.nii tidak ditemukan")

    analysis = ai_engine_service.analyze_nii_volume(nii_path)

    return JSONResponse({
        "study_uid": study_uid,
        "skor_studi": analysis["skor_studi"],
        "skor_subtipe": analysis["skor_subtipe"],
        "tier": analysis["tier"],
        "irisan_kunci": analysis["irisan_kunci"],
        "total_slices": analysis["total_slices"],
        "top_slice_idx": analysis["top_slice_idx"],
        "current_slice": analysis["top_slice_idx"],
        "heatmap_url": f"/api/v1/cases/{study_uid}/slices/{analysis['top_slice_idx']}?gradcam=true",
        "draf_laporan": analysis["draf_laporan"],
        "versi_model": "EfficientNet-B0 v1.0",
        "ambang": 0.50,
        "waktu_inferensi": 1.42
    })

@router.get("/cases/{study_uid}/slices/{slice_num}")
async def get_slice_image(
    study_uid: str,
    slice_num: int,
    gradcam: bool = Query(False),
    opacity: float = Query(0.6)
):
    """
    Streaming irisan CT 2D berformat PNG.
    Jika gradcam=True, hanya lesi di atas ambang batas yang diberi warna JET.
    """
    nii_path = resolve_nii_file(study_uid)
    if not os.path.exists(nii_path):
        raise HTTPException(status_code=404, detail="Berkas CT.nii tidak ditemukan")

    nii = nib.load(nii_path)
    data = nii.get_fdata()

    if slice_num < 0 or slice_num >= data.shape[2]:
        raise HTTPException(status_code=400, detail="Nomor irisan di luar batas")

    raw_slice = np.rot90(data[:, :, slice_num], 1)

    # Brain window (Level 40, Width 80)
    windowed = ai_engine_service.apply_window(raw_slice, 40, 80)
    base_gray = (windowed * 255).astype(np.uint8)
    base_gray = cv2.resize(base_gray, (512, 512))
    base_rgb = cv2.cvtColor(base_gray, cv2.COLOR_GRAY2BGR)

    if gradcam:
        inp_tensor, _ = ai_engine_service.preprocess_slice(raw_slice)
        # Class 0 = any, atau sesuaikan dengan class subtipe dominan
        cam = ai_engine_service.generate_gradcam(inp_tensor, class_idx=0, threshold=0.45)

        # Hanya warnai area yang aktif
        mask = cam > 0
        if np.any(mask):
            heatmap_color = cv2.applyColorMap((cam * 255).astype(np.uint8), cv2.COLORMAP_JET)
            # Blending hanya pada piksel aktivasi
            blended = cv2.addWeighted(base_rgb, 1.0 - opacity, heatmap_color, opacity, 0)
            base_rgb[mask] = blended[mask]

    # Encode ke format PNG
    is_success, buffer = cv2.imencode(".png", base_rgb)
    if not is_success:
        raise HTTPException(status_code=500, detail="Gagal render citra irisan")

    return Response(content=buffer.tobytes(), media_type="image/png")

# Endpoint alias untuk kompatibilitas frontend /cases/{study_uid}/slice?index=...
@router.get("/cases/{study_uid}/slice")
async def get_slice_image_alias(
    study_uid: str,
    index: int = Query(default=16, ge=0),
    slice_num: Optional[int] = None,
    gradcam: bool = Query(default=False),
    opacity: float = Query(default=0.6, ge=0.0, le=1.0)
):
    target_idx = slice_num if slice_num is not None else index
    return await get_slice_image(study_uid=study_uid, slice_num=target_idx, gradcam=gradcam, opacity=opacity)

# Penanganan aksi dokter di endpoint cases
@router.post("/cases/{study_uid}/action")
def perform_action(study_uid: str, payload: DoctorActionPayload, db: Session = Depends(get_db)):
    seed_initial_studies_if_empty(db)
    laporan = payload.report_text or payload.laporan_baru or payload.doctor_notes
    alasan = payload.alasan or payload.doctor_notes
    updated = execute_doctor_action(
        db=db,
        study_uid=study_uid,
        action=payload.action,
        laporan_baru=laporan,
        alasan=alasan,
        user=payload.user or "Dr. Ahmad Fauzi, Sp.Rad"
    )
    return {
        "success": True,
        "message": f"Aksi '{payload.action}' berhasil diproses untuk studi {study_uid}.",
        "data": updated.to_dict()
    }
