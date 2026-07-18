export type RangeKind = 'current' | 'previous' | 'lastYear'

export interface ParsedComparisonRange {
  start: string
  end: string
  days: number | null
  raw: string
}

export function comparisonRangeName(kind: RangeKind): string {
  return {
    current: '所选区间',
    previous: '上一等长区间',
    lastYear: '去年同日期区间',
  }[kind]
}

export function comparisonRangeTitle(kind: RangeKind, rangeText?: string): string {
  const days = rangeText ? countRangeDays(rangeText) : null
  if (!days) {
    return {
      current: '所选区间待补',
      previous: '上一等长区间待补',
      lastYear: '去年同日期区间待补',
    }[kind]
  }
  return explicitRangeName(kind, days)
}

export function comparisonRangeLabel(kind: RangeKind, rangeText: string): string {
  const parsed = parseComparisonRange(rangeText)
  return parsed.days
    ? `${comparisonRangeName(kind)} · ${parsed.start} 至 ${parsed.end} · ${parsed.days}天`
    : comparisonRangeName(kind)
}

export function countRangeDays(rangeText: string): number | null {
  const parsed = parseComparisonRange(rangeText)
  return parsed.days
}

export function parseComparisonRange(rangeText: string): ParsedComparisonRange {
  const [startRaw, endRaw] = rangeText.split(' 至 ').map((value) => value?.trim()).filter(Boolean)
  if (!startRaw || !endRaw) return { start: '', end: '', days: null, raw: rangeText }
  const start = new Date(startRaw)
  const end = new Date(endRaw)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { start: startRaw, end: endRaw, days: null, raw: rangeText }
  }
  const diffDays = (end.getTime() - start.getTime()) / 86_400_000
  if (diffDays < 0) return { start: startRaw, end: endRaw, days: null, raw: rangeText }
  const dateOnlyRange = !startRaw.includes('T') && !endRaw.includes('T')
  return {
    start: formatRangeDate(startRaw),
    end: formatRangeDate(endRaw),
    days: Math.max(1, Math.round(diffDays) + (dateOnlyRange ? 1 : 0)),
    raw: rangeText,
  }
}

function formatRangeDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function explicitRangeName(kind: RangeKind, days: number): string {
  if (days === 7) {
    return {
      current: '本周',
      previous: '上周',
      lastYear: '去年同周',
    }[kind]
  }
  if (days >= 28 && days <= 31) {
    return {
      current: '本月',
      previous: '上月',
      lastYear: '去年同月',
    }[kind]
  }
  if (days >= 89 && days <= 92) {
    return {
      current: '本季度',
      previous: '上季度',
      lastYear: '去年同季',
    }[kind]
  }
  return {
    current: `所选区间（${days}天）`,
    previous: `上一等长区间（${days}天）`,
    lastYear: `去年同日期区间（${days}天）`,
  }[kind]
}
