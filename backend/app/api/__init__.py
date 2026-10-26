from fastapi import APIRouter
from .endpoints.cases import router as cases_router
from .endpoints.queue import router as queue_router
from .endpoints.inference import router as inference_router
from .endpoints.satusehat import router as satusehat_router
from .triage import router as triage_router

api_router = APIRouter()
api_router.include_router(cases_router)
api_router.include_router(queue_router)
api_router.include_router(inference_router)
api_router.include_router(satusehat_router)
api_router.include_router(triage_router)

__all__ = ["api_router"]

