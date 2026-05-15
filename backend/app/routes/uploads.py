from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from app.dependencies.auth import CurrentUser
from app.limiter import limiter
from app.schemas.common import ApiResponse
from app.services.storage_service import (
    InvalidImageError,
    StorageNotConfiguredError,
    upload_photo,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/photo", response_model=ApiResponse[dict])
@limiter.limit("20/hour")
async def upload_photo_endpoint(
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> ApiResponse[dict]:
    """단일 사진 업로드. multipart/form-data로 file 필드를 전송.

    Returns: { url, width, height, key }
    """
    if not file.content_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Content-Type이 없습니다.")

    try:
        result = upload_photo(file.file, file.content_type, prefix=f"users/{current_user.id}")
        return ApiResponse(data=result)
    except StorageNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="이미지 저장소가 설정되지 않았습니다. 관리자에게 문의하세요.",
        )
    except InvalidImageError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
