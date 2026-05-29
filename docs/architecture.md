# Architecture

## 개요

단일 Cloudflare Worker. 두 진입점:
- `fetch` — HTTP 요청 (웹 UI + JSON API)
- `scheduled` — Cron (UTC 00:00 = KST 09:00) 일일 수집

## 모듈 경계

```
src/
  index.ts          # 진입점: fetch + scheduled 핸들러. 의존 방향의 최상위.
  types.ts          # Env 바인딩 타입 (DB, secrets)
  collector/        # 외부 데이터 수집 — 나라장터 OpenAPI
    client.ts       #   fetch + 페이지네이션 + XML 에러 봉투 처리
    filter.ts       #   isTargetBid — 순수 함수, 외부 의존 없음
    types.ts        #   BidItem, API 응답 타입
  db/
    repo.ts         #   D1 upsert / 검색 쿼리. SQL은 여기에만.
  web/
    routes.ts       #   HTTP 라우트 (Hono)
    render.ts       #   HTML 템플릿 (서버렌더, SPA 없음)
```

**의존 방향:** `index` → {`collector`, `db`, `web`}. `web` → `db` (검색). `collector` → `db` (upsert). `filter.ts`는 순수 — 어떤 모듈도 import 안 함, 테스트 용이.

**SQL 격리:** 모든 D1 쿼리는 `db/repo.ts`에만. 라우트/수집기는 repo 함수 호출.

## 데이터 흐름

**수집 (scheduled):**
`client.ts` 페이지네이션 fetch → `filter.isTargetBid` 통과분만 → `repo.upsert` (PK 중복 무시).

**검색 (fetch):**
`routes.ts` 쿼리파라미터 → `repo` LIKE 검색 → `render.ts` HTML / JSON 응답.

## D1 스키마

테이블 `bids`. `migrations/0001_initial.sql`.

- **PK `(bid_ntce_no, bid_ntce_ord)`** — 공고번호+차수. upsert 중복 방지 핵심. 절대 변경 금지.
- 인덱스: `bid_ntce_date`, `dmnd_instt_nm`, `bid_clse_date` (검색/정렬 경로).
- `collected_at` — 수집 시각 (NOT NULL).
- 금액: `asign_bdgt_amt`, `presmpt_prce` INTEGER.

스키마 변경 → 새 `migrations/000N_*.sql` 추가 (기존 수정 금지), `pnpm migrate:local`로 검증.

## 알려진 제약

- 검색: LIKE 기반. 복잡 전문검색 필요 시 FTS5 가상테이블 추가 가능.
- 보존: 현재 전량 보존 (마감 지난 공고 포함).
- 프록시가 `type=json`이어도 XML 에러 봉투 반환 가능 — `client.ts`에서 처리.
