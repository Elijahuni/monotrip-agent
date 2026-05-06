from fastapi import FastAPI

from app.routes.ai import router as ai_router
from app.routes.auth import router as auth_router
from app.routes.trips import router as trips_router

app = FastAPI(title="Triple Clone Backend", version="0.1.0")

app.include_router(auth_router)
app.include_router(trips_router)
app.include_router(ai_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
