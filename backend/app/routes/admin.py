"""관리자 패널 — 숨겨진 URL + HTTP Basic Auth.

접속: GET /{ADMIN_SECRET_PATH}/
인증: HTTP Basic Auth (username: admin, password: ADMIN_PASSWORD env)

화면 목록:
  /             대시보드 (통계 요약)
  /users        유저 목록 + 검색 + role 변경 + 정지
  /reports      신고 게시글 목록 + 처리 (숨김/삭제/복원)
  /posts        전체 게시글 관리
"""

from __future__ import annotations

import ipaddress
import secrets
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from slowapi.util import get_remote_address
from sqlalchemy import func, select, update

from app.config import get_settings
from app.dependencies.db import DbSession
from app.models.community import CommunityPost, CommunityReport
from app.models.trip import Trip
from app.models.user import User, UserRole


# ── Basic Auth + IP allowlist + brute-force 잠금 ───────────────────────────────

_basic = HTTPBasic()

# brute-force 방지: IP별 최근 인증 실패 타임스탬프.
# 멀티 워커 환경에서는 프로세스별이지만, 단일 시크릿 경로 + IP allowlist와
# 함께라면 충분히 무차별 대입 비용을 높인다.
_failed_attempts: dict[str, list[float]] = {}
_MAX_FAILURES = 5
_WINDOW_SECONDS = 300  # 5분 내 5회 실패 시 잠금


def _ip_allowed(client_ip: str, allowlist: list[str]) -> bool:
    if not allowlist:
        return True
    try:
        addr = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for entry in allowlist:
        try:
            if "/" in entry:
                if addr in ipaddress.ip_network(entry, strict=False):
                    return True
            elif addr == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False


def _record_failure(ip: str) -> None:
    now = time.time()
    recent = [t for t in _failed_attempts.get(ip, []) if now - t < _WINDOW_SECONDS]
    recent.append(now)
    _failed_attempts[ip] = recent


def _is_locked_out(ip: str) -> bool:
    now = time.time()
    recent = [t for t in _failed_attempts.get(ip, []) if now - t < _WINDOW_SECONDS]
    _failed_attempts[ip] = recent
    return len(recent) >= _MAX_FAILURES


def _verify_admin(
    request: Request,
    credentials: HTTPBasicCredentials = Depends(_basic),
) -> None:
    settings = get_settings()
    client_ip = get_remote_address(request)

    # 1) IP allowlist — 허용 목록 밖이면 패널 존재 자체를 숨기기 위해 404.
    if not _ip_allowed(client_ip, settings.admin_ip_allowlist_list):
        raise HTTPException(status_code=404, detail="Not Found")

    # 2) brute-force 잠금
    if _is_locked_out(client_ip):
        raise HTTPException(
            status_code=429,
            detail="too many attempts, try again later",
        )

    ok_user = secrets.compare_digest(credentials.username.encode(), b"admin")
    ok_pass = secrets.compare_digest(
        credentials.password.encode(),
        settings.admin_password.encode(),
    )
    if not (ok_user and ok_pass):
        _record_failure(client_ip)
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"},
        )
    # 성공 시 실패 카운터 초기화
    _failed_attempts.pop(client_ip, None)


# ── HTML 공통 레이아웃 ─────────────────────────────────────────────────────────


def _base(title: str, body: str, path: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — 어드민</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen">
  <nav class="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center gap-3">
    <span class="font-bold text-blue-400 mr-4">🗺️ 어드민</span>
    <a href="{path}" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700">대시보드</a>
    <a href="{path}/users" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700">유저 관리</a>
    <a href="{path}/reports" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700">신고 처리</a>
    <a href="{path}/posts" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700">게시글 관리</a>
  </nav>
  <main class="max-w-7xl mx-auto px-6 py-8">
    <h1 class="text-2xl font-bold mb-6">{title}</h1>
    {body}
  </main>
</body>
</html>"""


def _stat_card(label: str, value: int | str, color: str = "blue") -> str:
    return f"""
<div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
  <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
  <p class="text-3xl font-bold text-{color}-400">{value}</p>
</div>"""


def _badge(text: str, color: str) -> str:
    return f'<span class="px-2 py-0.5 rounded text-xs font-semibold bg-{color}-900 text-{color}-300">{text}</span>'


def _action_btn(label: str, color: str, form_action: str, fields: dict) -> str:
    hidden = "".join(f'<input type="hidden" name="{k}" value="{v}">' for k, v in fields.items())
    return f"""
<form method="post" action="{form_action}" style="display:inline">
  {hidden}
  <button type="submit"
    class="px-3 py-1 rounded text-xs font-semibold bg-{color}-700 hover:bg-{color}-600 text-white transition"
    onclick="return confirm('{label}하시겠습니까?')">
    {label}
  </button>
</form>"""


# ── 라우터 팩토리 (설정에서 prefix 읽음) ──────────────────────────────────────


def create_admin_router() -> APIRouter:
    settings = get_settings()
    prefix = f"/{settings.admin_secret_path}"
    router = APIRouter(prefix=prefix, dependencies=[Depends(_verify_admin)])

    # ── 대시보드 ──────────────────────────────────────────────────────────────

    @router.get("/", response_class=HTMLResponse)
    async def dashboard(db: DbSession) -> HTMLResponse:
        total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
        total_trips = (await db.execute(select(func.count(Trip.id)))).scalar() or 0
        total_posts = (await db.execute(select(func.count(CommunityPost.id)))).scalar() or 0
        hidden_posts = (
            await db.execute(
                select(func.count(CommunityPost.id)).where(CommunityPost.is_hidden.is_(True))
            )
        ).scalar() or 0
        admins = (
            await db.execute(select(func.count(User.id)).where(User.role == UserRole.ADMIN))
        ).scalar() or 0

        body = f"""
<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
  {_stat_card("전체 유저", total_users, "blue")}
  {_stat_card("관리자", admins, "purple")}
  {_stat_card("전체 여행", total_trips, "green")}
  {_stat_card("전체 게시글", total_posts, "yellow")}
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
    <h2 class="font-semibold mb-3 text-gray-200">빠른 링크</h2>
    <div class="flex flex-col gap-2">
      <a href="{prefix}/reports" class="text-blue-400 hover:underline text-sm">
        ⚠️ 신고 처리 필요 게시글 보기
      </a>
      <a href="{prefix}/users?role=admin" class="text-blue-400 hover:underline text-sm">
        👤 관리자 목록 보기
      </a>
      <a href="{prefix}/posts?hidden=1" class="text-blue-400 hover:underline text-sm">
        🚫 숨김 처리된 게시글 ({hidden_posts}건)
      </a>
    </div>
  </div>
  <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
    <h2 class="font-semibold mb-3 text-gray-200">서버 정보</h2>
    <p class="text-sm text-gray-400">시각: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</p>
    <p class="text-sm text-gray-400 mt-1">환경: {settings.app_env}</p>
  </div>
</div>"""
        return HTMLResponse(_base("대시보드", body, prefix))

    # ── 유저 관리 ──────────────────────────────────────────────────────────────

    @router.get("/users", response_class=HTMLResponse)
    async def users_list(
        db: DbSession,
        q: str = Query(""),
        role: str = Query(""),
        page: int = Query(1),
    ) -> HTMLResponse:
        PAGE_SIZE = 30
        stmt = select(User).order_by(User.created_at.desc())
        if q:
            stmt = stmt.where((User.email.ilike(f"%{q}%")) | (User.nickname.ilike(f"%{q}%")))
        if role:
            stmt = stmt.where(User.role == role)
        stmt = stmt.offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        users = (await db.execute(stmt)).scalars().all()

        role_colors = {"admin": "red", "moderator": "yellow", "user": "gray"}

        rows = "".join(
            f"""
<tr class="border-t border-gray-700 hover:bg-gray-750">
  <td class="px-4 py-3 text-sm">{u.id}</td>
  <td class="px-4 py-3 text-sm font-medium">{u.nickname}</td>
  <td class="px-4 py-3 text-sm text-gray-400">{u.email}</td>
  <td class="px-4 py-3 text-sm">{u.auth_provider}</td>
  <td class="px-4 py-3 text-sm">{_badge(u.role, role_colors.get(u.role, "gray"))}</td>
  <td class="px-4 py-3 text-sm text-gray-400">{u.created_at.strftime("%y.%m.%d")}</td>
  <td class="px-4 py-3 text-sm">
    {_action_btn("관리자 승격", "purple", f"{prefix}/users/{u.id}/role", {"role": "admin"}) if u.role != "admin" else ""}
    {_action_btn("일반 강등", "gray", f"{prefix}/users/{u.id}/role", {"role": "user"}) if u.role == "admin" else ""}
    {_action_btn("계정 삭제", "red", f"{prefix}/users/{u.id}/delete", {}) if u.role != "admin" else ""}
  </td>
</tr>"""
            for u in users
        )

        body = f"""
<div class="flex gap-3 mb-5">
  <form method="get" class="flex gap-2 flex-1">
    <input name="q" value="{q}" placeholder="닉네임 또는 이메일 검색"
      class="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm">
    <select name="role" class="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm">
      <option value="">전체 역할</option>
      <option value="user" {"selected" if role == "user" else ""}>일반</option>
      <option value="moderator" {"selected" if role == "moderator" else ""}>모더레이터</option>
      <option value="admin" {"selected" if role == "admin" else ""}>관리자</option>
    </select>
    <button type="submit" class="px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold">검색</button>
  </form>
</div>
<div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
  <table class="w-full">
    <thead class="bg-gray-750">
      <tr class="text-xs text-gray-400 uppercase">
        <th class="px-4 py-3 text-left">ID</th>
        <th class="px-4 py-3 text-left">닉네임</th>
        <th class="px-4 py-3 text-left">이메일</th>
        <th class="px-4 py-3 text-left">Provider</th>
        <th class="px-4 py-3 text-left">역할</th>
        <th class="px-4 py-3 text-left">가입일</th>
        <th class="px-4 py-3 text-left">액션</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
</div>
<div class="mt-4 flex gap-2 text-sm">
  {"" if page <= 1 else f'<a href="?q={q}&role={role}&page={page - 1}" class="px-3 py-1 bg-gray-700 rounded">← 이전</a>'}
  <span class="px-3 py-1 text-gray-400">{page} 페이지</span>
  {"" if len(users) < PAGE_SIZE else f'<a href="?q={q}&role={role}&page={page + 1}" class="px-3 py-1 bg-gray-700 rounded">다음 →</a>'}
</div>"""
        return HTMLResponse(_base("유저 관리", body, prefix))

    @router.post("/users/{user_id}/role")
    async def change_user_role(
        user_id: int, role: str = Form(...), db: DbSession = None
    ) -> RedirectResponse:
        if role not in (UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN):
            raise HTTPException(400, "잘못된 역할")
        await db.execute(update(User).where(User.id == user_id).values(role=role))
        await db.commit()
        return RedirectResponse(f"{prefix}/users", status_code=303)

    @router.post("/users/{user_id}/delete")
    async def delete_user(user_id: int, db: DbSession = None) -> RedirectResponse:
        user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
        if user and user.role == UserRole.ADMIN:
            raise HTTPException(400, "관리자 계정은 삭제할 수 없습니다.")
        if user:
            await db.delete(user)
            await db.commit()
        return RedirectResponse(f"{prefix}/users", status_code=303)

    # ── 신고 처리 ──────────────────────────────────────────────────────────────

    @router.get("/reports", response_class=HTMLResponse)
    async def reports(db: DbSession) -> HTMLResponse:
        # 신고 건수 집계 서브쿼리
        report_count_sq = (
            select(
                CommunityReport.post_id,
                func.count(CommunityReport.id).label("cnt"),
            )
            .where(CommunityReport.post_id.isnot(None))
            .group_by(CommunityReport.post_id)
            .subquery()
        )
        stmt = (
            select(
                CommunityPost, User, func.coalesce(report_count_sq.c.cnt, 0).label("report_count")
            )
            .join(User, CommunityPost.user_id == User.id)
            .outerjoin(report_count_sq, CommunityPost.id == report_count_sq.c.post_id)
            .where((report_count_sq.c.cnt > 0) | CommunityPost.is_hidden.is_(True))
            .order_by(
                func.coalesce(report_count_sq.c.cnt, 0).desc(), CommunityPost.created_at.desc()
            )
            .limit(100)
        )
        results = (await db.execute(stmt)).all()

        rows = "".join(
            f"""
<tr class="border-t border-gray-700 hover:bg-gray-750">
  <td class="px-4 py-3 text-sm">{post.id}</td>
  <td class="px-4 py-3 text-sm">
    <p class="font-medium truncate max-w-xs">{(post.title or post.body or "")[:50]}</p>
    <p class="text-xs text-gray-500">{author.nickname} · {post.category}</p>
  </td>
  <td class="px-4 py-3 text-sm">
    <span class="text-red-400 font-bold">{report_count}</span>건
  </td>
  <td class="px-4 py-3 text-sm">
    {"🚫 숨김" if post.is_hidden else "✅ 정상"}
  </td>
  <td class="px-4 py-3 text-sm text-gray-400">{post.created_at.strftime("%y.%m.%d %H:%M")}</td>
  <td class="px-4 py-3 text-sm flex gap-1 flex-wrap">
    {_action_btn("숨김", "orange", f"{prefix}/posts/{post.id}/action", {"action": "hide"}) if not post.is_hidden else ""}
    {_action_btn("복원", "green", f"{prefix}/posts/{post.id}/action", {"action": "restore"}) if post.is_hidden else ""}
    {_action_btn("영구삭제", "red", f"{prefix}/posts/{post.id}/action", {"action": "delete"})}
    {_action_btn("신고초기화", "blue", f"{prefix}/posts/{post.id}/action", {"action": "reset_reports"})}
  </td>
</tr>"""
            for post, author, report_count in results
        )

        body = f"""
<div class="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm text-yellow-300">
  ⚠️ 자동 숨김 기준 이상의 신고를 받은 게시글과 이미 숨김 처리된 게시글을 보여줍니다.
</div>
<div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
  <table class="w-full">
    <thead>
      <tr class="text-xs text-gray-400 uppercase">
        <th class="px-4 py-3 text-left">ID</th>
        <th class="px-4 py-3 text-left">게시글</th>
        <th class="px-4 py-3 text-left">신고</th>
        <th class="px-4 py-3 text-left">상태</th>
        <th class="px-4 py-3 text-left">작성일</th>
        <th class="px-4 py-3 text-left">액션</th>
      </tr>
    </thead>
    <tbody>{rows if rows else '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">신고된 게시글이 없습니다.</td></tr>'}</tbody>
  </table>
</div>"""
        return HTMLResponse(_base("신고 처리", body, prefix))

    # ── 게시글 관리 ────────────────────────────────────────────────────────────

    @router.get("/posts", response_class=HTMLResponse)
    async def posts_list(
        db: DbSession,
        q: str = Query(""),
        hidden: int = Query(0),
        page: int = Query(1),
    ) -> HTMLResponse:
        PAGE_SIZE = 30
        stmt = (
            select(CommunityPost, User)
            .join(User, CommunityPost.user_id == User.id)
            .order_by(CommunityPost.created_at.desc())
        )
        if q:
            stmt = stmt.where(
                CommunityPost.title.ilike(f"%{q}%") | CommunityPost.body.ilike(f"%{q}%")
            )
        if hidden:
            stmt = stmt.where(CommunityPost.is_hidden.is_(True))
        stmt = stmt.offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        results = (await db.execute(stmt)).all()

        rows = "".join(
            f"""
<tr class="border-t border-gray-700 hover:bg-gray-750">
  <td class="px-4 py-3 text-sm">{post.id}</td>
  <td class="px-4 py-3 text-sm">
    <p class="font-medium truncate max-w-xs">{(post.title or post.body or "")[:60]}</p>
    <p class="text-xs text-gray-500">{author.nickname} · {post.category}</p>
  </td>
  <td class="px-4 py-3 text-sm">
    ❤️ {post.like_count} · 🚩 {post.report_count}
  </td>
  <td class="px-4 py-3 text-sm">{"🚫 숨김" if post.is_hidden else "✅ 정상"}</td>
  <td class="px-4 py-3 text-sm text-gray-400">{post.created_at.strftime("%y.%m.%d")}</td>
  <td class="px-4 py-3 text-sm flex gap-1 flex-wrap">
    {_action_btn("숨김", "orange", f"{prefix}/posts/{post.id}/action", {"action": "hide"}) if not post.is_hidden else ""}
    {_action_btn("복원", "green", f"{prefix}/posts/{post.id}/action", {"action": "restore"}) if post.is_hidden else ""}
    {_action_btn("삭제", "red", f"{prefix}/posts/{post.id}/action", {"action": "delete"})}
  </td>
</tr>"""
            for post, author in results
        )

        body = f"""
<div class="flex gap-3 mb-5">
  <form method="get" class="flex gap-2 flex-1">
    <input name="q" value="{q}" placeholder="제목/내용 검색"
      class="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm">
    <label class="flex items-center gap-2 text-sm text-gray-300">
      <input type="checkbox" name="hidden" value="1" {"checked" if hidden else ""}
        onchange="this.form.submit()"> 숨김만 보기
    </label>
    <button type="submit" class="px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold">검색</button>
  </form>
</div>
<div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
  <table class="w-full">
    <thead>
      <tr class="text-xs text-gray-400 uppercase">
        <th class="px-4 py-3 text-left">ID</th>
        <th class="px-4 py-3 text-left">게시글</th>
        <th class="px-4 py-3 text-left">통계</th>
        <th class="px-4 py-3 text-left">상태</th>
        <th class="px-4 py-3 text-left">작성일</th>
        <th class="px-4 py-3 text-left">액션</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
</div>
<div class="mt-4 flex gap-2 text-sm">
  {"" if page <= 1 else f'<a href="?q={q}&hidden={hidden}&page={page - 1}" class="px-3 py-1 bg-gray-700 rounded">← 이전</a>'}
  <span class="px-3 py-1 text-gray-400">{page} 페이지</span>
  {"" if len(results) < PAGE_SIZE else f'<a href="?q={q}&hidden={hidden}&page={page + 1}" class="px-3 py-1 bg-gray-700 rounded">다음 →</a>'}
</div>"""
        return HTMLResponse(_base("게시글 관리", body, prefix))

    @router.post("/posts/{post_id}/action")
    async def post_action(
        post_id: int,
        action: str = Form(...),
        db: DbSession = None,
    ) -> RedirectResponse:
        post = (
            (await db.execute(select(CommunityPost).where(CommunityPost.id == post_id)))
            .scalars()
            .first()
        )
        if not post:
            raise HTTPException(404, "게시글을 찾을 수 없습니다.")

        if action == "hide":
            post.is_hidden = True
        elif action == "restore":
            post.is_hidden = False
            post.report_count = 0
        elif action == "delete":
            await db.delete(post)
            await db.commit()
            return RedirectResponse(f"{prefix}/reports", status_code=303)
        elif action == "reset_reports":
            # CommunityReport 테이블에서 해당 게시글의 신고 기록 삭제
            reports_to_del = (
                (
                    await db.execute(
                        select(CommunityReport).where(CommunityReport.post_id == post_id)
                    )
                )
                .scalars()
                .all()
            )
            for r in reports_to_del:
                await db.delete(r)
            post.is_hidden = False
        else:
            raise HTTPException(400, "알 수 없는 액션")

        await db.commit()
        return RedirectResponse(f"{prefix}/reports", status_code=303)

    return router
