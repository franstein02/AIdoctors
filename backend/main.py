import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api import api_router

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
