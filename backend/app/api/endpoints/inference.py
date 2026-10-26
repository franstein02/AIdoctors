from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.services.ai_engine import engine
from app.core.config import settings

router = APIRouter(prefix="/inference", tags=["Pipeline Inferensi AI CT Kepala"])

class SubtypeScoresResponse(BaseModel):
    epidural: float = Field(..., description="Probabilitas perdarahan epidural (EDH)")
    intraparenkim: float = Field(..., description="Probabilitas perdarahan intraparenkim (IPH)")
    intraventrikel: float = Field(..., description="Probabilitas perdarahan intraventrikel (IVH)")
    subaraknoid: float = Field(..., description="Probabilitas perdarahan subaraknoid (SAH)")
    subdural: float = Field(..., description="Probabilitas perdarahan subdural (SDH)")

class InferenceResponse(BaseModel):
    study_uid: str = Field(..., description="DICOM Study Instance UID")
    skor_studi: float = Field(..., description="Probabilitas kumulatif perdarahan intrakranial [0.0 - 1.0]")
    skor_subtipe: SubtypeScoresResponse = Field(..., description="Probabilitas 5 subtipe perdarahan intrakranial")
    tier: str = Field(..., description="Klasifikasi prioritas triase ('MERAH' atau 'NORMAL')")
    irisan_kunci: List[int] = Field(..., description="Daftar nomor irisan aksial dengan temuan paling signifikan")
    heatmap_url: str = Field(..., description="URL statis citra overlay Grad-CAM untuk ditampilkan di viewer")
    draf_laporan: str = Field(..., description="Draf laporan radiologi terstruktur berbasis templat klinis")
    versi_model: str = Field(..., description="Versi model EfficientNet-B0")
    ambang: float = Field(..., description="Ambang batas probabilitas untuk eskalasi triase")
    waktu_inferensi: float = Field(..., description="Durasi proses inferensi dalam detik")

@router.post("/analyze", response_model=InferenceResponse)
async def analyze_ct_study(
    file: Optional[UploadFile] = File(None, description="Berkas citra medis CT scan kepala (.dcm atau .nii)"),
    study_uid: Optional[str] = Form(None, description="Study Instance UID jika menggunakan data dari PACS"),
    ambang: Optional[float] = Form(0.50, description="Ambang batas eskalasi triase (default: 0.50)")
):
    """
    Endpoint Inferensi CT Kepala:
    - Menerima unggahan berkas citra medis (.dcm atau .nii / .nii.gz) atau rujukan study_uid
    - Menjalankan pra-proses 3-windowing Hounsfield Unit (HU)
    - Menjalankan inferensi EfficientNet-B0
    - Menghasilkan heatmap Grad-CAM pada lapisan konvolusi terakhir (model.features[-1])
    - Menghasilkan Draf Laporan Radiologi terstruktur (TEMUAN, KESAN, CATATAN SISTEM)
    - Mengembalikan respons JSON sesuai Kontrak Data Baku.
    """
    try:
        file_content = None
        filename = ""
        if file is not None:
            file_content = await file.read()
            filename = file.filename or ""

        # Eksekusi pipeline analisis AI
        result = engine.analyze(
            file_content=file_content,
            filename=filename,
            study_uid=study_uid,
            ambang=ambang if ambang is not None else settings.DEFAULT_AMBANG
        )

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan saat memproses inferensi citra CT: {str(e)}"
        )
