from .inference import router as inference_router
from .queue import router as queue_router
from .satusehat import router as satusehat_router

__all__ = ["inference_router", "queue_router", "satusehat_router"]
