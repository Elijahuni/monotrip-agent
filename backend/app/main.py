from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.ai import router as ai_router
from app.routes.auth import router as auth_router
from app.routes.checklist import router as checklist_router
from app.routes.places import router as places_router
from app.routes.saved_places import router as saved_places_router
from app.routes.trips import router as trips_router
from app.routes.uploads import router as uploads_router

settings = get_settings()

app = FastAPI(title="모노트립 Backend", version="0.3.0")

# CORS — 환경변수로 도메인 화이트리스트 관리
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(trips_router)
app.include_router(ai_router)
app.include_router(places_router)
app.include_router(saved_places_router)
app.include_router(checklist_router)
app.include_router(uploads_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
