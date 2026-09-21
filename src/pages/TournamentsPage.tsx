// src/pages/TournamentsPage.tsx

import { useState, useEffect, useRef } from 'react';
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
  InputAdornment,
  Backdrop,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { tournamentApi } from '../services/api';
import {
  Tournament,
  CreateTournamentDto,
  UpdateTournamentDto,
  TournamentType,
  InvalidParam,
} from '../types';

// ------------------------------------------------------------------
// Справочники отображения
// ------------------------------------------------------------------

const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  LEAGUE: 'Чемпионат',
  CUP: 'Кубок',
  SUPER_CUP: 'Суперкубок',
};

const TOURNAMENT_TYPE_COLORS: Record<
  TournamentType,
  'primary' | 'secondary' | 'warning'
> = {
  LEAGUE: 'primary',
  CUP: 'secondary',
  SUPER_CUP: 'warning',
};

// ------------------------------------------------------------------
// Форма
// ------------------------------------------------------------------

type TournamentForm = {
  name: string;
  season: string;
  type: TournamentType;
  startDate: string; // 'YYYY-MM-DD' или ''
  endDate: string;
};

const defaultForm: TournamentForm = {
  name: '',
  season: '',
  type: 'LEAGUE',
  startDate: '',
  endDate: '',
};

type FieldErrors = {
  name?: string;
  season?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
};

// ------------------------------------------------------------------
// Хелперы для дат
// ------------------------------------------------------------------

/**
 * ISO-строка (из бэкенда) → 'YYYY-MM-DD' (для input[type=date]).
 * Возвращает '' для null / undefined / некорректной даты.
 */
function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function TournamentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [queryName, setQueryName] = useState('');
  const [typeFilter, setTypeFilter] = useState<TournamentType | ''>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [form, setForm] = useState<TournamentForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTournamentId, setDeleteTournamentId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Debounce поиска по имени
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setQueryName(searchInput);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchInput]);

  // Запрос турниров (без пагинации)
  const {
    data: tournaments = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<Tournament[]>({
    queryKey: ['tournaments', { type: typeFilter || undefined }],
    queryFn: () =>
      tournamentApi
        .getAll({
          type: typeFilter || undefined,
          orderBy: 'season',
          orderDir: 'DESC',
        })
        .then((res) => res.data),
  });

  // Клиентский фильтр по имени (бэкенд не ищет по name — только season и type)
  const visibleTournaments = queryName
    ? tournaments.filter((t) =>
        t.name.toLowerCase().includes(queryName.toLowerCase()),
      )
    : tournaments;

  // Извлечение ошибок полей
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
    mutationFn: (payload: CreateTournamentDto) => tournamentApi.create(payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Турнир создан', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
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
    mutationFn: ({ id, data }: { id: string; data: UpdateTournamentDto }) =>
      tournamentApi.update(id, data),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Турнир обновлён', severity: 'success' });
      setEditDialogOpen(false);
      setEditingTournament(null);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
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
    mutationFn: (id: string) => tournamentApi.remove(id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Турнир удалён', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteTournamentId(null);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ||
            'Невозможно удалить: у турнира есть этапы'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // --- Обработчики ---

  const handleCreate = () => {
    const payload: CreateTournamentDto = {
      name: form.name.trim(),
      season: form.season.trim(),
      type: form.type,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editingTournament) return;
    const payload: UpdateTournamentDto = {
      name: form.name.trim(),
      season: form.season.trim(),
      type: form.type,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    updateMutation.mutate({ id: editingTournament.id, data: payload });
  };

  const handleEditOpen = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setForm({
      name: tournament.name,
      season: tournament.season,
      type: tournament.type,
      startDate: isoToDateInput(tournament.startDate),
      endDate: isoToDateInput(tournament.endDate),
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTournamentId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteTournamentId) deleteMutation.mutate(deleteTournamentId);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setQueryName('');
    setTypeFilter('');
  };

  const handleFieldChange = (
    field: keyof TournamentForm,
    value: string | TournamentType,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleOpenCreateDialog = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setCreateDialogOpen(true);
  };

  const handleRowClick = (tournamentId: string) => {
    navigate(`/tournaments/${tournamentId}/stages`);
  };

  // --- Рендер диалога (общий для create / edit) ---

  const renderTournamentDialog = (
    open: boolean,
    onClose: () => void,
    onSubmit: () => void,
    title: string,
    submitLabel: string,
    isPending: boolean,
  ) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Название *"
            value={form.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name || ''}
            fullWidth
            required
            disabled={isPending}
            autoComplete="off"
          />
          <TextField
            label="Сезон *"
            value={form.season}
            onChange={(e) => handleFieldChange('season', e.target.value)}
            error={!!fieldErrors.season}
            helperText={fieldErrors.season || 'Например: 2023/24'}
            fullWidth
            required
            disabled={isPending}
            autoComplete="off"
          />
          <TextField
            select
            label="Тип *"
            value={form.type}
            onChange={(e) => handleFieldChange('type', e.target.value as TournamentType)}
            error={!!fieldErrors.type}
            helperText={fieldErrors.type || ''}
            fullWidth
            required
            disabled={isPending}
          >
            <MenuItem value="LEAGUE">Чемпионат</MenuItem>
            <MenuItem value="CUP">Кубок</MenuItem>
            <MenuItem value="SUPER_CUP">Суперкубок</MenuItem>
          </TextField>
          <TextField
            label="Дата начала"
            type="date"
            value={form.startDate}
            onChange={(e) => handleFieldChange('startDate', e.target.value)}
            error={!!fieldErrors.startDate}
            helperText={fieldErrors.startDate || ''}
            fullWidth
            disabled={isPending}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Дата окончания"
            type="date"
            value={form.endDate}
            onChange={(e) => handleFieldChange('endDate', e.target.value)}
            error={!!fieldErrors.endDate}
            helperText={fieldErrors.endDate || ''}
            fullWidth
            disabled={isPending}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Отмена
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={isPending || !form.name || !form.season}
        >
          {isPending ? <CircularProgress size={24} /> : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ------------------------------------------------------------------
  // Рендер
  // ------------------------------------------------------------------

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Турниры
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
          size="small"
          placeholder="Поиск по названию..."
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
                  <IconButton size="small" onClick={handleClearSearch}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label="Тип"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TournamentType | '')}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Все типы</MenuItem>
          <MenuItem value="LEAGUE">Чемпионат</MenuItem>
          <MenuItem value="CUP">Кубок</MenuItem>
          <MenuItem value="SUPER_CUP">Суперкубок</MenuItem>
        </TextField>
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
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
        >
          Создать
        </Button>
      </Paper>

      {/* Таблица */}
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error instanceof AxiosError
              ? error.response?.data?.message ||
                'Не удалось загрузить турниры'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : visibleTournaments.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {searchInput || typeFilter
                ? 'Ничего не найдено по фильтрам'
                : 'Турниры не найдены. Создайте первый турнир.'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Сезон</TableCell>
                    <TableCell>Тип</TableCell>
                    <TableCell>Дата начала</TableCell>
                    <TableCell>Дата окончания</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleTournaments.map((t) => (
                    <TableRow
                      key={t.id}
                      hover
                      onClick={() => handleRowClick(t.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.season}</TableCell>
                      <TableCell>
                        <Chip
                          label={TOURNAMENT_TYPE_LABELS[t.type]}
                          color={TOURNAMENT_TYPE_COLORS[t.type]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {t.startDate
                          ? new Date(t.startDate).toLocaleDateString('ru-RU')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {t.endDate
                          ? new Date(t.endDate).toLocaleDateString('ru-RU')
                          : '—'}
                      </TableCell>
                      <TableCell
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
                          <Tooltip title="Этапы">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleRowClick(t.id)}
                            >
                              <EventIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Редактировать">
                            <IconButton
                              size="small"
                              onClick={() => handleEditOpen(t)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(t.id)}
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
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Всего: {visibleTournaments.length}
                {queryName && ` из ${tournaments.length}`} турниров
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

      {/* Диалог создания */}
      {renderTournamentDialog(
        createDialogOpen,
        () => setCreateDialogOpen(false),
        handleCreate,
        'Создание турнира',
        'Создать',
        createMutation.isPending,
      )}

      {/* Диалог редактирования */}
      {renderTournamentDialog(
        editDialogOpen,
        () => {
          setEditDialogOpen(false);
          setEditingTournament(null);
        },
        handleUpdate,
        'Редактирование турнира',
        'Сохранить',
        updateMutation.isPending,
      )}

      {/* Диалог удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить этот турнир? Действие необратимо.
            Если у турнира есть этапы — удаление будет отклонено.
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
