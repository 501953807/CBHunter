export type RangeKind = 'current' | 'previous' | 'lastYear'

export interface ParsedComparisonRange {
  start: string
  end: string
  days: number | null
  raw: string
}

export function comparisonRangeName(kind: RangeKind): string {
  return {
    current: '统计日期范围',
    previous: '环比日期范围',
    lastYear: '同比日期范围',
  }[kind]
}

export function comparisonRangeTitle(kind: RangeKind, rangeText?: string): string {
  const days = rangeText ? countRangeDays(rangeText) : null
  if (!days) {
    return {
      current: '统计日期天数待补',
      previous: '环比日期天数待补',
      lastYear: '同比日期天数待补',
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
  return {
    current: days === 30 ? '统计日期范围（默认最近30个自然日）' : `统计日期范围（所选日期${days}天）`,
    previous: `环比日期范围（向前紧邻${days}天）`,
    lastYear: `同比日期范围（去年同日期${days}天）`,
  }[kind]
}
