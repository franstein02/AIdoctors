from fastapi import APIRouter
from .triage import router as triage_router
from .satusehat import router as satusehat_router
from .endpoints.inference import router as inference_router

api_router = APIRouter()
api_router.include_router(triage_router)
api_router.include_router(satusehat_router)
api_router.include_router(inference_router)

__all__ = ["api_router"]

