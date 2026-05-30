import type { FilterRuleRow } from "../db/repo";
import { escapeHtml } from "./render";

interface RuleGroup {
  type: string;
  label: string;
  hint: string;
}

const RULE_GROUPS: readonly RuleGroup[] = [
  {
    type: "dmnd_include",
    label: "수요기관 포함",
    hint: "수요기관명에 이 단어가 있어야 통과 (그룹 내 OR · 빈 그룹이면 제약 해제)",
  },
  { type: "dmnd_exclude", label: "수요기관 제외", hint: "수요기관명에 이 단어가 있으면 제외" },
  {
    type: "bsns_div_equals",
    label: "업무구분 일치",
    hint: "업무구분이 이 값과 정확히 일치해야 통과 (빈 그룹이면 제약 해제)",
  },
  { type: "name_exclude", label: "공고명 제외", hint: "공고명에 이 단어가 있으면 제외" },
  {
    type: "industry_include",
    label: "업종 포함",
    hint: "업종 세그먼트에 이 단어가 있어야 통과 (그룹 내 OR · 빈 그룹이면 제약 해제)",
  },
  {
    type: "industry_exclude",
    label: "업종 제외",
    hint: "업종 세그먼트에 이 단어가 있으면 해당 세그먼트 탈락",
  },
] as const;

function renderRule(rule: FilterRuleRow): string {
  const enabled = rule.enabled === 1;
  const targetEnabled = enabled ? "0" : "1";
  return `<li class="rule${enabled ? "" : " rule-off"}">
  <span class="rule-pattern">${escapeHtml(rule.pattern)}</span>
  <span class="rule-actions">
    <form method="POST" action="/admin/rules/${rule.id}/toggle">
      <input type="hidden" name="enabled" value="${targetEnabled}" />
      <button type="submit" class="btn-ghost">${enabled ? "비활성화" : "활성화"}</button>
    </form>
    <form method="POST" action="/admin/rules/${rule.id}/delete" onsubmit="return confirm('삭제할까요?')">
      <button type="submit" class="btn-ghost btn-danger">삭제</button>
    </form>
  </span>
</li>`;
}

export interface AdminCollectSummary {
  date: string;
  fetched: number;
  filtered: number;
  upserted: number;
}

function renderCollectSummary(summary: AdminCollectSummary | undefined): string {
  if (!summary) return "";
  return `<p class="collect-result">수집 완료: ${escapeHtml(summary.date)} · 전체 ${summary.fetched.toLocaleString("ko-KR")}건 · 필터 후 ${summary.filtered.toLocaleString("ko-KR")}건 · 저장 ${summary.upserted.toLocaleString("ko-KR")}건</p>`;
}

function renderGroup(group: RuleGroup, rules: FilterRuleRow[]): string {
  const items =
    rules.length > 0
      ? `<ul class="rules">${rules.map(renderRule).join("\n")}</ul>`
      : '<p class="empty">규칙 없음 — 이 조건은 비활성</p>';

  return `<section class="group">
  <h2>${escapeHtml(group.label)} <code>${escapeHtml(group.type)}</code></h2>
  <p class="hint">${escapeHtml(group.hint)}</p>
  ${items}
  <form method="POST" action="/admin/rules" class="add">
    <input type="hidden" name="rule_type" value="${escapeHtml(group.type)}" />
    <input name="pattern" type="text" placeholder="패턴 추가" required />
    <button type="submit" class="btn-primary">추가</button>
  </form>
</section>`;
}

export function renderAdminPage(
  rules: FilterRuleRow[],
  collectSummary?: AdminCollectSummary,
): string {
  const sections = RULE_GROUPS.map((g) =>
    renderGroup(
      g,
      rules.filter((r) => r.rule_type === g.type),
    ),
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>bid-lens 어드민 — 수집 필터 규칙</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet" />
  <style>
    :root {
      --ink: #181d26; --body: #333840; --muted: #41454d; --hairline: #dddddd;
      --canvas: #ffffff; --surface-soft: #f8fafc; --primary: #181d26; --primary-active: #0d1218;
      --danger: #b3261e; --success: #14532d; --info: #1b4fa0; --r-sm: 6px; --r-md: 10px; --r-lg: 12px;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px; line-height: 1.5; margin: 0; background: var(--canvas); color: var(--body);
    }
    .container { max-width: 880px; margin: 0 auto; padding: 48px 24px 96px; }
    h1 { font-size: 28px; font-weight: 500; color: var(--ink); margin: 0 0 8px; }
    .lead { color: var(--muted); margin: 0 0 32px; }
    .lead a { color: var(--ink); }
    .group {
      border: 1px solid var(--hairline); border-radius: var(--r-lg);
      padding: 20px 24px; margin-bottom: 20px; background: var(--canvas);
    }
    .collect {
      border: 1px solid var(--hairline); border-radius: var(--r-lg);
      padding: 20px 24px; margin-bottom: 20px; background: var(--surface-soft);
    }
    .collect h2 { font-size: 16px; font-weight: 500; color: var(--ink); margin: 0 0 4px; }
    .collect-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; margin-top: 14px; }
    .collect-field { display: grid; gap: 4px; }
    .collect-field span { font-size: 12px; font-weight: 500; color: var(--muted); }
    .collect-form input {
      width: 100%;
      border: 1px solid var(--hairline); border-radius: var(--r-sm);
      padding: 0 12px; height: 38px; font-size: 14px; font-family: inherit; color: var(--ink);
    }
    .collect-result {
      margin: 12px 0 0; color: var(--success); font-size: 13px; font-weight: 500;
    }
    .collect-progress[hidden] { display: none; }
    .collect-progress {
      margin-top: 16px; border: 1px solid var(--hairline); border-radius: var(--r-md);
      background: var(--canvas); overflow: hidden;
    }
    .progress-head {
      display: flex; justify-content: space-between; gap: 12px;
      padding: 10px 12px; border-bottom: 1px solid var(--hairline);
      font-size: 13px; font-weight: 500; color: var(--ink);
    }
    .progress-bar { height: 6px; background: var(--surface-soft); }
    .progress-fill { width: 0%; height: 100%; background: var(--primary); transition: width 160ms ease; }
    .progress-log {
      list-style: none; margin: 0; padding: 4px 0; max-height: 220px; overflow: auto;
    }
    .progress-log li {
      display: flex; justify-content: space-between; gap: 12px;
      padding: 8px 12px; border-top: 1px solid var(--surface-soft);
      font-size: 12px; color: var(--body);
    }
    .progress-log li:first-child { border-top: 0; }
    .progress-log .done { color: var(--success); }
    .progress-log .running { color: var(--info); }
    .progress-log .error { color: var(--danger); }
    .progress-log .muted { color: var(--muted); }
    }
    .group h2 { font-size: 16px; font-weight: 500; color: var(--ink); margin: 0 0 4px; }
    .group h2 code { font-size: 12px; color: var(--muted); font-weight: 400; }
    .hint { font-size: 12px; color: var(--muted); margin: 0 0 16px; }
    .rules { list-style: none; margin: 0 0 16px; padding: 0; }
    .rule {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 8px 12px; border: 1px solid var(--hairline); border-radius: var(--r-sm);
      margin-bottom: 6px; background: var(--surface-soft);
    }
    .rule-off { opacity: 0.5; }
    .rule-off .rule-pattern { text-decoration: line-through; }
    .rule-pattern { font-weight: 500; color: var(--ink); }
    .rule-actions { display: flex; gap: 6px; }
    .rule-actions form { display: inline; margin: 0; }
    .empty { font-size: 13px; color: var(--muted); margin: 0 0 16px; font-style: italic; }
    .add { display: flex; gap: 8px; }
    .add input {
      flex: 1; border: 1px solid var(--hairline); border-radius: var(--r-sm);
      padding: 0 12px; height: 38px; font-size: 14px; font-family: inherit; color: var(--ink);
    }
    .add input:focus { border-color: var(--primary); outline: 2px solid var(--primary); outline-offset: 1px; }
    .btn-primary {
      padding: 0 18px; height: 38px; background: var(--primary); color: #fff; border: none;
      border-radius: var(--r-md); font-size: 14px; font-family: inherit; cursor: pointer; white-space: nowrap;
    }
    .btn-primary:active { background: var(--primary-active); }
    .btn-ghost {
      padding: 4px 10px; background: var(--canvas); color: var(--body); border: 1px solid var(--hairline);
      border-radius: var(--r-sm); font-size: 12px; font-family: inherit; cursor: pointer; white-space: nowrap;
    }
    .btn-ghost:hover { background: var(--surface-soft); }
    .btn-danger { color: var(--danger); border-color: #e7b8b5; }
    @media (max-width: 600px) {
      .container { padding: 24px 16px 48px; }
      .collect-form { grid-template-columns: 1fr; }
      .add { flex-direction: column; align-items: stretch; }
      .collect-form input, .collect-form button { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>수집 필터 규칙</h1>
    <p class="lead">규칙 편집은 <strong>다음 수집(cron)부터</strong> 반영됩니다. 저장된 공고는 재필터링되지 않습니다. 활성 규칙을 모두 비우면 <strong>기본 규칙</strong>으로 되돌아갑니다(전체 수집 방지). · <a href="/">공고 목록</a></p>
    <section class="collect">
      <h2>수동 수집</h2>
      <p class="hint">날짜 범위를 양끝 포함으로 다시 수집합니다. 이미 저장된 공고도 최신 응답으로 덮어씁니다.</p>
      <form method="POST" action="/admin/collect" class="collect-form" data-collect-form>
        <label class="collect-field">
          <span>시작일</span>
          <input name="startDate" type="date" required />
        </label>
        <label class="collect-field">
          <span>종료일</span>
          <input name="endDate" type="date" />
        </label>
        <button type="submit" class="btn-primary">수집</button>
      </form>
      <div class="collect-progress" id="collect-progress" hidden>
        <div class="progress-head">
          <span id="collect-status">대기</span>
          <span id="collect-total" class="muted">0/0</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" id="collect-fill"></div></div>
        <ul class="progress-log" id="collect-log"></ul>
      </div>
      ${renderCollectSummary(collectSummary)}
    </section>
    ${sections}
  </div>
  <script>
    (() => {
      const form = document.querySelector("[data-collect-form]");
      const progress = document.getElementById("collect-progress");
      const status = document.getElementById("collect-status");
      const total = document.getElementById("collect-total");
      const fill = document.getElementById("collect-fill");
      const log = document.getElementById("collect-log");
      if (!form || !progress || !status || !total || !fill || !log) return;

      const rows = new Map();
      let totalDays = 0;
      let completedDays = 0;

      const setProgress = () => {
        total.textContent = totalDays === 0 ? "0/0" : completedDays + "/" + totalDays;
        fill.style.width = totalDays === 0 ? "0%" : Math.round((completedDays / totalDays) * 100) + "%";
      };

      const rowFor = (date) => {
        const existing = rows.get(date);
        if (existing) return existing;
        const item = document.createElement("li");
        const left = document.createElement("span");
        const right = document.createElement("span");
        left.textContent = date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8);
        right.className = "muted";
        item.append(left, right);
        log.append(item);
        const row = { item, right };
        rows.set(date, row);
        return row;
      };

      const applyEvent = (event) => {
        if (event.type === "start") {
          totalDays = event.totalDays;
          completedDays = 0;
          rows.clear();
          log.textContent = "";
          status.textContent = "수집 시작";
          setProgress();
          return;
        }
        if (event.type === "day-start") {
          const row = rowFor(event.date);
          row.right.textContent = "대기 중";
          row.right.className = "running";
          status.textContent = event.dayIndex + "번째 날짜 수집 중";
          return;
        }
        if (event.type === "page") {
          const row = rowFor(event.date);
          const pages = event.totalPages === 0 ? "0/0" : event.page + "/" + event.totalPages;
          row.right.textContent = pages + " 페이지 · " + event.fetched + "/" + event.totalCount + "건";
          row.right.className = "running";
          return;
        }
        if (event.type === "day-complete") {
          const row = rowFor(event.date);
          row.right.textContent = "전체 " + event.fetched + " · 필터 " + event.filtered + " · 저장 " + event.upserted;
          row.right.className = "done";
          completedDays += 1;
          setProgress();
          return;
        }
        if (event.type === "day-error") {
          const row = rowFor(event.date);
          row.right.textContent = event.error;
          row.right.className = "error";
          completedDays += 1;
          setProgress();
          return;
        }
        if (event.type === "complete") {
          status.textContent =
            "완료 · 전체 " + event.fetched + " · 필터 " + event.filtered + " · 저장 " + event.upserted;
          if (event.errors > 0) status.textContent += " · 실패 " + event.errors;
          completedDays = totalDays;
          setProgress();
        }
      };

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const button = form.querySelector("button[type=submit]");
        const startInput = form.elements.namedItem("startDate");
        const endInput = form.elements.namedItem("endDate");
        if (startInput instanceof HTMLInputElement && endInput instanceof HTMLInputElement && !endInput.value) {
          endInput.value = startInput.value;
        }
        progress.hidden = false;
        status.textContent = "연결 중";
        totalDays = 0;
        completedDays = 0;
        rows.clear();
        log.textContent = "";
        setProgress();
        if (button instanceof HTMLButtonElement) button.disabled = true;

        try {
          const response = await fetch(form.action, {
            method: "POST",
            headers: { Accept: "application/x-ndjson" },
            body: new URLSearchParams(new FormData(form)),
          });
          if (!response.ok || !response.body) throw new Error(await response.text());

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) applyEvent(JSON.parse(line));
            }
          }
          if (buffer.trim()) applyEvent(JSON.parse(buffer));
        } catch (err) {
          status.textContent = err instanceof Error ? err.message : String(err);
        } finally {
          if (button instanceof HTMLButtonElement) button.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;
}
