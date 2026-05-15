"""Expo Push Notification Service 어댑터.

Expo Push API(https://exp.host/--/api/v2/push/send)를 통해
등록된 Expo push token에 알림을 전송한다.

Expo 제한사항:
  - 요청당 최대 100개 토큰 (청크 자동 분할)
  - 응답의 각 항목에 status: "ok" | "error" 포함
  - DeviceNotRegistered 에러: 토큰이 무효 → DB에서 제거
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_CHUNK_SIZE = 100  # Expo 권장 최대값


@dataclass
class PushMessage:
    """Expo 푸시 메시지 한 건."""

    to: str           # ExponentPushToken[xxx]
    title: str
    body: str
    data: dict | None = None
    sound: str = "default"
    channel_id: str = "trip-reminders"


@dataclass
class PushResult:
    """전송 결과."""

    sent: int = 0
    failed: int = 0
    invalid_tokens: list[str] | None = None


async def send_push_notifications(messages: list[PushMessage]) -> PushResult:
    """푸시 알림을 일괄 전송한다.

    내부적으로 100개씩 청크 분할하여 Expo API를 호출한다.
    DeviceNotRegistered 토큰은 invalid_tokens에 수집해 반환한다.
    """
    if not messages:
        return PushResult()

    result = PushResult(invalid_tokens=[])

    # 100개씩 청크
    for i in range(0, len(messages), _CHUNK_SIZE):
        chunk = messages[i : i + _CHUNK_SIZE]
        payload = [_to_expo_payload(m) for m in chunk]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    _EXPO_PUSH_URL,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip, deflate",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("push_send_failed chunk=%d error=%s", i // _CHUNK_SIZE, exc)
            result.failed += len(chunk)
            continue

        # 응답 파싱: data["data"] 는 각 메시지에 대한 결과 리스트
        for j, item_result in enumerate(data.get("data", [])):
            status = item_result.get("status", "error")
            if status == "ok":
                result.sent += 1
            else:
                result.failed += 1
                details = item_result.get("details", {})
                error_code = details.get("error", "")
                token = chunk[j].to if j < len(chunk) else "unknown"
                logger.warning(
                    "push_ticket_error token=%s error=%s message=%s",
                    token,
                    error_code,
                    item_result.get("message", ""),
                )
                # DeviceNotRegistered: 토큰이 무효화됨 → 호출자가 DB에서 제거
                if error_code == "DeviceNotRegistered":
                    result.invalid_tokens.append(token)

    logger.info("push_batch_done sent=%d failed=%d", result.sent, result.failed)
    return result


def _to_expo_payload(msg: PushMessage) -> dict:
    payload: dict = {
        "to": msg.to,
        "title": msg.title,
        "body": msg.body,
        "sound": msg.sound,
        "channelId": msg.channel_id,
    }
    if msg.data:
        payload["data"] = msg.data
    return payload
