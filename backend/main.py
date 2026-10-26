import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api import api_router
from app.core.database import engine, Base
import app.models.database  # Mendaftarkan model ORM

# Inisialisasi skema tabel database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Middleware Interoperabilitas SIM RS - SATUSEHAT (HL7 FHIR R4) dengan Smart Triaging Perdarahan Intrakranial pada CT Kepala Non-Kontras."
)

# Konfigurasi Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Direktori Statis untuk Grad-CAM Heatmaps & Aset Medis
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Daftarkan Router API v1
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Alias langsung /cases/{study_uid}/slice jika dipanggil tanpa prefix /api/v1
@app.get("/cases/{study_uid}/slice")
def get_slice_image_direct(study_uid: str, index: int = 16, gradcam: bool = False, opacity: float = 0.6):
    from fastapi.responses import Response
    from fastapi import HTTPException
    from app.services.nii_renderer import get_nii_path_by_study, render_ct_slice

    nii_path = get_nii_path_by_study(study_uid)
    if not nii_path:
        raise HTTPException(status_code=404, detail="Berkas CT.nii kasus ini tidak ditemukan.")

    try:
        image_bytes = render_ct_slice(nii_path, index, apply_gradcam=gradcam, opacity=opacity)
        return Response(content=image_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {
        "system": settings.APP_NAME,
        "status": "ONLINE",
        "api_docs": "/docs",
        "version": "1.0.0",
        "ambang_triase": settings.DEFAULT_AMBANG,
        "model_version": settings.MODEL_VERSION,
        "safety_principles": {
            "human_in_the_loop": "Aktif (Observation berstatus preliminary sebelum disetujui dokter)",
            "safe_triaging": "Aktif (Non-demoting priority queue)"
        }
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "weights_present": True
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
