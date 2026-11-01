// Filter rule trial — compare a draft rule set against local sample notices before saving it.
// Local files only: no network, no D1. Run with Node's built-in type stripping (pnpm filter:trial).
//
//   pnpm filter:trial --samples <samples.json> --draft <draft-rules.json> [--current <rules.json>]
//
// samples.json: array of objects with string fields dmndInsttNm, bsnsDivNm, bidNtceNm,
//   bidprcPsblIndstrytyNm (bidNtceNo optional, used as a label). Raw KONEPS items also fit.
// rules.json: FilterRules object (dmndInclude, dmndExclude, bsnsDivEquals, nameExclude,
//   industryInclude, industryExclude — each a string array). --current defaults to DEFAULT_RULES.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  type BidVerdict,
  compareRules,
  DEFAULT_RULES,
  type FilterInput,
  type FilterRules,
  parseFilterInputs,
  parseFilterRules,
  type VerdictChange,
} from "../src/collector/filter.ts";

type Sample = FilterInput & { bidNtceNo?: string };

function fail(message: string): never {
  console.error(`filter-trial: ${message}`);
  process.exit(1);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`cannot read ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function loadRules(path: string): FilterRules {
  const raw = readJson(path);
  try {
    const { rules, usedDefault } = parseFilterRules(raw);
    if (usedDefault) {
      console.log(`※ ${path}: 활성 규칙 0건 → 운영과 같이 DEFAULT_RULES 로 대체합니다.`);
    }
    return rules;
  } catch (e) {
    fail(`${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function loadSamples(path: string): Sample[] {
  const raw = readJson(path);
  try {
    return parseFilterInputs(raw);
  } catch (e) {
    fail(`${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function describeVerdict(v: BidVerdict): string {
  if (v.pass) return v.keyword === null ? "통과" : `통과 (업종 "${v.keyword}")`;
  return v.keyword === null ? `탈락 — ${v.rule}` : `탈락 — ${v.rule} "${v.keyword}"`;
}

function printChanges(title: string, changes: VerdictChange<Sample>[]): void {
  console.log(`\n${title} (${changes.length})`);
  if (changes.length === 0) console.log("  없음");
  for (const { item, before, after } of changes) {
    console.log(`  ${item.bidNtceNo ?? "-"} ${item.bidNtceNm} [${item.dmndInsttNm}]`);
    console.log(`    현재: ${describeVerdict(before)}`);
    console.log(`    초안: ${describeVerdict(after)}`);
  }
}

const { values } = parseArgs({
  options: {
    samples: { type: "string" },
    draft: { type: "string" },
    current: { type: "string" },
  },
});
if (values.samples === undefined || values.draft === undefined) {
  fail("usage: --samples <samples.json> --draft <draft-rules.json> [--current <rules.json>]");
}

const samples = loadSamples(values.samples);
const current = values.current === undefined ? DEFAULT_RULES : loadRules(values.current);
const draft = loadRules(values.draft);
const result = compareRules(samples, current, draft);

console.log(
  `규칙 비교 — 표본 ${samples.length}건 · 현재: ${values.current ?? "DEFAULT_RULES"} · 초안: ${values.draft}`,
);
console.log(
  "※ 표본 판정 결과일 뿐 전체 수집 결과가 아닙니다. 제외 공고는 DB에 저장되지 않으므로 운영 DB로는 누락을 검증할 수 없습니다.",
);
printChanges("새로 제외됨", result.newlyExcluded);
printChanges("새로 포함됨", result.newlyIncluded);
console.log(`\n통과 여부 변동 없음 ${result.unchanged}건 (판정 근거가 바뀐 경우는 표시하지 않음)`);
