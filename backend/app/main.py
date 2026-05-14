from fastapi import FastAPI

from app.routes.ai import router as ai_router
from app.routes.auth import router as auth_router
from app.routes.checklist import router as checklist_router
from app.routes.places import router as places_router
from app.routes.saved_places import router as saved_places_router
from app.routes.trips import router as trips_router

app = FastAPI(title="모노트립 Backend", version="0.2.0")

app.include_router(auth_router)
app.include_router(trips_router)
app.include_router(ai_router)
app.include_router(places_router)
app.include_router(saved_places_router)
app.include_router(checklist_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
