# Backlog

## Next

- [ ] 검색 LIKE → FTS5 가상테이블 전환 (복잡 전문검색 필요 시)

## Someday

- [ ] 수집 결과 알림 (이메일/슬랙)
- [ ] 입찰공고 변경 이력 추적
- [ ] 상태배지(취소/종료) ↔ 마감일 필터 불일치 정리 — 취소 공고가 미래 마감일이면 기본 검색에 노출됨

## Done

- [x] 보존 정책 — soft 필터 채택 (삭제 없음). 기본 검색에서 마감(`bid_clse_date < today` KST) 제외 + "마감 포함" 토글. `searchBids` `includeClosed`/`today` 파라미터.
