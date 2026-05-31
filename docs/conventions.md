# Conventions

Biome/tsconfig가 강제하는 규칙은 여기 중복 안 함. 에이전트가 자주 틀리는 것만.

## 수집 필터 — `isTargetBid`

`src/collector/filter.ts`. **변경 전 `test/filter.test.ts` Red→Green 필수.**

순서대로 AND 조건:

1. `dmndInsttNm` "대학" 포함
2. `dmndInsttNm` "병원" 미포함
3. `bsnsDivNm == "용역"`
4. `bidNtceNm` "유지보수" 미포함
5. `bidprcPsblIndstrytyNm` 쉼표 분리 세그먼트 중 — SW 키워드 포함 AND 제외 업종 미포함

- SW 키워드: `소프트웨어`, `컴퓨터`, `정보보호`, `이러닝서비스업`, `정보통신`
- 제외 업종: `디지털콘텐츠개발서비스사업`

`filter.ts`는 순수 함수 유지 — 외부 의존/IO 금지. 새 키워드는 상수 배열에 추가.

## TDD 규칙

- 필터 규칙 변경 → `filter.test.ts`에 새 실패 케이스 추가(Red), 확인 후 Green 구현. **기존 케이스 수정 금지.**
- D1 repo 변경 → `test/repo.test.ts` 통합 테스트 추가 (`@cloudflare/vitest-pool-workers`로 실제 D1).
- 모킹 기본 금지 — 통합 테스트 우선. 외부 IO/비결정적 의존만 모킹.

## TypeScript

strict 전부 on + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. 의미:

- 배열/객체 인덱싱 결과는 `T | undefined` — 좁히기 필수.
- optional 프로퍼티에 `undefined` 명시 할당 불가 — 키 자체를 생략.
- `any` 금지. 타입 모르면 `unknown` 후 좁히기.

## SQL

모든 쿼리는 `src/db/repo.ts`에만. 라우트/수집기는 repo 함수 경유. 바인딩 파라미터 사용 (문자열 보간 금지 — SQL injection).

- **FTS5 하이브리드 검색**: FTS5 `MATCH`를 사용할 때는 특수 기호(예: `%`, `_`, `"`)의 리터럴 매칭 정확도 보존을 위해 FTS5 검색과 SQL `LIKE` 필터를 AND로 중첩 결합하여 하이브리드로 사용합니다.
- **최신 차수 단일 노출**: 동일 공고번호(`bid_ntce_no`) 중 중복을 피해 최신 차수만 목록에 가져오기 위해 `ROW_NUMBER() OVER (PARTITION BY bid_ntce_no ORDER BY bid_ntce_ord DESC)` Window Function을 활용합니다.

## 날짜 컬럼 포맷

`bid_ntce_date`·`bid_clse_date` 등 D1 날짜 컬럼은 OpenAPI raw 값 그대로 **`YYYY-MM-DD`** (대시, 날짜만, 시간 없음 — 시간은 `bid_clse_tm` 별도 컬럼)로 저장. `client.ts`는 변환 없이 적재.

- 비교 시 **포맷 변환 금지** — 대시 `YYYY-MM-DD`는 고정폭·zero-pad라 사전순=시간순. `>=`/`<=` 그대로 정확. 변환(대시 제거 등)하면 비교가 조용히 깨짐 (실제 from/to 버그 원인).
- `<input type="date">` 입력값도 `YYYY-MM-DD` → 그대로 바인딩.
- 빈값은 `""`로 저장 (NULL 아님 — `BidItem` 필드가 non-null string). 필터에서 `IS NULL OR = ''` 둘 다 처리.
