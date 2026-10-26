from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.core.state import state
from app.services.fhir_service import build_fhir_r4_bundle

router = APIRouter(prefix="/satusehat", tags=["Interoperabilitas SATUSEHAT FHIR R4"])

@router.get("/bundle/{study_uid}", response_model=Dict[str, Any])
def get_fhir_bundle(study_uid: str):
    """
    Mengambil representasi HL7 FHIR Release 4 Bundle untuk studi tertentu.
    Prinsip Human-in-the-Loop: Jika dokter belum menekan tombol Setujui,
    status Observation dan DiagnosticReport adalah 'preliminary'.
    """
    study = state.get_by_uid(study_uid)
    if not study:
        raise HTTPException(status_code=404, detail=f"Studi dengan UID '{study_uid}' tidak ditemukan.")
    
    is_final = study.get("status") == "Selesai - FHIR Terkirim"
    return build_fhir_r4_bundle(study, is_final=is_final)

@router.get("/audit/{study_uid}", response_model=Dict[str, Any])
def get_audit_trail(study_uid: str):
    """
    Mengambil jejak audit, metrik SLA inferensi, dan stempel waktu transmisi SATUSEHAT.
    """
    study = state.get_by_uid(study_uid)
    if not study:
        raise HTTPException(status_code=404, detail=f"Studi dengan UID '{study_uid}' tidak ditemukan.")
    
    return {
        "study_uid": study_uid,
        "metrics": study.get("audit_metrics", {}),
        "logs": study.get("audit_logs", [])
    }
