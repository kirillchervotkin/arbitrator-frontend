// src/utils/resultComputation.ts
import type { Result, TestType, TestGrade, TestParameter } from '../types';

// ============================================================
// Итоговый статус (агрегат по пользователю в лагере по типу теста)
// ============================================================

export type ReportStatus =
  | 'not_attempted'
  | 'not_admitted'
  | 'technical_error'
  | 'passed'
  | 'failed';

export const reportStatusLabels: Record<ReportStatus, string> = {
  not_attempted: 'Не пробовал',
  not_admitted: 'Не допущен',
  technical_error: 'Тех. ошибка',
  passed: 'Сдал',
  failed: 'Не сдал',
};

export const reportStatusColors: Record<
  ReportStatus,
  'success' | 'error' | 'warning' | 'default'
> = {
  not_attempted: 'default',
  not_admitted: 'default',
  technical_error: 'warning',
  passed: 'success',
  failed: 'error',
};

// ============================================================
// Градация (per-attempt)
// ============================================================

function gradeMetricValue(
  r: { time: number | null; level: number | null; segments: number | null },
  parameter: TestParameter,
): number | null {
  if (parameter === 'time') return r.time;
  if (parameter === 'level') return r.level;
  if (parameter === 'segments') return r.segments;
  return null;
}

export function pickGrade(
  value: number | null,
  parameter: TestParameter,
  grades: TestGrade[],
): TestGrade | null {
  if (value == null || grades.length === 0) return null;
  const lowerIsBetter = parameter === 'time';
  const sorted = [...grades].sort((a, b) =>
    lowerIsBetter ? a.threshold - b.threshold : b.threshold - a.threshold,
  );
  for (const g of sorted) {
    const ok = lowerIsBetter ? value <= g.threshold : value >= g.threshold;
    if (ok) return g;
  }
  return null;
}

export function gradeForResult(
  r: Pick<Result, 'status' | 'time' | 'level' | 'segments'>,
  parameter: TestParameter,
  grades: TestGrade[],
): TestGrade | null {
  if (r.status === 'not_admitted') return null;
  return pickGrade(gradeMetricValue(r, parameter), parameter, grades);
}

// ============================================================
// Per-attempt: уложился ли в порог
// ============================================================
// true  — попытка зачтена
// false — сделана, но не уложился
// null  — не оценивается (not_admitted / not_credited / нет метрики)

type ThresholdFields = Pick<
  TestType,
  | 'parameter'
  | 'failThresholdTime'
  | 'failThresholdLevel'
  | 'failThresholdSegments'
>;

export function isAttemptPassed(
  r: Pick<Result, 'status' | 'time' | 'level' | 'segments'>,
  testType: ThresholdFields,
): boolean | null {
  if (r.status === 'not_admitted') return null;
  if (r.status === 'not_credited') return null;

  if (testType.parameter === 'time') {
    if (r.time == null || testType.failThresholdTime == null) return null;
    return r.time <= testType.failThresholdTime;
  }
  if (testType.parameter === 'segments') {
    if (r.segments == null || testType.failThresholdSegments == null)
      return null;
    return r.segments >= testType.failThresholdSegments;
  }
  // level
  if (r.level == null || testType.failThresholdLevel == null) return null;
  return r.level >= testType.failThresholdLevel;
}

// ============================================================
// Агрегат по пользователю (только основные попытки, isTen === false)
// ============================================================

/**
 *   1. Нет ни одной записи                       → 'not_attempted'
 *   2. Все записи имеют статус not_admitted      → 'not_admitted'
 *   3. Записей меньше, чем N (attemptsCount)     → 'technical_error'
 *   4. Зачётов (isAttemptPassed === true) >= N   → 'passed'
 *   5. Иначе                                     → 'failed'
 */
export function computeReportStatus(
  mainAttempts: Result[],
  testType: Pick<TestType, 'attemptsCount'> & ThresholdFields,
): ReportStatus {
  if (mainAttempts.length === 0) return 'not_attempted';

  const allNotAdmitted = mainAttempts.every(
    (r) => r.status === 'not_admitted',
  );
  if (allNotAdmitted) return 'not_admitted';

  const required = testType.attemptsCount ?? 0;
  if (required > 0 && mainAttempts.length < required) return 'technical_error';

  const credited = mainAttempts.filter(
    (r) => isAttemptPassed(r, testType) === true,
  ).length;

  if (required === 0) return credited > 0 ? 'passed' : 'failed';
  return credited >= required ? 'passed' : 'failed';
}

/**
 * Лайв-предпросмотр: подменяет редактируемую (или ещё не созданную)
 * попытку черновиком и пересчитывает агрегат.
 */
export function previewReportStatus(
  allMainAttempts: Result[],
  editingId: string | null,
  draft: Pick<Result, 'status' | 'time' | 'level' | 'segments'>,
  testType: Pick<TestType, 'attemptsCount'> & ThresholdFields,
): ReportStatus {
  if (editingId == null) {
    const draftResult = {
      ...draft,
      id: '__draft__',
      userId: '',
      trainingCampId: '',
      isTen: false,
      legNumber: 0,
      testDate: new Date().toISOString(),
      testTypeIds: [],
    } as Result;
    return computeReportStatus([...allMainAttempts, draftResult], testType);
  }

  const patched = allMainAttempts.map((r) =>
    r.id === editingId ? { ...r, ...draft } : r,
  );
  return computeReportStatus(patched, testType);
}
