// src/pages/ResultsPage.tsx
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  TextField,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Chip,
  Tooltip,
  Backdrop,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Checkbox,
  InputAdornment,
  Menu,
  ListItemText,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  EmojiEvents as EmojiEventsIcon,
  Add as AddIcon,
  PlaylistAdd as PlaylistAddIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  resultApi,
  testTypeApi,
  testGradeApi,
  trainingCampApi,
  campParticipantApi,
} from '../services/api';
import {
  type ResultStatus,
  type Result,
  type TestType,
  type TestGrade,
  type TestParameter,
  type TrainingCamp,
  type CampUserDto,
  type InvalidParam,
} from '../types';
import {
  gradeForResult,
  computeReportStatus,
  previewReportStatus,
  isAttemptPassed,
  reportStatusLabels,
  reportStatusColors,
  type ReportStatus,
} from '../utils/resultComputation';
import { ImportResultsDialog } from './ImportResultsDialog';

// ============================================================
// Хелперы (чистые функции — вне компонента)
// ============================================================

const parameterLabels: Record<TestParameter, string> = {
  time: 'Время',
  level: 'Уровень + отрезки',
  segments: 'Отрезки',
};

function getContrastColor(hex: string | null | undefined): string {
  if (!hex) return '#000';
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#000';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#000';
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.6 ? '#000' : '#fff';
}

function parseNum(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function metricValue(
  r: Pick<Result, 'time' | 'level' | 'segments'>,
  parameter: TestParameter,
): number | null {
  if (parameter === 'time') return r.time;
  if (parameter === 'level') return r.level;
  if (parameter === 'segments') return r.segments;
  return null;
}

function collectTestTypeIds(results: Result[], primaryId: string): string[] {
  const s = new Set<string>();
  for (const r of results) {
    for (const id of r.testTypeIds) s.add(id);
  }
  if (primaryId) s.add(primaryId);
  return [...s].sort();
}

function indexTestTypes(types: TestType[]): Map<string, TestType> {
  const m = new Map<string, TestType>();
  for (const t of types) m.set(t.id, t);
  return m;
}

/**
 * Индекс результатов по слоту (user, is_10m, leg).
 *
 * В одном слоте теперь может быть НЕСКОЛЬКО результатов — по одному
 * на каждый уникальный набор testTypeIds. Поэтому значение — массив.
 */
function indexResultsByKey(results: Result[]): Map<string, Result[]> {
  const m = new Map<string, Result[]>();
  for (const r of results) {
    const key = `${r.userId}|${r.isTen}|${r.legNumber}`;
    const arr = m.get(key) ?? [];
    arr.push(r);
    m.set(key, arr);
  }
  return m;
}

function indexTestTypesByUser(results: Result[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of results) {
    const set = new Set(m.get(r.userId) ?? []);
    for (const id of r.testTypeIds) set.add(id);
    m.set(r.userId, [...set]);
  }
  return m;
}

function computeStatusByUserAndTest(
  results: Result[],
  testTypesByUser: Map<string, string[]>,
  testTypeById: Map<string, TestType>,
): Map<string, ReportStatus> {
  const m = new Map<string, ReportStatus>();
  const mainByUser = new Map<string, Result[]>();
  for (const r of results) {
    if (r.isTen) continue;
    const arr = mainByUser.get(r.userId) ?? [];
    arr.push(r);
    mainByUser.set(r.userId, arr);
  }
  for (const [userId, mainAll] of mainByUser) {
    const tests = testTypesByUser.get(userId) ?? [];
    for (const tid of tests) {
      const tt = testTypeById.get(tid);
      if (!tt) continue;
      const filtered = mainAll.filter((r) => r.testTypeIds.includes(tid));
      m.set(`${userId}|${tid}`, computeReportStatus(filtered, tt));
    }
  }
  return m;
}

function buildGradesMap(
  testTypeIds: string[],
  dataArray: Array<TestGrade[] | undefined>,
): Map<string, TestGrade[]> {
  const m = new Map<string, TestGrade[]>();
  testTypeIds.forEach((tid, i) => {
    m.set(tid, dataArray[i] ?? []);
  });
  return m;
}

function filterAndSortParticipants(
  participants: CampUserDto[],
  search: string,
): CampUserDto[] {
  const q = search.trim().toLowerCase();
  const arr = [...participants].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(
      `${b.lastName} ${b.firstName}`,
    ),
  );
  if (!q) return arr;
  return arr.filter((p) =>
    `${p.lastName} ${p.firstName} ${p.email}`.toLowerCase().includes(q),
  );
}

/**
 * Найти первый результат пользователя с данным testTypeId.
 *
 * Используется для тестов type=segments и type=level, у которых
 * нет попыток: считаем, что на пользователя — один результат.
 */
function findFirstResultForUser(
  results: Result[],
  userId: string,
  testTypeId: string,
): Result | null {
  for (const r of results) {
    if (r.userId === userId && r.testTypeIds.includes(testTypeId)) {
      return r;
    }
  }
  return null;
}

// ============================================================
// Форма
// ============================================================

type ResultForm = {
  status: ResultStatus;
  time: string;
  level: string;
  segments: string;
};

type FieldErrors = Partial<
  Record<'time' | 'level' | 'segments', string>
>;

const EMPTY_FORM: ResultForm = {
  status: 'completed',
  time: '',
  level: '',
  segments: '',
};

// ============================================================
// Компонент
// ============================================================

export default function ResultsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedCampId = searchParams.get('camp') ?? '';
  const primaryTestTypeId = searchParams.get('type') ?? '';

  const setCampAndType = (camp: string, type: string) => {
    const next = new URLSearchParams(searchParams);
    if (camp) next.set('camp', camp);
    else next.delete('camp');
    if (type) next.set('type', type);
    else next.delete('type');
    setSearchParams(next, { replace: true });
  };

  const [search, setSearch] = useState('');

  // Меню «Тесты» в шапке спортсмена
  const [testMenuAnchor, setTestMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [testMenuUserId, setTestMenuUserId] = useState<string | null>(null);

  // Диалог импорта из Excel
  const [importOpen, setImportOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogUserId, setDialogUserId] = useState<string>('');
  const [dialogIsTen, setDialogIsTen] = useState(false);
  const [dialogLegNumber, setDialogLegNumber] = useState<number>(1);
  const [dialogTestTypeId, setDialogTestTypeId] = useState<string>('');
  const [dialogExisting, setDialogExisting] = useState<Result | null>(null);
  const [form, setForm] = useState<ResultForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // ============================================================
  // Справочники
  // ============================================================
  const { data: testTypes = [] } = useQuery<TestType[]>({
    queryKey: ['test-types-all'],
    queryFn: () =>
      testTypeApi.getAll({ limit: 1000 }).then((r) => r.data.rows),
  });

  const { data: camps = [] } = useQuery<TrainingCamp[]>({
    queryKey: ['camps-all'],
    queryFn: () =>
      trainingCampApi.getAll({ limit: 1000 }).then((r) => r.data.rows),
  });

  const { data: participants = [] } = useQuery<CampUserDto[]>({
    queryKey: ['camp-participants', selectedCampId],
    queryFn: () =>
      campParticipantApi.getByCamp(selectedCampId).then((r) => r.data),
    enabled: !!selectedCampId,
  });

  const ready = !!selectedCampId && !!primaryTestTypeId;

  // ============================================================
  // Результаты
  // ============================================================
  const {
    data: allResults = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<Result[]>({
    queryKey: [
      'results-all',
      { campId: selectedCampId, testTypeId: primaryTestTypeId },
    ],
    queryFn: () =>
      resultApi
        .getAllByCampAndType(primaryTestTypeId, selectedCampId)
        .then((r) => r.data),
    enabled: ready,
  });

  // ============================================================
  // Производные (чистые функции, без useMemo)
  // ============================================================
  const testTypeById = indexTestTypes(testTypes);
  const allUsedTestTypeIds = collectTestTypeIds(
    allResults,
    primaryTestTypeId,
  );
  const resultByKey = indexResultsByKey(allResults);
  const testTypesByUser = indexTestTypesByUser(allResults);
  const statusByUserAndTest = computeStatusByUserAndTest(
    allResults,
    testTypesByUser,
    testTypeById,
  );
  const filteredParticipants = filterAndSortParticipants(
    participants,
    search,
  );

  // ============================================================
  // Градации
  // ============================================================
  const gradesQueries = useQueries({
    queries: allUsedTestTypeIds.map((tid) => ({
      queryKey: ['test-grades', tid],
      queryFn: () => testGradeApi.getAllByTestType(tid).then((r) => r.data),
      enabled: !!tid,
    })),
  });

  const gradesByTestType = buildGradesMap(
    allUsedTestTypeIds,
    gradesQueries.map((q) => q.data),
  );

  // ============================================================
  // Слоты
  // ============================================================
  const primaryTestType = testTypeById.get(primaryTestTypeId) ?? null;

  // Режим отображения таблицы:
  //   - 'time'     — колонки «Основной» и «10 м», слоты забегов;
  //   - 'segments' — одна колонка «Отрезки» (по метрике segments);
  //   - 'level'    — две колонки: «Уровень» и «Отрезки».
  const isTimeTest = primaryTestType?.parameter === 'time';
  const isSegmentsTest = primaryTestType?.parameter === 'segments';
  const isLevelTest = primaryTestType?.parameter === 'level';

  const attemptsCount = primaryTestType?.attemptsCount ?? 3;
  const totalSlots = attemptsCount + 1;

  const slotNumbers = useMemo(
    () => Array.from({ length: totalSlots }, (_, i) => i + 1),
    [totalSlots],
  );

  const isLastSlot = (leg: number) => leg === totalSlots;

  // ============================================================
  // Ошибки полей
  // ============================================================
  const extractFieldErrors = (err: unknown): FieldErrors => {
    const errors: FieldErrors = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const params = err.response.data.invalid_params as InvalidParam[];
      for (const p of params) {
        const first = p.errors[0];
        if (first) errors[p.name as keyof FieldErrors] = first.reason;
      }
    }
    return errors;
  };

  // ============================================================
  // Мутации
  // ============================================================
  const invalidateResults = () => {
    queryClient.invalidateQueries({ queryKey: ['results-all'] });
  };

  const upsertMutation = useMutation({
    mutationFn: (payload: {
      userId: string;
      campId: string;
      body: {
        items: Array<{
          isTen: boolean;
          legNumber: number;
          status: ResultStatus;
          time?: number | null;
          level?: number | null;
          segments?: number | null;
        }>;
        testTypeIds: string[];
      };
    }) =>
      resultApi.upsertUserResults(payload.userId, payload.campId, payload.body),
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Результат сохранён',
        severity: 'success',
      });
      setDialogOpen(false);
      setFieldErrors({});
      invalidateResults();
    },
    onError: (err: unknown) => {
      const fe = extractFieldErrors(err);
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        setSnackbar({
          open: true,
          message: 'Проверьте правильность заполнения полей',
          severity: 'error',
        });
      } else {
        const msg =
          err instanceof AxiosError
            ? err.response?.data?.message || 'Ошибка сохранения'
            : 'Неизвестная ошибка';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => resultApi.remove(id),
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Результат удалён',
        severity: 'success',
      });
      setDialogOpen(false);
      setDialogExisting(null);
      invalidateResults();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message || 'Ошибка удаления'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // ============================================================
  // Добавить / убрать тип теста у спортсмена
  // ============================================================
  const toggleTestForUser = async (
    userId: string,
    testTypeId: string,
    attach: boolean,
  ) => {
    const userResults = allResults.filter((r) => r.userId === userId);
    if (userResults.length === 0) return;

    const relevantResults = userResults.filter((r) =>
      r.testTypeIds.includes(primaryTestTypeId),
    );

    if (relevantResults.length === 0) return;

    try {
      let changed = 0;

      for (const r of relevantResults) {
        const typeIds = new Set(r.testTypeIds);

        if (attach) {
          if (typeIds.has(testTypeId)) continue;
          typeIds.add(testTypeId);
        } else {
          if (!typeIds.has(testTypeId)) continue;
          if (typeIds.size <= 1) continue;
          typeIds.delete(testTypeId);
        }

        await resultApi.upsertUserResults(userId, selectedCampId, {
          items: [
            {
              isTen: r.isTen,
              legNumber: r.legNumber,
              status: r.status,
              time: r.time,
              level: r.level,
              segments: r.segments,
            },
          ],
          testTypeIds: [...typeIds],
        });

        changed += 1;
      }

      setSnackbar({
        open: true,
        message:
          changed > 0
            ? attach
              ? 'Тип теста добавлен'
              : 'Тип теста убран'
            : 'Ничего не изменилось',
        severity: 'success',
      });
      invalidateResults();
    } catch (e) {
      setSnackbar({
        open: true,
        message:
          e instanceof AxiosError
            ? e.response?.data?.message || 'Ошибка сохранения'
            : 'Неизвестная ошибка',
        severity: 'error',
      });
    }
  };

  // ============================================================
  // Диалог
  // ============================================================
  const handleOpenCell = (
    userId: string,
    isTen: boolean,
    legNumber: number,
    testTypeId: string,
    existing: Result | null,
  ) => {
    setDialogUserId(userId);
    setDialogIsTen(isTen);
    setDialogLegNumber(legNumber);
    setDialogTestTypeId(testTypeId);
    setDialogExisting(existing);

    if (existing) {
      setForm({
        status: existing.status,
        time: existing.time != null ? String(existing.time) : '',
        level: existing.level != null ? String(existing.level) : '',
        segments: existing.segments != null ? String(existing.segments) : '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setFieldErrors({});
    setDialogOpen(true);
  };

  const dialogTestType = testTypeById.get(dialogTestTypeId) ?? null;

  const handleSave = () => {
    if (!dialogTestType) return;

    const errs: FieldErrors = {};

    const t = parseNum(form.time);
    const l = parseNum(form.level);
    const s = parseNum(form.segments);

    if (form.status !== 'not_admitted') {
      const required =
        dialogTestType.parameter === 'time'
          ? t
          : dialogTestType.parameter === 'segments'
            ? s
            : dialogTestType.parameter === 'level'
              ? l
              : null;
      if (required == null) {
        errs.time = 'Заполните обязательную метрику';
      }
    }

    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    const isNotAdmitted = form.status === 'not_admitted';

    const touchesTime = dialogTestType.parameter === 'time';
    const touchesLevel = dialogTestType.parameter === 'level';
    const touchesSegments =
      dialogTestType.parameter === 'segments' ||
      dialogTestType.parameter === 'level';

    const currentRow = dialogExisting;

    const timeValue = touchesTime
      ? isNotAdmitted
        ? null
        : t
      : (currentRow?.time ?? null);

    const levelValue = touchesLevel
      ? isNotAdmitted
        ? null
        : l
      : (currentRow?.level ?? null);

    const segmentsValue = touchesSegments
      ? isNotAdmitted
        ? null
        : s
      : (currentRow?.segments ?? null);

    const existingTypeIds = new Set(dialogExisting?.testTypeIds ?? []);
    existingTypeIds.add(dialogTestTypeId);

    upsertMutation.mutate({
      userId: dialogUserId,
      campId: selectedCampId,
      body: {
        items: [
          {
            isTen: dialogIsTen,
            legNumber: dialogLegNumber,
            status: form.status,
            time: timeValue,
            level: levelValue,
            segments: segmentsValue,
          },
        ],
        testTypeIds: [...existingTypeIds],
      },
    });
  };

  const handleDelete = () => {
    if (!dialogExisting) return;
    deleteMutation.mutate(dialogExisting.id);
  };

  // ============================================================
  // Предпросмотр в диалоге
  // ============================================================
  const draft = {
    status: form.status,
    time: parseNum(form.time),
    level: parseNum(form.level),
    segments: parseNum(form.segments),
  };

  const dialogGrades = dialogTestType
    ? gradesByTestType.get(dialogTestType.id) ?? []
    : [];

  const draftGrade = dialogTestType
    ? gradeForResult(draft, dialogTestType.parameter, dialogGrades)
    : null;

  const draftPassed = dialogTestType
    ? isAttemptPassed(draft, dialogTestType)
    : null;

  const draftStatusPreview: ReportStatus | null =
    dialogTestType && dialogUserId
      ? previewReportStatus(
          allResults.filter(
            (r) =>
              r.userId === dialogUserId &&
              !r.isTen &&
              r.testTypeIds.includes(dialogTestType.id),
          ),
          dialogExisting?.id ?? null,
          draft,
          dialogTestType,
        )
      : null;

  // ============================================================
  // Меню «Тесты»
  // ============================================================
  const userTestIds = (() => {
    const s = new Set<string>();
    if (!testMenuUserId) return s;
    for (const r of allResults) {
      if (
        r.userId === testMenuUserId &&
        r.testTypeIds.includes(primaryTestTypeId)
      ) {
        for (const id of r.testTypeIds) s.add(id);
      }
    }
    return s;
  })();

  const menuUserHasResults = (() => {
    if (!testMenuUserId) return false;
    return allResults.some(
      (r) =>
        r.userId === testMenuUserId &&
        r.testTypeIds.includes(primaryTestTypeId),
    );
  })();

  const handleOpenTestMenu = (
    e: React.MouseEvent<HTMLElement>,
    userId: string,
  ) => {
    setTestMenuAnchor(e.currentTarget);
    setTestMenuUserId(userId);
  };

  const handleCloseTestMenu = () => {
    setTestMenuAnchor(null);
    setTestMenuUserId(null);
  };

  // ============================================================
  // Рендер
  // ============================================================
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Результаты тестов
      </Typography>

      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <FormControl sx={{ minWidth: 280, flex: 1 }} required>
          <InputLabel>Лагерь</InputLabel>
          <Select
            value={selectedCampId}
            label="Лагерь"
            onChange={(e) => setCampAndType(e.target.value, primaryTestTypeId)}
          >
            <MenuItem value="">
              <em>— выберите лагерь —</em>
            </MenuItem>
            {camps.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
                {c.startDate && c.endDate
                  ? ` (${c.startDate} … ${c.endDate})`
                  : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 280, flex: 1 }} required>
          <InputLabel>Основной тест</InputLabel>
          <Select
            value={primaryTestTypeId}
            label="Основной тест"
            onChange={(e) => setCampAndType(selectedCampId, e.target.value)}
          >
            <MenuItem value="">
              <em>— выберите основной тест —</em>
            </MenuItem>
            {testTypes.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} ({t.gender === 'male' ? 'муж.' : 'жен.'},{' '}
                {parameterLabels[t.parameter]})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {ready && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
          }}
        >
          <TextField
            size="small"
            placeholder="Поиск по ФИО или email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            variant="contained"
            onClick={() => refetch()}
            disabled={isFetching}
            startIcon={
              isFetching ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
          >
            Обновить
          </Button>

          <Button
            variant="contained"
            color="secondary"
            onClick={() => setImportOpen(true)}
            disabled={!primaryTestType}
            startIcon={<UploadFileIcon />}
          >
            Импорт из Excel
          </Button>
        </Paper>
      )}

      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {!ready ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Выберите лагерь и основной тест, чтобы увидеть результаты
            </Typography>
          </Box>
        ) : isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error instanceof AxiosError
              ? error.response?.data?.message ||
                'Не удалось загрузить результаты'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : filteredParticipants.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {participants.length === 0
                ? 'В лагере нет участников'
                : 'Никто не подходит под поиск'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  {isTimeTest ? (
                    <>
                      <TableRow>
                        <TableCell
                          rowSpan={2}
                          sx={{
                            fontWeight: 600,
                            minWidth: 240,
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            verticalAlign: 'top',
                          }}
                        >
                          Спортсмен
                        </TableCell>
                        <TableCell
                          rowSpan={2}
                          sx={{
                            fontWeight: 600,
                            minWidth: 160,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            verticalAlign: 'top',
                          }}
                        >
                          Тест
                        </TableCell>
                        <TableCell
                          colSpan={totalSlots}
                          align="center"
                          sx={{ fontWeight: 600 }}
                        >
                          Основной
                        </TableCell>
                        <TableCell
                          colSpan={totalSlots}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            borderLeft: '2px solid',
                            borderColor: 'divider',
                          }}
                        >
                          10 м
                        </TableCell>
                        <TableCell
                          rowSpan={2}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            borderLeft: '2px solid',
                            borderColor: 'divider',
                            verticalAlign: 'top',
                            minWidth: 110,
                          }}
                        >
                          Итог
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        {slotNumbers.map((leg) => (
                          <TableCell
                            key={`main-${leg}`}
                            align="center"
                            sx={{ minWidth: 84 }}
                          >
                            {isLastSlot(leg) ? 'Пересдача' : `Забег ${leg}`}
                          </TableCell>
                        ))}
                        {slotNumbers.map((leg) => (
                          <TableCell
                            key={`ten-${leg}`}
                            align="center"
                            sx={{
                              minWidth: 84,
                              borderLeft: leg === 1 ? '2px solid' : undefined,
                              borderColor: 'divider',
                            }}
                          >
                            {isLastSlot(leg) ? 'Пересдача' : `Забег ${leg}`}
                          </TableCell>
                        ))}
                      </TableRow>
                    </>
                  ) : isSegmentsTest ? (
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          minWidth: 240,
                          borderRight: '2px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Спортсмен
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          minWidth: 160,
                          borderRight: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Тест
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ fontWeight: 600, minWidth: 140 }}
                      >
                        Отрезки
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 600,
                          borderLeft: '2px solid',
                          borderColor: 'divider',
                          minWidth: 110,
                        }}
                      >
                        Итог
                      </TableCell>
                    </TableRow>
                  ) : (
                    // isLevelTest
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          minWidth: 240,
                          borderRight: '2px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Спортсмен
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          minWidth: 160,
                          borderRight: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Тест
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ fontWeight: 600, minWidth: 120 }}
                      >
                        Уровень
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ fontWeight: 600, minWidth: 120 }}
                      >
                        Отрезки
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 600,
                          borderLeft: '2px solid',
                          borderColor: 'divider',
                          minWidth: 110,
                        }}
                      >
                        Итог
                      </TableCell>
                    </TableRow>
                  )}
                </TableHead>
                <TableBody>
                  {filteredParticipants.flatMap((p) => {
                    const userTestsFromResults = testTypesByUser.get(p.id);
                    const hasResults =
                      userTestsFromResults !== undefined &&
                      userTestsFromResults.length > 0;

                    const userTests: string[] = hasResults
                      ? userTestsFromResults!
                      : primaryTestTypeId
                        ? [primaryTestTypeId]
                        : [];

                    if (userTests.length === 0) return [];

                    return userTests.map((tid, idx) => {
                      const tt = testTypeById.get(tid);
                      if (!tt) return null;
                      const isFirst = idx === 0;
                      const userStatus = statusByUserAndTest.get(
                        `${p.id}|${tid}`,
                      );

                      return (
                        <TableRow key={`${p.id}-${tid}`} hover>
                          {isFirst && (
                            <TableCell
                              rowSpan={userTests.length}
                              sx={{
                                borderRight: '2px solid',
                                borderColor: 'divider',
                                verticalAlign: 'top',
                                pt: 1.5,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                              >
                                {p.lastName} {p.firstName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mb: 0.5 }}
                              >
                                № {p.bib}
                              </Typography>
                              <Tooltip
                                title={
                                  hasResults
                                    ? 'Добавить или убрать типы тестов'
                                    : 'Сначала создайте результат'
                                }
                              >
                                <span>
                                  <Button
                                    size="small"
                                    startIcon={<PlaylistAddIcon />}
                                    onClick={(e) =>
                                      handleOpenTestMenu(e, p.id)
                                    }
                                    disabled={!hasResults}
                                    sx={{
                                      mt: 0.5,
                                      textTransform: 'none',
                                    }}
                                  >
                                    Тесты
                                  </Button>
                                </span>
                              </Tooltip>
                            </TableCell>
                          )}

                          <TableCell
                            sx={{
                              borderRight: '1px solid',
                              borderColor: 'divider',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Typography variant="body2">{tt.name}</Typography>
                          </TableCell>

                          {/* ================================================
                              Рендер колонок с ячейками — зависит от
                              типа основного теста.
                          ================================================ */}
                          {isTimeTest && (
                            <>
                              {slotNumbers.map((leg) => {
                                const candidates =
                                  resultByKey.get(
                                    `${p.id}|false|${leg}`,
                                  ) ?? [];
                                const cellResult =
                                  candidates.find((r) =>
                                    r.testTypeIds.includes(tid),
                                  ) ?? null;

                                return (
                                  <ResultCell
                                    key={`main-${p.id}-${tid}-${leg}`}
                                    result={cellResult}
                                    isTen={false}
                                    legNumber={leg}
                                    isLast={isLastSlot(leg)}
                                    parameter={tt.parameter}
                                    grades={gradesByTestType.get(tid) ?? []}
                                    onClick={(
                                      userId,
                                      isTen,
                                      legNumber,
                                      existing,
                                    ) =>
                                      handleOpenCell(
                                        userId,
                                        isTen,
                                        legNumber,
                                        tid,
                                        existing,
                                      )
                                    }
                                    userId={p.id}
                                  />
                                );
                              })}

                              {slotNumbers.map((leg) => {
                                const candidates =
                                  resultByKey.get(
                                    `${p.id}|true|${leg}`,
                                  ) ?? [];
                                const cellResult =
                                  candidates.find((r) =>
                                    r.testTypeIds.includes(tid),
                                  ) ?? null;

                                return (
                                  <ResultCell
                                    key={`ten-${p.id}-${tid}-${leg}`}
                                    result={cellResult}
                                    isTen={true}
                                    legNumber={leg}
                                    isLast={isLastSlot(leg)}
                                    parameter={tt.parameter}
                                    grades={gradesByTestType.get(tid) ?? []}
                                    onClick={(
                                      userId,
                                      isTen,
                                      legNumber,
                                      existing,
                                    ) =>
                                      handleOpenCell(
                                        userId,
                                        isTen,
                                        legNumber,
                                        tid,
                                        existing,
                                      )
                                    }
                                    userId={p.id}
                                  />
                                );
                              })}
                            </>
                          )}

                          {isSegmentsTest &&
                            (() => {
                              const cellResult = findFirstResultForUser(
                                allResults,
                                p.id,
                                tid,
                              );

                              return (
                                <ResultCell
                                  result={cellResult}
                                  isTen={cellResult?.isTen ?? false}
                                  legNumber={cellResult?.legNumber ?? 1}
                                  isLast={false}
                                  parameter={tt.parameter}
                                  grades={gradesByTestType.get(tid) ?? []}
                                  onClick={(
                                    userId,
                                    isTen,
                                    legNumber,
                                    existing,
                                  ) =>
                                    handleOpenCell(
                                      userId,
                                      isTen,
                                      legNumber,
                                      tid,
                                      existing,
                                    )
                                  }
                                  userId={p.id}
                                />
                              );
                            })()}

                          {isLevelTest &&
                            (() => {
                              const cellResult = findFirstResultForUser(
                                allResults,
                                p.id,
                                tid,
                              );

                              return (
                                <>
                                  <ResultCell
                                    result={cellResult}
                                    isTen={cellResult?.isTen ?? false}
                                    legNumber={cellResult?.legNumber ?? 1}
                                    isLast={false}
                                    parameter={tt.parameter}
                                    grades={gradesByTestType.get(tid) ?? []}
                                    onClick={(
                                      userId,
                                      isTen,
                                      legNumber,
                                      existing,
                                    ) =>
                                      handleOpenCell(
                                        userId,
                                        isTen,
                                        legNumber,
                                        tid,
                                        existing,
                                      )
                                    }
                                    userId={p.id}
                                  />
                                  <ResultCell
                                    result={cellResult}
                                    isTen={cellResult?.isTen ?? false}
                                    legNumber={cellResult?.legNumber ?? 1}
                                    isLast={false}
                                    parameter={tt.parameter}
                                    grades={gradesByTestType.get(tid) ?? []}
                                    onClick={(
                                      userId,
                                      isTen,
                                      legNumber,
                                      existing,
                                    ) =>
                                      handleOpenCell(
                                        userId,
                                        isTen,
                                        legNumber,
                                        tid,
                                        existing,
                                      )
                                    }
                                    userId={p.id}
                                    metricOverride="segments"
                                  />
                                </>
                              );
                            })()}

                          <TableCell
                            align="center"
                            sx={{
                              borderLeft: '2px solid',
                              borderColor: 'divider',
                            }}
                          >
                            {userStatus ? (
                              <Chip
                                size="small"
                                variant={
                                  userStatus === 'passed'
                                    ? 'filled'
                                    : 'outlined'
                                }
                                label={reportStatusLabels[userStatus]}
                                color={reportStatusColors[userStatus]}
                              />
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Спортсменов: {filteredParticipants.length}
                {search.trim() && ` из ${participants.length}`}
                {' · '}
                Результатов: {allResults.length}
                {' · '}
                Активных тестов: {allUsedTestTypeIds.length}
              </Typography>
            </Box>

            <Backdrop
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                backgroundColor: 'rgba(255,255,255,0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              open={isLoading || isFetching}
            >
              <CircularProgress />
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                Загрузка данных...
              </Typography>
            </Backdrop>
          </>
        )}
      </Paper>

      {/* Меню «Тесты» */}
      <Menu
        anchorEl={testMenuAnchor}
        open={!!testMenuAnchor}
        onClose={handleCloseTestMenu}
        slotProps={{ paper: { sx: { maxHeight: 400, minWidth: 280 } } }}
      >
        {!menuUserHasResults && (
          <MenuItem disabled>
            <Typography variant="caption" color="text.secondary">
              Сначала создайте результат
            </Typography>
          </MenuItem>
        )}
        {menuUserHasResults && (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 2, py: 1, display: 'block' }}
            >
              Привязанные типы тестов
            </Typography>
            {testTypes.map((t) => {
              const checked = userTestIds.has(t.id);
              const isPrimary = t.id === primaryTestTypeId;
              return (
                <MenuItem
                  key={t.id}
                  dense
                  disabled={isPrimary}
                  onClick={() => {
                    if (!testMenuUserId) return;
                    toggleTestForUser(testMenuUserId, t.id, !checked);
                    handleCloseTestMenu();
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={checked}
                    disabled={isPrimary}
                    sx={{ mr: 1 }}
                  />
                  <ListItemText
                    primary={t.name}
                    secondary={`${
                      t.gender === 'male' ? 'муж.' : 'жен.'
                    } · ${parameterLabels[t.parameter]}${
                      isPrimary ? ' · основной' : ''
                    }`}
                  />
                </MenuItem>
              );
            })}
          </>
        )}
      </Menu>

      <Dialog
        open={dialogOpen}
        onClose={() =>
          !upsertMutation.isPending &&
          !deleteMutation.isPending &&
          setDialogOpen(false)
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogExisting ? 'Редактирование результата' : 'Новый результат'}
          <Typography
            variant="body2"
            color="text.secondary"
            component="div"
            sx={{ mt: 0.5 }}
          >
            {(() => {
              const u = participants.find((x) => x.id === dialogUserId);
              const name = u ? `${u.lastName} ${u.firstName}` : '—';
              return (
                <>
                  <b>{name}</b>
                  {' · '}
                  {dialogIsTen ? '10 м' : 'Основной'} ·{' '}
                  {isLastSlot(dialogLegNumber)
                    ? 'Пересдача'
                    : `Забег ${dialogLegNumber}`}
                  {dialogTestType ? ` · ${dialogTestType.name}` : ''}
                </>
              );
            })()}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
            >
              <Stack direction="row" spacing={2} sx={{ flex: 1 }}>
                {(dialogTestType?.parameter === 'time' ||
                  dialogTestType?.parameter === undefined) && (
                  <TextField
                    label="Время (сек) *"
                    type="number"
                    value={form.time}
                    onChange={(e) =>
                      setForm({ ...form, time: e.target.value })
                    }
                    error={!!fieldErrors.time}
                    helperText={fieldErrors.time || ''}
                    fullWidth
                    disabled={
                      upsertMutation.isPending ||
                      deleteMutation.isPending ||
                      form.status === 'not_admitted'
                    }
                    slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                  />
                )}
                {dialogTestType?.parameter === 'level' && (
                  <>
                    <TextField
                      label="Уровень *"
                      type="number"
                      value={form.level}
                      onChange={(e) =>
                        setForm({ ...form, level: e.target.value })
                      }
                      error={!!fieldErrors.time}
                      fullWidth
                      disabled={
                        upsertMutation.isPending ||
                        deleteMutation.isPending ||
                        form.status === 'not_admitted'
                      }
                      slotProps={{ htmlInput: { step: '1', min: 0 } }}
                    />
                    <TextField
                      label="Отрезки"
                      type="number"
                      value={form.segments}
                      onChange={(e) =>
                        setForm({ ...form, segments: e.target.value })
                      }
                      fullWidth
                      disabled={
                        upsertMutation.isPending ||
                        deleteMutation.isPending ||
                        form.status === 'not_admitted'
                      }
                      slotProps={{ htmlInput: { step: '1', min: 0 } }}
                    />
                  </>
                )}
                {dialogTestType?.parameter === 'segments' && (
                  <TextField
                    label="Отрезки *"
                    type="number"
                    value={form.segments}
                    onChange={(e) =>
                      setForm({ ...form, segments: e.target.value })
                    }
                    error={!!fieldErrors.time}
                    helperText={fieldErrors.time || ''}
                    fullWidth
                    disabled={
                      upsertMutation.isPending ||
                      deleteMutation.isPending ||
                      form.status === 'not_admitted'
                    }
                    slotProps={{ htmlInput: { step: '1', min: 0 } }}
                  />
                )}
              </Stack>

              <StatusCheckboxes
                status={form.status}
                onChange={(s) => setForm({ ...form, status: s })}
                disabled={
                  upsertMutation.isPending || deleteMutation.isPending
                }
              />
            </Stack>

            <AttemptPreviewRow
              grade={draftGrade}
              passed={draftPassed}
              hasGrades={dialogGrades.length > 0}
              status={form.status}
            />

            {draftStatusPreview && (
              <FinalStatusPreview status={draftStatusPreview} />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {dialogExisting && (
            <Button
              onClick={handleDelete}
              color="error"
              variant="outlined"
              disabled={
                upsertMutation.isPending || deleteMutation.isPending
              }
              sx={{ mr: 'auto' }}
            >
              {deleteMutation.isPending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                'Удалить'
              )}
            </Button>
          )}
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={
              upsertMutation.isPending || deleteMutation.isPending
            }
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              upsertMutation.isPending || deleteMutation.isPending
            }
          >
            {upsertMutation.isPending ? (
              <CircularProgress size={24} />
            ) : dialogExisting ? (
              'Сохранить'
            ) : (
              'Создать'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <ImportResultsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        campId={selectedCampId}
        testType={primaryTestType}
        participants={participants}
        onSaved={() => {
          setImportOpen(false);
          invalidateResults();
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ============================================================
// Ячейка результата
// ============================================================

function ResultCell({
  result,
  isTen,
  legNumber,
  isLast,
  parameter,
  grades,
  userId,
  onClick,
  metricOverride,
}: {
  result: Result | null;
  isTen: boolean;
  legNumber: number;
  isLast: boolean;
  parameter: TestParameter;
  grades: TestGrade[];
  userId: string;
  onClick: (
    userId: string,
    isTen: boolean,
    legNumber: number,
    existing: Result | null,
  ) => void;
  /**
   * Переопределяет метрику, которую показывает ячейка.
   *
   * Используется для тестов type=level, где одна ячейка должна
   * показать уровень, а другая — отрезки, при этом градация
   * считается по-прежнему по `parameter` теста.
   */
  metricOverride?: TestParameter;
}) {
  const handleClick = () => onClick(userId, isTen, legNumber, result);

  const baseSx = {
    textAlign: 'center' as const,
    p: 1,
    minWidth: 80,
    height: 48,
    cursor: 'pointer',
    transition: 'filter 0.15s',
    borderLeft: legNumber === 1 && isTen ? '2px solid' : undefined,
    borderColor: 'divider',
  };

  if (!result) {
    return (
      <TableCell
        onClick={handleClick}
        sx={{ ...baseSx, '&:hover': { backgroundColor: 'action.hover' } }}
      >
        <Tooltip title="Добавить результат">
          <Typography
            variant="caption"
            sx={{
              color: 'text.disabled',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            <AddIcon fontSize="inherit" sx={{ fontSize: 14 }} />—
          </Typography>
        </Tooltip>
      </TableCell>
    );
  }

  if (result.status === 'not_admitted') {
    return (
      <TableCell
        onClick={handleClick}
        sx={{
          ...baseSx,
          backgroundColor: '#E0E0E0',
          '&:hover': { filter: 'brightness(0.95)' },
        }}
      >
        <Tooltip
          title={`${isTen ? '10 м' : 'Основной'} · ${
            isLast ? 'Пересдача' : `Забег ${legNumber}`
          } · Не допущен`}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: 'text.secondary' }}
          >
            Н/Д
          </Typography>
        </Tooltip>
      </TableCell>
    );
  }

  const metric = metricOverride ?? parameter;
  const value = metricValue(result, metric);
  const displayValue =
    value != null ? (metric === 'time' ? value.toFixed(2) : value) : '—';

  const isNotCredited = result.status === 'not_credited';

  if (isTen) {
    return (
      <TableCell
        onClick={handleClick}
        sx={{ ...baseSx, '&:hover': { backgroundColor: 'action.hover' } }}
      >
        <Tooltip
          title={`10 м · ${
            isLast ? 'Пересдача' : `Забег ${legNumber}`
          } · ${isNotCredited ? 'Не зачтён' : 'Зачтён'}`}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: isNotCredited ? 'warning.dark' : 'text.primary',
              textDecoration: isNotCredited ? 'line-through' : 'none',
            }}
          >
            {displayValue}
          </Typography>
        </Tooltip>
      </TableCell>
    );
  }

  const grade = gradeForResult(result, parameter, grades);

  let bgcolor: string;
  if (isNotCredited) bgcolor = '#FFE0B2';
  else if (grade) bgcolor = grade.color;
  else bgcolor = '#BDBDBD';

  const fgcolor = isNotCredited ? '#000' : getContrastColor(bgcolor);

  const tooltipParts = [
    isLast ? 'Пересдача' : `Забег ${legNumber}`,
    isNotCredited ? 'Не зачтён' : null,
    grade ? `Градация: ${grade.grade}` : 'Градация не подошла',
    `Порог: ${grade?.threshold ?? '—'}`,
  ].filter(Boolean);

  return (
    <TableCell
      onClick={handleClick}
      sx={{
        ...baseSx,
        backgroundColor: bgcolor,
        color: fgcolor,
        '&:hover': { filter: 'brightness(0.9)' },
      }}
    >
      <Tooltip title={tooltipParts.join(' · ')}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: fgcolor,
            textDecoration: isNotCredited ? 'line-through' : 'none',
          }}
        >
          {displayValue}
        </Typography>
      </Tooltip>
    </TableCell>
  );
}

// ============================================================
// Чекбоксы статуса
// ============================================================

function StatusCheckboxes({
  status,
  onChange,
  disabled,
}: {
  status: ResultStatus;
  onChange: (s: ResultStatus) => void;
  disabled?: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ flexShrink: 0, alignItems: 'center' }}
    >
      <Tooltip title="Не зачтён (ошибка спортсмена / техническая ошибка)">
        <FormControlLabel
          sx={{ mr: 0, whiteSpace: 'nowrap' }}
          control={
            <Checkbox
              size="small"
              color="warning"
              checked={status === 'not_credited'}
              onChange={(e) =>
                onChange(e.target.checked ? 'not_credited' : 'completed')
              }
              disabled={disabled}
            />
          }
          label="Не зачтён"
        />
      </Tooltip>

      <Tooltip title="Спортсмен не допущен к тесту">
        <FormControlLabel
          sx={{ mr: 0, whiteSpace: 'nowrap' }}
          control={
            <Checkbox
              size="small"
              color="error"
              checked={status === 'not_admitted'}
              onChange={(e) =>
                onChange(e.target.checked ? 'not_admitted' : 'completed')
              }
              disabled={disabled}
            />
          }
          label="Не допущен"
        />
      </Tooltip>
    </Stack>
  );
}

// ============================================================
// Предпросмотр попытки
// ============================================================

function AttemptPreviewRow({
  grade,
  passed,
  hasGrades,
  status,
}: {
  grade: TestGrade | null;
  passed: boolean | null;
  hasGrades: boolean;
  status: ResultStatus;
}) {
  if (status === 'not_admitted') {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
        <Typography variant="body2" color="text.secondary">
          Спортсмен не допущен — градация не применяется, метрики не
          сохраняются.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.5,
        borderColor: grade?.color ?? 'divider',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Попытка:
      </Typography>

      {passed !== null && (
        <Chip
          size="small"
          variant="outlined"
          color={passed ? 'success' : 'error'}
          label={passed ? 'В порог уложился' : 'Не уложился в порог'}
        />
      )}

      {grade ? (
        <>
          <Typography variant="body2" color="text.secondary">
            Градация:
          </Typography>
          <Chip
            icon={<EmojiEventsIcon />}
            label={grade.grade}
            size="small"
            sx={{
              bgcolor: grade.color,
              color: getContrastColor(grade.color),
              fontWeight: 600,
              '& .MuiChip-icon': { color: getContrastColor(grade.color) },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            порог: {grade.threshold}
          </Typography>
        </>
      ) : passed !== null && !hasGrades ? (
        <Typography variant="caption" color="text.secondary">
          у типа теста нет градаций
        </Typography>
      ) : passed !== null ? (
        <Typography variant="caption" color="warning.dark">
          ни одна градация не подходит
        </Typography>
      ) : null}
    </Paper>
  );
}

// ============================================================
// Предпросмотр итогового статуса
// ============================================================

function FinalStatusPreview({ status }: { status: ReportStatus }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.5,
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Итог по спортсмену в лагере:
      </Typography>
      <Chip
        size="small"
        label={reportStatusLabels[status]}
        color={reportStatusColors[status]}
        variant={status === 'passed' ? 'filled' : 'outlined'}
      />
      <Typography variant="caption" color="text.secondary">
        (предпросмотр с учётом ещё не сохранённых изменений)
      </Typography>
    </Paper>
  );
}
