# Conventions

Biome/tsconfig가 강제하는 규칙은 여기 중복 안 함. 에이전트가 자주 틀리는 것만.

## 수집 필터 — `isTargetBid`

`src/collector/filter.ts`. **변경 전 `test/filter.test.ts` Red→Green 필수.** my-automator IsTargetBid 포팅.

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

- 필터 규칙 변경 → `filter.test.ts` Red 먼저, 실패 확인 후 Green 구현. **테스트 수정 금지.**
- D1 repo 변경 → `test/repo.test.ts` 통합 테스트 추가 (`@cloudflare/vitest-pool-workers`로 실제 D1).
- 모킹 기본 금지 — 통합 테스트 우선. 외부 IO/비결정적 의존만 모킹.

## TypeScript

strict 전부 on + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. 의미:

- 배열/객체 인덱싱 결과는 `T | undefined` — 좁히기 필수.
- optional 프로퍼티에 `undefined` 명시 할당 불가 — 키 자체를 생략.
- `any` 금지. 타입 모르면 `unknown` 후 좁히기.

## SQL

모든 쿼리는 `src/db/repo.ts`에만. 라우트/수집기는 repo 함수 경유. 바인딩 파라미터 사용 (문자열 보간 금지 — SQL injection).
