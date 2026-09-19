// src/pages/TrainingSessionPage.tsx

import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Button,
  Divider,
  Snackbar,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Backdrop,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  FavoriteBorder as HrIcon,
  Timer as TimerIcon,
  Straighten as DistanceIcon,
  LocalFireDepartment as CaloriesIcon,
  TrendingUp as AscentIcon,
  TrendingDown as DescentIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';

import { trainingApi } from '../services/api';
import type { TrainingSessionWithSamples, SampleType } from '../types';

// ------------------------------------------------------------------
// Справочники отображения
// ------------------------------------------------------------------

const SPORT_LABELS: Record<string, string> = {
  running: 'Бег',
  cycling: 'Велосипед',
  swimming: 'Плавание',
  walking: 'Ходьба',
  hiking: 'Поход',
  strength: 'Силовая',
  cardio: 'Кардио',
  yoga: 'Йога',
  rowing: 'Гребля',
  skiing: 'Лыжи',
  skating: 'Коньки',
  tennis: 'Теннис',
  football: 'Футбол',
  basketball: 'Баскетбол',
  other: 'Другое',
};

const SAMPLE_META: Record<
  SampleType,
  { label: string; unit: string; color: string }
> = {
  hr:          { label: 'Пульс',       unit: 'уд/мин', color: '#e53935' },
  speed:       { label: 'Скорость',    unit: 'м/с',    color: '#1e88e5' },
  power:       { label: 'Мощность',    unit: 'Вт',     color: '#8e24aa' },
  cadence:     { label: 'Каденс',      unit: 'об/мин', color: '#43a047' },
  altitude:    { label: 'Высота',      unit: 'м',      color: '#6d4c41' },
  distance:    { label: 'Дистанция',   unit: 'м',      color: '#fb8c00' },
  temperature: { label: 'Температура', unit: '°C',     color: '#00897b' },
};

/** Порядок вывода графиков. Всё, чего нет в массиве, пойдёт в конец. */
const SAMPLE_ORDER: SampleType[] = [
  'hr',
  'speed',
  'power',
  'cadence',
  'altitude',
  'distance',
  'temperature',
];

/** Варианты сглаживания в секундах. 0 = выключено. */
const SMOOTH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0,  label: 'Выкл' },
  { value: 10, label: '10 с' },
  { value: 30, label: '30 с' },
  { value: 60, label: '60 с' },
];

const CHART_HEIGHT = 200;

// ------------------------------------------------------------------
// Форматтеры
// ------------------------------------------------------------------

function formatDuration(sec: number | null | undefined): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function formatDistance(m: number | null | undefined): string {
  if (m == null) return '—';
  return `${(m / 1000).toFixed(2)} км`;
}

function formatTimeAxis(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// ------------------------------------------------------------------
// Сглаживание
// ------------------------------------------------------------------

/**
 * Скользящее среднее. Значения null / NaN / Infinity игнорируются,
 * а не превращаются в 0 — иначе график «проваливался» бы в районе
 * пропусков данных.
 *
 * `window` — размер окна в ТОЧКАХ, а не в секундах. Перевод из
 * секунд делает вызывающий код, зная `intervalSec`.
 */
function movingAverage(
  values: Array<number | null | undefined>,
  window: number,
): Array<number | null> {
  if (window <= 1) {
    return values.map((v) =>
      typeof v === 'number' && Number.isFinite(v) ? v : null,
    );
  }

  const half = Math.floor(window / 2);
  const out: Array<number | null> = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length - 1, i + half);
    let sum = 0;
    let n = 0;
    for (let j = lo; j <= hi; j++) {
      const v = values[j];
      if (typeof v === 'number' && Number.isFinite(v)) {
        sum += v;
        n++;
      }
    }
    out[i] = n > 0 ? sum / n : null;
  }
  return out;
}

/**
 * Готовит массив точек { t, value } для Recharts:
 *  1. сглаживает значения окном, посчитанным из секунд;
 *  2. выкидывает null-точки (Recharts не рисует разрывы корректно);
 *  3. проставляет время `t` в секундах от старта.
 */
function buildSeries(
  values: Array<number | null | undefined>,
  intervalSec: number,
  smoothWindow: number,
): Array<{ t: number; value: number }> {
  const pointsWindow =
    smoothWindow > 0 && intervalSec > 0
      ? Math.max(1, Math.round(smoothWindow / intervalSec))
      : 1;

  const smoothed = movingAverage(values, pointsWindow);

  const data: Array<{ t: number; value: number }> = [];
  for (let i = 0; i < smoothed.length; i++) {
    const v = smoothed[i];
    if (v == null) continue;
    data.push({ t: i * intervalSec, value: v });
  }
  return data;
}

// ------------------------------------------------------------------
// Вспомогательный компонент — «плитка» со статистикой
// ------------------------------------------------------------------

type StatProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minWidth: 150,
        flex: '1 1 150px',
      }}
    >
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap>
          {label}
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

// ------------------------------------------------------------------
// Компонент одного графика
// ------------------------------------------------------------------

type SampleChartProps = {
  type: SampleType;
  values: number[];
  intervalSec: number;
  smoothWindow: number;
};

function SampleChart({
  type,
  values,
  intervalSec,
  smoothWindow,
}: SampleChartProps) {
  const meta = SAMPLE_META[type];

  const data = useMemo(
    () => buildSeries(values, intervalSec, smoothWindow),
    [values, intervalSec, smoothWindow],
  );

  // Температура — единственный канал, который может быть
  // отрицательным. Для остальных (hr, speed, power, cadence,
  // altitude, distance) нижняя граница — 0. Это убирает
  // «ныряние» оси в минус и делает графики сопоставимыми.
  const yDomain: [number | 'auto', number | 'auto'] =
    type === 'temperature' ? ['auto', 'auto'] : [0, 'auto'];

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Typography variant="h6" sx={{ color: meta.color }}>
          {meta.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {meta.unit} • {data.length} точек • интервал {intervalSec} с
        </Typography>
      </Box>

      {data.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Нет данных для отображения
          </Typography>
        </Box>
      ) : (
        <Box sx={{ width: '100%', height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="t"
                tickFormatter={formatTimeAxis}
                minTickGap={40}
                fontSize={11}
              />
              <YAxis
                domain={yDomain}
                width={55}
                fontSize={11}
              />
              <RechartsTooltip
                formatter={(value) => [
                  `${value as number} ${meta.unit}`,
                  meta.label,
                ]}
                labelFormatter={(label) =>
                  `Время: ${formatTimeAxis(Number(label))}`
                }
              />
              <Line
                type="monotone"
                dataKey="value"
                name={meta.label}
                stroke={meta.color}
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function TrainingSessionPage() {
  const { provider, externalId } = useParams<{
    provider: string;
    externalId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [smoothWindow, setSmoothWindow] = useState<number>(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // --- Запрос одной тренировки с сэмплами ---
  const {
    data: session,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<TrainingSessionWithSamples>({
    queryKey: ['training-session', provider, externalId],
    queryFn: () =>
      trainingApi.getOne(provider!, externalId!).then((r) => r.data),
    enabled: !!provider && !!externalId,
  });

  // --- Удаление ---
  const deleteMutation = useMutation({
    mutationFn: () => trainingApi.delete(provider!, externalId!),
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Тренировка удалена',
        severity: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      navigate(-1);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message || 'Ошибка удаления'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
      setDeleteDialogOpen(false);
    },
  });

  // --- Упорядоченный список каналов, которые есть в этой тренировке ---
  //
  // Сортируем по SAMPLE_ORDER, всё незнакомое (если Polar когда-то
  // добавит новый канал) идёт в конец — чтобы не терять данные.
  const orderedSamples = useMemo<SampleType[]>(() => {
    if (!session?.samples) return [];
    const present = Object.keys(session.samples) as SampleType[];
    const known = SAMPLE_ORDER.filter((t) => present.includes(t));
    const unknown = present.filter((t) => !SAMPLE_ORDER.includes(t));
    return [...known, ...unknown];
  }, [session]);

  // --- Состояния загрузки/ошибки ---
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !session) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Повторить
            </Button>
          }
        >
          {error instanceof AxiosError
            ? error.response?.data?.message || 'Не удалось загрузить тренировку'
            : 'Произошла неизвестная ошибка'}
        </Alert>
      </Box>
    );
  }

  const sportLabel = session.sport
    ? SPORT_LABELS[session.sport] ?? session.sport
    : '—';

  return (
    <Box sx={{ p: 3 }}>
      {/* Шапка: назад + заголовок + действия */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
          flexWrap: 'wrap',
        }}
      >
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }} noWrap>
            {session.name || 'Тренировка'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date(session.startTime).toLocaleString('ru-RU')}
            {' • '}
            {session.provider}
          </Typography>
        </Box>

        <Chip label={sportLabel} color="primary" size="small" />

        <Tooltip title="Обновить">
          <span>
            <IconButton onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Удалить">
          <span>
            <IconButton
              color="error"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Плитки со статистикой */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        <StatCard
          icon={<TimerIcon />}
          label="Длительность"
          value={formatDuration(session.durationSec)}
        />
        <StatCard
          icon={<DistanceIcon />}
          label="Дистанция"
          value={formatDistance(session.distanceM)}
        />
        <StatCard
          icon={<CaloriesIcon />}
          label="Калории"
          value={session.calories != null ? `${session.calories} ккал` : '—'}
        />
        <StatCard
          icon={<HrIcon />}
          label="Пульс (сред./макс./мин.)"
          value={
            session.hrAvg != null ||
            session.hrMax != null ||
            session.hrMin != null
              ? `${session.hrAvg ?? '—'} / ${session.hrMax ?? '—'} / ${
                  session.hrMin ?? '—'
                }`
              : '—'
          }
        />
        <StatCard
          icon={<AscentIcon />}
          label="Набор высоты"
          value={session.ascentM != null ? `${session.ascentM} м` : '—'}
        />
        <StatCard
          icon={<DescentIcon />}
          label="Сброс высоты"
          value={session.descentM != null ? `${session.descentM} м` : '—'}
        />
      </Box>

      {/* Управление сглаживанием — одно на все графики */}
      {orderedSamples.length > 0 && (
        <Paper
          sx={{
            p: 1.5,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ mr: 1 }}>
            Сглаживание:
          </Typography>
          {SMOOTH_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              color={smoothWindow === opt.value ? 'primary' : 'default'}
              variant={smoothWindow === opt.value ? 'filled' : 'outlined'}
              onClick={() => setSmoothWindow(opt.value)}
            />
          ))}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 'auto' }}
          >
            Применяется ко всем графикам
          </Typography>
        </Paper>
      )}

      {/* Графики друг под другом */}
      {orderedSamples.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            В этой тренировке нет данных для графиков
          </Typography>
        </Paper>
      ) : (
        orderedSamples.map((type) => {
          const sample = session.samples[type];
          if (!sample) return null;
          return (
            <SampleChart
              key={type}
              type={type}
              values={sample.values}
              intervalSec={sample.intervalSec}
              smoothWindow={smoothWindow}
            />
          );
        })
      )}

      {/* Заметки */}
      {session.notes && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Заметки
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {session.notes}
          </Typography>
        </Paper>
      )}

      {/* Оверлей обновления (не блокирующий) */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (t) => t.zIndex.drawer + 1,
          backgroundColor: 'rgba(255,255,255,0.4)',
        }}
        open={isFetching && !isLoading}
      >
        <CircularProgress color="primary" />
      </Backdrop>

      {/* Диалог удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить эту тренировку? Действие
            необратимо.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={() => deleteMutation.mutate()}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <CircularProgress size={24} />
            ) : (
              'Удалить'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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