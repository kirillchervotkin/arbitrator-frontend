// src/pages/TrainingSessionsPage.tsx

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TableSortLabel,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Snackbar,
  InputAdornment,
  Backdrop,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { trainingApi } from '../services/api';
import type {
  TrainingSessionListItem,
  ListTrainingSessionsResponse,
} from '../types';

// ------------------------------------------------------------------
// Стабильные пустые ссылки для fallback-ов
//
// `data?.sessions ?? []` создавал бы новый массив на каждом рендере,
// пока данных нет, и ломал бы мемоизацию ниже (ESLint:
// "make the dependencies of useMemo Hook change on every render").
// Одна константа на модуль — та же ссылка между рендерами.
// ------------------------------------------------------------------

const EMPTY_SESSIONS: TrainingSessionListItem[] = [];
const EMPTY_SPORT_TYPES: Record<string, { ru: string; en: string }> = {};

// ------------------------------------------------------------------
// Хелперы для дат
// ------------------------------------------------------------------

/** YYYY-MM-DD в локальной зоне — формат <input type="date"> */
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Начало дня как ISO */
function startOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

/** Начало следующего дня как ISO — контракт [from, to) */
function startOfNextDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

// ------------------------------------------------------------------
// Форматтеры
// ------------------------------------------------------------------

function formatDuration(sec: number | null): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function formatDistance(m: number | null): string {
  if (m == null) return '—';
  return `${(m / 1000).toFixed(2)} км`;
}

// ------------------------------------------------------------------
// Сортировка
// ------------------------------------------------------------------

type SortKey = 'startTime' | 'durationSec' | 'distanceM' | 'sport';
type SortDir = 'asc' | 'desc';

function compareSessions(
  a: TrainingSessionListItem,
  b: TrainingSessionListItem,
  key: SortKey,
): number {
  const av = a[key];
  const bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv));
}

// ------------------------------------------------------------------
// Дефолтный диапазон: последние 30 дней
// ------------------------------------------------------------------

const today = new Date();
const monthAgo = new Date();
monthAgo.setDate(monthAgo.getDate() - 30);

const DEFAULT_FROM = toDateInputValue(monthAgo);
const DEFAULT_TO = toDateInputValue(today);

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function TrainingSessionsPage() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState(DEFAULT_FROM);
  const [toDate, setToDate] = useState(DEFAULT_TO);
  const [appliedFrom, setAppliedFrom] = useState(DEFAULT_FROM);
  const [appliedTo, setAppliedTo] = useState(DEFAULT_TO);

  const [searchInput, setSearchInput] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('startTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // --- Запрос списка ---
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<ListTrainingSessionsResponse>({
    queryKey: ['training-sessions', { from: appliedFrom, to: appliedTo }],
    queryFn: () =>
      trainingApi
        .list({
          from: startOfDayIso(appliedFrom),
          to: startOfNextDayIso(appliedTo),
          limit: 500,
        })
        .then((r) => r.data),
    enabled: !!appliedFrom && !!appliedTo,
  });

  // Стабильные ссылки: пустой массив/объект из констант, не из литерала
  const sessions = data?.sessions ?? EMPTY_SESSIONS;
  const sportTypes = data?.sportTypes ?? EMPTY_SPORT_TYPES;

  // --- Фильтр по названию/спорту/провайдеру (на клиенте) ---
  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const name = (s.name ?? '').toLowerCase();
      const sport = (s.sport ?? '').toLowerCase();
      const provider = s.provider.toLowerCase();
      return name.includes(q) || sport.includes(q) || provider.includes(q);
    });
  }, [sessions, searchInput]);

  // --- Сортировка ---
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const r = compareSessions(a, b, sortKey);
      return sortDir === 'asc' ? r : -r;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleApply = () => {
    if (!fromDate || !toDate) {
      setSnackbar({
        open: true,
        message: 'Укажите обе даты',
        severity: 'error',
      });
      return;
    }
    if (fromDate > toDate) {
      setSnackbar({
        open: true,
        message: 'Дата начала позже даты окончания',
        severity: 'error',
      });
      return;
    }
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const handleClearSearch = () => setSearchInput('');

  const handleRowClick = (s: TrainingSessionListItem) => {
    navigate(`/training-sessions/${s.provider}/${s.externalId}`);
  };

  const sportLabel = (code: string | null): string => {
    if (!code) return '—';
    const dict = sportTypes[code];
    return dict?.ru ?? dict?.en ?? code;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Тренировки
      </Typography>

      {/* Панель фильтров */}
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
          label="С"
          type="date"
          size="small"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="По"
          type="date"
          size="small"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />

        <Button variant="contained" onClick={handleApply} disabled={isFetching}>
          Применить
        </Button>

        <TextField
          size="small"
          placeholder="Поиск по названию, спорту, провайдеру..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          autoComplete="off"
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchInput && (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={handleClearSearch}
                    sx={{ minWidth: 0, p: 0.5 }}
                  >
                    <ClearIcon fontSize="small" />
                  </Button>
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
      </Paper>

      {/* Таблица */}
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error instanceof AxiosError
              ? error.response?.data?.message ||
                'Не удалось загрузить тренировки'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : sorted.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {searchInput
                ? 'Ничего не найдено по запросу'
                : 'Тренировок за выбранный период нет'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sortDirection={
                        sortKey === 'startTime' ? sortDir : false
                      }
                    >
                      <TableSortLabel
                        active={sortKey === 'startTime'}
                        direction={
                          sortKey === 'startTime' ? sortDir : 'asc'
                        }
                        onClick={() => handleSort('startTime')}
                      >
                        Дата и время
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Название</TableCell>
                    <TableCell
                      sortDirection={sortKey === 'sport' ? sortDir : false}
                    >
                      <TableSortLabel
                        active={sortKey === 'sport'}
                        direction={sortKey === 'sport' ? sortDir : 'asc'}
                        onClick={() => handleSort('sport')}
                      >
                        Спорт
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      sortDirection={
                        sortKey === 'durationSec' ? sortDir : false
                      }
                    >
                      <TableSortLabel
                        active={sortKey === 'durationSec'}
                        direction={
                          sortKey === 'durationSec' ? sortDir : 'asc'
                        }
                        onClick={() => handleSort('durationSec')}
                      >
                        Длительность
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      sortDirection={
                        sortKey === 'distanceM' ? sortDir : false
                      }
                    >
                      <TableSortLabel
                        active={sortKey === 'distanceM'}
                        direction={
                          sortKey === 'distanceM' ? sortDir : 'asc'
                        }
                        onClick={() => handleSort('distanceM')}
                      >
                        Дистанция
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Пульс (сред.)</TableCell>
                    <TableCell>Провайдер</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((s) => (
                    <TableRow
                      key={s.id}
                      hover
                      onClick={() => handleRowClick(s)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        {new Date(s.startTime).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>{s.name || '—'}</TableCell>
                      <TableCell>
                        {s.sport ? (
                          <Chip label={sportLabel(s.sport)} size="small" />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{formatDuration(s.durationSec)}</TableCell>
                      <TableCell>{formatDistance(s.distanceM)}</TableCell>
                      <TableCell align="right">
                        {s.hrAvg != null ? `${s.hrAvg} уд/мин` : '—'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {s.provider}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Показано: {sorted.length}
                {searchInput && ` из ${sessions.length}`} тренировок
              </Typography>
            </Box>

            <Backdrop
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
                color: '#fff',
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
