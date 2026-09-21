import { competitionPageSx } from '../components/competition/competitionStyles';
import {
  calendarDayBoundary,
  calendarRangeError,
} from '../utils/calendarFilters';
import {
  CompetitionFilters,
  CompetitionHeader,
  CompetitionEmpty,
  CompetitionSummary,
} from '../components/competition/CompetitionPage';
// src/pages/MatchesPage.tsx

import { useState, useMemo } from 'react';
import {
  Autocomplete,
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
  Tooltip,
  Backdrop,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import {
  matchApi,
  tournamentApi,
  stageApi,
  teamApi,
  cityApi,
} from '../services/api';
import {
  Match,
  Tournament,
  Stage,
  Team,
  City,
  PaginatedResponse,
  CreateMatchDto,
  UpdateMatchDto,
  InvalidParam,
} from '../types';

const LIMIT = 20;

// ------------------------------------------------------------------
// Форма
// ------------------------------------------------------------------

type MatchForm = {
  stageId: string;
  matchDate: string; // 'YYYY-MM-DDTHH:mm'
  cityId: string;
  tourNumber: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: string;
  awayScore: string;
};

const defaultForm: MatchForm = {
  stageId: '',
  matchDate: '',
  cityId: '',
  tourNumber: '',
  homeTeamId: '',
  awayTeamId: '',
  homeScore: '',
  awayScore: '',
};

type FieldErrors = {
  stageId?: string;
  matchDate?: string;
  cityId?: string;
  tourNumber?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore?: string;
  awayScore?: string;
};

// ------------------------------------------------------------------
// Хелперы для дат
// ------------------------------------------------------------------

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function MatchesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // --- Фильтры ---
  const [searchParams, setSearchParams] = useSearchParams();
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('offset');
    if (key === 'tournamentId') next.delete('stageId');
    setSearchParams(next);
  };
  const tournamentFilter = searchParams.get('tournamentId') ?? '';
  const stageFilter = searchParams.get('stageId') ?? '';
  const teamFilter = searchParams.get('teamId') ?? '';
  const cityFilter = searchParams.get('cityId') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const rawOffset = Number(searchParams.get('offset') ?? 0);
  const offset =
    Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const setOffset = (value: number) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('offset', String(value));
    else next.delete('offset');
    setSearchParams(next);
  };
  const setTournamentFilter = (value: string) =>
    updateFilter('tournamentId', value);
  const setStageFilter = (value: string) => updateFilter('stageId', value);
  const setTeamFilter = (value: string) => updateFilter('teamId', value);
  const setCityFilter = (value: string) => updateFilter('cityId', value);
  const setDateFrom = (value: string) => updateFilter('dateFrom', value);
  const setDateTo = (value: string) => updateFilter('dateTo', value);

  const rangeError = calendarRangeError(dateFrom, dateTo);

  // --- Диалоги ---
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Отдельный ID турнира для формы создания,
  // чтобы не путать с фильтром
  const [formTournamentId, setFormTournamentId] = useState('');

  const [form, setForm] = useState<MatchForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // --- Удаление ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMatchId, setDeleteMatchId] = useState<string | null>(null);

  // --- Snackbar ---
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // --- Запрос матчей с пагинацией ---
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<
    PaginatedResponse<Match>
  >({
    enabled: !rangeError,
    queryKey: [
      'matches',
      {
        tournamentId: tournamentFilter || undefined,
        stageId: stageFilter || undefined,
        teamId: teamFilter || undefined,
        cityId: cityFilter || undefined,
        dateFrom: calendarDayBoundary(dateFrom),
        dateTo: calendarDayBoundary(dateTo, true),
        limit: LIMIT,
        offset,
      },
    ],
    queryFn: async () => {
      const res = await matchApi.getAll({
        tournamentId: tournamentFilter || undefined,
        stageId: stageFilter || undefined,
        teamId: teamFilter || undefined,
        cityId: cityFilter || undefined,
        dateFrom: calendarDayBoundary(dateFrom),
        dateTo: calendarDayBoundary(dateTo, true),
        limit: LIMIT,
        offset,
        orderBy: 'matchDate',
        orderDir: 'DESC',
      });
      return res.data;
    },
  });

  const matches = data?.rows ?? [];
  const total = data?.total ?? 0;

  // --- Справочники ---
  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await tournamentApi.getAll({
        orderBy: 'season',
        orderDir: 'DESC',
      });
      return res.data;
    },
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await teamApi.getAll({ orderBy: 'name', orderDir: 'ASC' });
      return res.data;
    },
  });

  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ['cities'],
    queryFn: async () => {
      const res = await cityApi.getAll({ orderBy: 'name', orderDir: 'ASC' });
      return res.data;
    },
  });

  // Все этапы — грузим один раз, чтобы использовать
  // и в фильтре, и в таблице, и в форме
  const { data: allStages = [] } = useQuery<Stage[]>({
    queryKey: ['stages-all', tournaments.map((t) => t.id).join(',')],
    queryFn: async () => {
      const all: Stage[] = [];
      for (const t of tournaments) {
        const res = await stageApi.getAll(t.id);
        all.push(...res.data);
      }
      return all;
    },
    enabled: tournaments.length > 0,
  });

  // --- Мапы для быстрого доступа к именам ---
  const teamMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) map.set(t.id, t.name);
    return map;
  }, [teams]);

  const cityMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cities) map.set(c.id, c.name);
    return map;
  }, [cities]);

  const tournamentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tournaments) map.set(t.id, t.name);
    return map;
  }, [tournaments]);

  const stageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allStages) map.set(s.id, s.name);
    return map;
  }, [allStages]);

  // --- Этапы для фильтра (отфильтрованные по выбранному турниру) ---
  const filterStages = useMemo(() => {
    if (!tournamentFilter) return [];
    return allStages.filter((s) => s.tournamentId === tournamentFilter);
  }, [allStages, tournamentFilter]);

  // --- Этапы для формы создания ---
  const formStages = useMemo(() => {
    if (!formTournamentId) return [];
    return allStages.filter((s) => s.tournamentId === formTournamentId);
  }, [allStages, formTournamentId]);

  // --- Извлечение ошибок полей ---
  const extractFieldErrors = (err: unknown): FieldErrors => {
    const errors: FieldErrors = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const invalidParams = err.response.data.invalid_params as InvalidParam[];
      for (const param of invalidParams) {
        const firstError = param.errors[0];
        if (firstError && param.name in defaultForm) {
          errors[param.name as keyof FieldErrors] = firstError.reason;
        }
      }
    }
    return errors;
  };

  // --- Мутации ---

  const createMutation = useMutation({
    mutationFn: ({
      stageId,
      data,
    }: {
      stageId: string;
      data: CreateMatchDto;
    }) => matchApi.create(stageId, data),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Матч создан', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultForm);
      setFormTournamentId('');
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['matches'] });
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
            ? err.response?.data?.message || 'Ошибка создания'
            : 'Неизвестная ошибка';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMatchDto }) =>
      matchApi.update(id, data),
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Матч обновлён',
        severity: 'success',
      });
      setEditDialogOpen(false);
      setEditingMatch(null);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['matches'] });
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
            ? err.response?.data?.message || 'Ошибка обновления'
            : 'Неизвестная ошибка';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => matchApi.remove(id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Матч удалён', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteMatchId(null);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message || 'Ошибка удаления'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // --- Обработчики ---

  const handleCreate = () => {
    if (!form.stageId) return;

    const payload: CreateMatchDto = {
      matchDate: datetimeLocalToIso(form.matchDate),
      cityId: form.cityId,
      tourNumber: form.tourNumber ? Number(form.tourNumber) : null,
      homeTeamId: form.homeTeamId || null,
      awayTeamId: form.awayTeamId || null,
    };
    createMutation.mutate({ stageId: form.stageId, data: payload });
  };

  const handleUpdate = () => {
    if (!editingMatch) return;

    const payload: UpdateMatchDto = {
      matchDate: datetimeLocalToIso(form.matchDate),
      cityId: form.cityId,
      tourNumber: form.tourNumber ? Number(form.tourNumber) : null,
      homeTeamId: form.homeTeamId || null,
      awayTeamId: form.awayTeamId || null,
      homeScore: form.homeScore !== '' ? Number(form.homeScore) : null,
      awayScore: form.awayScore !== '' ? Number(form.awayScore) : null,
    };
    updateMutation.mutate({ id: editingMatch.id, data: payload });
  };

  const handleEditOpen = (match: Match) => {
    setEditingMatch(match);
    setForm({
      stageId: match.stageId,
      matchDate: isoToDatetimeLocal(match.matchDate),
      cityId: match.cityId,
      tourNumber: match.tourNumber !== null ? String(match.tourNumber) : '',
      homeTeamId: match.homeTeamId ?? '',
      awayTeamId: match.awayTeamId ?? '',
      homeScore: match.homeScore !== null ? String(match.homeScore) : '',
      awayScore: match.awayScore !== null ? String(match.awayScore) : '',
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteMatchId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteMatchId) deleteMutation.mutate(deleteMatchId);
  };

  const handleClearFilters = () => setSearchParams({});

  const handleFieldChange = (field: keyof MatchForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleOpenCreateDialog = () => {
    setForm({ ...defaultForm, stageId: stageFilter });
    setFormTournamentId(tournamentFilter);
    setFieldErrors({});
    setCreateDialogOpen(true);
  };

  const handleRowClick = (matchId: string) => {
    navigate(`/matches/${matchId}`, {
      state: { returnTo: `/matches?${searchParams}` },
    });
  };

  const nextPage = () => setOffset(offset + LIMIT);
  const prevPage = () => setOffset(Math.max(0, offset - LIMIT));

  const hasFilters = Boolean(
    tournamentFilter ||
      stageFilter ||
      teamFilter ||
      cityFilter ||
      dateFrom ||
      dateTo,
  );

  // ------------------------------------------------------------------
  // Рендер формы
  // ------------------------------------------------------------------

  const renderCreateForm = (isPending: boolean) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <TextField
        select
        label="Турнир *"
        value={formTournamentId}
        onChange={(e) => {
          setFormTournamentId(e.target.value);
          handleFieldChange('stageId', '');
        }}
        fullWidth
        required
        disabled={isPending}
      >
        <MenuItem value="">
          <em>Выберите турнир</em>
        </MenuItem>
        {tournaments.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.name} ({t.season})
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Этап *"
        value={form.stageId}
        onChange={(e) => handleFieldChange('stageId', e.target.value)}
        error={!!fieldErrors.stageId}
        helperText={
          fieldErrors.stageId || 'Матчи создаются в группе или раунде турнира'
        }
        fullWidth
        required
        disabled={isPending || !formTournamentId}
      >
        <MenuItem value="">
          <em>Выберите этап</em>
        </MenuItem>
        {formStages
          .filter((s) => s.type === 'GROUP' || s.type === 'ROUND')
          .map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
      </TextField>

      <TextField
        label="Дата и время"
        type="datetime-local"
        value={form.matchDate}
        onChange={(e) => handleFieldChange('matchDate', e.target.value)}
        error={!!fieldErrors.matchDate}
        helperText={fieldErrors.matchDate || 'Местное время вашего устройства'}
        fullWidth
        required
        disabled={isPending}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Autocomplete
        options={cities}
        value={cities.find((c) => c.id === form.cityId) ?? null}
        getOptionLabel={(city) => city.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, city) => handleFieldChange('cityId', city?.id ?? '')}
        noOptionsText="Город не найден"
        clearText="Сбросить"
        openText="Показать города"
        closeText="Закрыть"
        disabled={isPending}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Город"
            required
            error={!!fieldErrors.cityId}
            helperText={fieldErrors.cityId}
          />
        )}
      />

      <TextField
        label="Номер тура"
        type="number"
        value={form.tourNumber}
        onChange={(e) => handleFieldChange('tourNumber', e.target.value)}
        error={!!fieldErrors.tourNumber}
        helperText={
          fieldErrors.tourNumber ||
          'Только для кругового этапа. Для плей-офф — оставьте пустым'
        }
        fullWidth
        disabled={isPending}
        slotProps={{ htmlInput: { min: 1 } }}
      />

      <TextField
        select
        label="Хозяева"
        value={form.homeTeamId}
        onChange={(e) => handleFieldChange('homeTeamId', e.target.value)}
        error={!!fieldErrors.homeTeamId}
        helperText={fieldErrors.homeTeamId || 'Опционально — для плей-офф'}
        fullWidth
        disabled={isPending}
      >
        <MenuItem value="">
          <em>Не определена</em>
        </MenuItem>
        {teams.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Гости"
        value={form.awayTeamId}
        onChange={(e) => handleFieldChange('awayTeamId', e.target.value)}
        error={!!fieldErrors.awayTeamId}
        helperText={fieldErrors.awayTeamId || 'Опционально — для плей-офф'}
        fullWidth
        disabled={isPending}
      >
        <MenuItem value="">
          <em>Не определена</em>
        </MenuItem>
        {teams.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.name}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );

  const renderEditForm = (isPending: boolean) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Турнир и этап не изменяются. Для переноса матча — удалите и создайте
        заново.
      </Typography>

      <TextField
        label="Дата и время"
        type="datetime-local"
        value={form.matchDate}
        onChange={(e) => handleFieldChange('matchDate', e.target.value)}
        error={!!fieldErrors.matchDate}
        helperText={fieldErrors.matchDate || 'Местное время вашего устройства'}
        fullWidth
        required
        disabled={isPending}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Autocomplete
        options={cities}
        value={cities.find((c) => c.id === form.cityId) ?? null}
        getOptionLabel={(city) => city.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, city) => handleFieldChange('cityId', city?.id ?? '')}
        noOptionsText="Город не найден"
        clearText="Сбросить"
        openText="Показать города"
        closeText="Закрыть"
        disabled={isPending}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Город"
            required
            error={!!fieldErrors.cityId}
            helperText={fieldErrors.cityId}
          />
        )}
      />

      <TextField
        label="Номер тура"
        type="number"
        value={form.tourNumber}
        onChange={(e) => handleFieldChange('tourNumber', e.target.value)}
        error={!!fieldErrors.tourNumber}
        helperText={fieldErrors.tourNumber || ''}
        fullWidth
        disabled={isPending}
        slotProps={{ htmlInput: { min: 1 } }}
      />

      <TextField
        select
        label="Хозяева"
        value={form.homeTeamId}
        onChange={(e) => handleFieldChange('homeTeamId', e.target.value)}
        error={!!fieldErrors.homeTeamId}
        helperText={fieldErrors.homeTeamId || 'Опционально'}
        fullWidth
        disabled={isPending}
      >
        <MenuItem value="">
          <em>Не определена</em>
        </MenuItem>
        {teams.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Гости"
        value={form.awayTeamId}
        onChange={(e) => handleFieldChange('awayTeamId', e.target.value)}
        error={!!fieldErrors.awayTeamId}
        helperText={fieldErrors.awayTeamId || 'Опционально'}
        fullWidth
        disabled={isPending}
      >
        <MenuItem value="">
          <em>Не определена</em>
        </MenuItem>
        {teams.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Голы хозяев"
        type="number"
        value={form.homeScore}
        onChange={(e) => handleFieldChange('homeScore', e.target.value)}
        error={!!fieldErrors.homeScore}
        helperText={
          fieldErrors.homeScore || 'Оставьте пустым, если матч не сыгран'
        }
        fullWidth
        disabled={isPending}
        slotProps={{ htmlInput: { min: 0 } }}
      />

      <TextField
        label="Голы гостей"
        type="number"
        value={form.awayScore}
        onChange={(e) => handleFieldChange('awayScore', e.target.value)}
        error={!!fieldErrors.awayScore}
        helperText={
          fieldErrors.awayScore || 'Оставьте пустым, если матч не сыгран'
        }
        fullWidth
        disabled={isPending}
        slotProps={{ htmlInput: { min: 0 } }}
      />
    </Box>
  );

  // ------------------------------------------------------------------
  // Рендер
  // ------------------------------------------------------------------

  return (
    <Box sx={competitionPageSx}>
      <CompetitionHeader
        title="Матчи"
        description="Календарь матчей, результаты и переход к судейской бригаде."
        action={
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
          >
            Создать матч
          </Button>
        }
      />

      <CompetitionSummary
        items={[
          {
            label: 'Матчей по выбранным условиям',
            value: isLoading ? '—' : total,
          },
          {
            label: 'Матчей на странице',
            value: isLoading ? '—' : matches.length,
          },
        ]}
      />
      {rangeError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {rangeError}
        </Alert>
      )}
      {/* Панель фильтров */}
      <CompetitionFilters active={hasFilters}>
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
            select
            size="small"
            label="Турнир"
            value={tournamentFilter}
            onChange={(e) => {
              setTournamentFilter(e.target.value);
            }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">
              <em>Все турниры</em>
            </MenuItem>
            {tournaments.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Этап"
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
            }}
            disabled={!tournamentFilter}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">
              <em>Все этапы</em>
            </MenuItem>
            {filterStages.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Команда"
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">
              <em>Все команды</em>
            </MenuItem>
            {teams.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Город"
            value={cityFilter}
            onChange={(e) => {
              setCityFilter(e.target.value);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">
              <em>Все города</em>
            </MenuItem>
            {cities.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="С"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />

          <TextField
            size="small"
            label="По"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />

          {hasFilters && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
            >
              Сбросить
            </Button>
          )}

          <Button
            variant="text"
            onClick={() => refetch()}
            disabled={isFetching || Boolean(rangeError)}
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
      </CompetitionFilters>

      {/* Таблица */}
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error instanceof AxiosError
              ? error.response?.data?.message || 'Не удалось загрузить матчи'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : matches.length === 0 && !isLoading ? (
          <CompetitionEmpty
            title={hasFilters ? 'Матчи не найдены' : 'Календарь пока пуст'}
            description={
              hasFilters
                ? 'Измените условия поиска или сбросьте фильтры.'
                : 'Создайте матч в игровом этапе турнира, затем назначьте судейскую бригаду.'
            }
            action={hasFilters ? 'Сбросить фильтры' : 'Создать матч'}
            onAction={hasFilters ? handleClearFilters : handleOpenCreateDialog}
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Дата и время</TableCell>
                    <TableCell>Турнир / Этап</TableCell>
                    <TableCell>Хозяева</TableCell>
                    <TableCell align="center">Счёт</TableCell>
                    <TableCell>Гости</TableCell>
                    <TableCell>Город</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matches.map((m) => (
                    <TableRow
                      key={m.id}
                      hover
                      onClick={() => handleRowClick(m.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell data-label="Дата и время">
                        {formatMatchDate(m.matchDate)}
                      </TableCell>
                      <TableCell data-label="Турнир / этап">
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                          }}
                        >
                          <Typography variant="body2">
                            {tournamentMap.get(m.tournamentId) ?? '—'}
                          </Typography>
                          <Chip
                            label={stageMap.get(m.stageId) ?? '—'}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </TableCell>
                      <TableCell data-label="Хозяева">
                        {m.homeTeamId
                          ? (teamMap.get(m.homeTeamId) ?? '—')
                          : '—'}
                      </TableCell>
                      <TableCell data-label="Счёт" align="center">
                        {m.homeScore !== null && m.awayScore !== null ? (
                          <Typography sx={{ fontWeight: 600 }}>
                            {m.homeScore} : {m.awayScore}
                          </Typography>
                        ) : (
                          <Typography color="text.secondary">— : —</Typography>
                        )}
                      </TableCell>
                      <TableCell data-label="Гости">
                        {m.awayTeamId
                          ? (teamMap.get(m.awayTeamId) ?? '—')
                          : '—'}
                      </TableCell>
                      <TableCell data-label="Город">
                        {cityMap.get(m.cityId) ?? '—'}
                      </TableCell>
                      <TableCell
                        data-label="Действия"
                        align="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleRowClick(m.id)}
                          >
                            Бригада
                          </Button>
                          <Tooltip title="Редактировать">
                            <IconButton
                              aria-label="Редактировать"
                              size="small"
                              onClick={() => handleEditOpen(m)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              aria-label="Удалить"
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(m.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
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
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Всего: {total} матчей. Показано с {total ? offset + 1 : 0} по{' '}
                {Math.min(offset + LIMIT, total)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={prevPage}
                  disabled={offset === 0 || isFetching}
                  variant="outlined"
                  size="small"
                >
                  Назад
                </Button>
                <Button
                  onClick={nextPage}
                  disabled={offset + LIMIT >= total || isFetching}
                  variant="outlined"
                  size="small"
                >
                  Вперёд
                </Button>
              </Box>
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

      {/* Диалог создания */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Создание матча</DialogTitle>
        <DialogContent>
          {renderCreateForm(createMutation.isPending)}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            disabled={createMutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={
              createMutation.isPending ||
              !form.stageId ||
              !form.matchDate ||
              !form.cityId
            }
          >
            {createMutation.isPending ? (
              <CircularProgress size={24} />
            ) : (
              'Создать'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Редактирование матча</DialogTitle>
        <DialogContent>
          {renderEditForm(updateMutation.isPending)}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditDialogOpen(false)}
            disabled={updateMutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={handleUpdate}
            variant="contained"
            disabled={
              updateMutation.isPending || !form.matchDate || !form.cityId
            }
          >
            {updateMutation.isPending ? (
              <CircularProgress size={24} />
            ) : (
              'Сохранить'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить этот матч? Действие необратимо.
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
            onClick={handleDeleteConfirm}
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
