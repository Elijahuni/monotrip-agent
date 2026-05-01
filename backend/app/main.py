from fastapi import FastAPI

# DB 세션 의존성 주입 예시:
# from fastapi import Depends
# from sqlalchemy.ext.asyncio import AsyncSession
# from app.database import get_db
#
# @router.get("/items")
# async def list_items(db: AsyncSession = Depends(get_db)):
#     ...

app = FastAPI(title="Triple Clone Backend", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
