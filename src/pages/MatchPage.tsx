import { competitionPageSx } from '../components/competition/competitionStyles';
import { CompetitionEmpty } from '../components/competition/CompetitionPage';
// src/pages/MatchPage.tsx

import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
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
  TextField,
  Divider,
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  SportsSoccer as SportsSoccerIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  matchApi,
  assignmentApi,
  fieldRoleApi,
  userApi,
} from '../services/api';
import {
  MatchCrew,
  AssignmentWithDetails,
  FieldRole,
  User,
  CreateAssignmentDto,
  InvalidParam,
} from '../types';

// ------------------------------------------------------------------
// Утилиты
// ------------------------------------------------------------------

function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUserName(user: User): string {
  const parts = [user.lastName, user.firstName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.email;
}

// ------------------------------------------------------------------
// Диалог добавления назначения
// ------------------------------------------------------------------

type CreateAssignmentForm = {
  userId: string;
  fieldRoleId: string;
};

const defaultAssignmentForm: CreateAssignmentForm = {
  userId: '',
  fieldRoleId: '',
};

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo =
    typeof location.state?.returnTo === 'string' &&
    /^\/(matches|assignments)\?/.test(location.state.returnTo)
      ? location.state.returnTo
      : '/matches';
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateAssignmentForm>(defaultAssignmentForm);
  const [fieldErrors, setFieldErrors] = useState<{
    userId?: string;
    fieldRoleId?: string;
  }>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(
    null,
  );

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // --- Запрос матча с бригадой ---
  const {
    data: crew,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<MatchCrew>({
    queryKey: ['match-crew', matchId],
    queryFn: async () => {
      const res = await matchApi.getCrew(matchId!);
      return res.data;
    },
    enabled: !!matchId,
  });

  // --- Справочники для формы ---
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const res = await userApi.getUsers({ limit: 1000 });
      return res.data.rows;
    },
  });

  const { data: fieldRoles = [] } = useQuery<FieldRole[]>({
    queryKey: ['field-roles'],
    queryFn: async () => {
      const res = await fieldRoleApi.getAll({
        orderBy: 'sortOrder',
        orderDir: 'ASC',
      });
      return res.data;
    },
  });

  // Фильтр пользователей: только активные
  const activeUsers = useMemo(() => users.filter((u) => u.isActive), [users]);

  // --- Извлечение ошибок полей ---
  const extractFieldErrors = (
    err: unknown,
  ): {
    userId?: string;
    fieldRoleId?: string;
  } => {
    const errors: { userId?: string; fieldRoleId?: string } = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const invalidParams = err.response.data.invalid_params as InvalidParam[];
      for (const param of invalidParams) {
        const firstError = param.errors[0];
        if (firstError && param.name in defaultAssignmentForm) {
          errors[param.name as 'userId' | 'fieldRoleId'] = firstError.reason;
        }
      }
    }
    return errors;
  };

  // --- Мутации ---

  const createMutation = useMutation({
    mutationFn: (payload: CreateAssignmentDto) =>
      assignmentApi.create(matchId!, payload),
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Судья назначен',
        severity: 'success',
      });
      setCreateDialogOpen(false);
      setForm(defaultAssignmentForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['match-crew', matchId] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
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
        // Особый случай: 409 может означать "дубликат" или "два матча в день"
        let msg: string;
        if (err instanceof AxiosError && err.response?.status === 409) {
          msg =
            err.response.data?.message ||
            'Судья уже назначен на этот матч или на другой матч в тот же день';
        } else if (err instanceof AxiosError) {
          msg = err.response?.data?.message || 'Ошибка создания назначения';
        } else {
          msg = 'Неизвестная ошибка';
        }
        setSnackbar({ open: true, message: msg, severity: 'error' });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assignmentApi.remove(id),
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Назначение снято',
        severity: 'success',
      });
      setDeleteDialogOpen(false);
      setDeleteAssignmentId(null);
      queryClient.invalidateQueries({ queryKey: ['match-crew', matchId] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
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

  const handleOpenCreateDialog = () => {
    setForm(defaultAssignmentForm);
    setFieldErrors({});
    setCreateDialogOpen(true);
  };

  const handleCreate = () => {
    if (!form.userId || !form.fieldRoleId) return;
    createMutation.mutate({
      userId: form.userId,
      fieldRoleId: form.fieldRoleId,
    });
  };

  const handleDeleteClick = (id: string) => {
    setDeleteAssignmentId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteAssignmentId) deleteMutation.mutate(deleteAssignmentId);
  };

  // ------------------------------------------------------------------
  // Состояния загрузки / ошибки
  // ------------------------------------------------------------------

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !crew) {
    return (
      <Box sx={competitionPageSx}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Повторить
            </Button>
          }
        >
          {error instanceof AxiosError
            ? error.response?.data?.message || 'Не удалось загрузить матч'
            : 'Произошла неизвестная ошибка'}
        </Alert>
        <Button
          sx={{ mt: 2 }}
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(returnTo)}
        >
          Назад
        </Button>
      </Box>
    );
  }

  const hasScore = crew.homeScore !== null && crew.awayScore !== null;

  // ------------------------------------------------------------------
  // Рендер
  // ------------------------------------------------------------------

  return (
    <Box sx={competitionPageSx}>
      {/* Шапка */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <IconButton
          aria-label={
            returnTo.startsWith('/assignments')
              ? 'К списку назначений'
              : 'К списку матчей'
          }
          onClick={() => navigate(returnTo)}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Матч
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {crew.stageName}
            {crew.tourNumber !== null && ` • Тур ${crew.tourNumber}`}
          </Typography>
        </Box>

        <Tooltip title="Обновить">
          <span>
            <IconButton
              aria-label="Обновить матч"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Карточка матча */}
      <Paper sx={{ p: 3, mb: 3 }}>
        {/* Дата и город */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            mb: 3,
            color: 'text.secondary',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarIcon fontSize="small" />
            <Typography variant="body2">
              {formatMatchDate(crew.matchDate)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LocationIcon fontSize="small" />
            <Typography variant="body2">{crew.cityName}</Typography>
          </Box>
        </Box>

        {/* Команды и счёт */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          {/* Хозяева */}
          <Box
            sx={{
              flex: 1,
              textAlign: { xs: 'center', sm: 'right' },
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, fontSize: { xs: 16, sm: 20 } }}
            >
              {crew.homeTeamName ?? 'Не определена'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Хозяева
            </Typography>
          </Box>

          {/* Счёт */}
          <Box
            sx={{
              px: { xs: 1, sm: 3 },
              py: 1.5,
              borderRadius: '12px',
              bgcolor: hasScore ? 'primary.main' : 'action.hover',
              color: hasScore ? 'primary.contrastText' : 'text.secondary',
              minWidth: { xs: 64, sm: 100 },
              textAlign: 'center',
            }}
          >
            {hasScore ? (
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {crew.homeScore} : {crew.awayScore}
              </Typography>
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                — : —
              </Typography>
            )}
          </Box>

          {/* Гости */}
          <Box
            sx={{
              flex: 1,
              textAlign: { xs: 'center', sm: 'left' },
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, fontSize: { xs: 16, sm: 20 } }}
            >
              {crew.awayTeamName ?? 'Не определена'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Гости
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Бригада */}
      <Paper sx={{ p: 3, position: 'relative' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <SportsSoccerIcon />
            Судейская бригада <Chip size="small" label={crew.crew.length} />
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
            disabled={createMutation.isPending}
          >
            Назначить судью
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {crew.crew.length === 0 ? (
          <CompetitionEmpty
            title="Бригада ещё не назначена"
            description="Выберите судью и его роль на этом матче."
            action="Назначить первого судью"
            onAction={handleOpenCreateDialog}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {crew.crew.map((a: AssignmentWithDetails) => {
              return (
                <Paper
                  key={a.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                  }}
                >
                  <Chip
                    label={a.roleName}
                    color="primary"
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 140, width: { xs: '100%', sm: 'auto' } }}
                  />

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {a.userLastName} {a.userFirstName}
                    </Typography>
                  </Box>

                  <Tooltip title="Снять назначение">
                    <IconButton
                      aria-label="Снять назначение"
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(a.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Paper>
              );
            })}
          </Box>
        )}

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
          open={isFetching && !isLoading}
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            Обновление...
          </Typography>
        </Backdrop>
      </Paper>

      {/* Диалог добавления назначения */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Назначить судью на матч</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {crew.homeTeamName ?? 'Хозяева не определены'} —{' '}
              {crew.awayTeamName ?? 'Гости не определены'} ·{' '}
              {formatMatchDate(crew.matchDate)}
            </Typography>
            <Autocomplete
              options={activeUsers.filter(
                (u) => !crew.crew.some((a) => a.userId === u.id),
              )}
              value={activeUsers.find((u) => u.id === form.userId) ?? null}
              getOptionLabel={formatUserName}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, user) => {
                setForm({ ...form, userId: user?.id ?? '' });
                setFieldErrors({ ...fieldErrors, userId: undefined });
              }}
              noOptionsText="Нет доступных судей"
              clearText="Сбросить"
              openText="Показать судей"
              closeText="Закрыть"
              disabled={createMutation.isPending}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Судья"
                  placeholder="Введите имя или фамилию"
                  required
                  error={!!fieldErrors.userId}
                  helperText={
                    fieldErrors.userId ||
                    'Уже назначенные на этот матч судьи скрыты'
                  }
                />
              )}
            />

            <TextField
              select
              label="Роль *"
              value={form.fieldRoleId}
              onChange={(e) => {
                setForm({ ...form, fieldRoleId: e.target.value });
                if (fieldErrors.fieldRoleId) {
                  setFieldErrors({
                    ...fieldErrors,
                    fieldRoleId: undefined,
                  });
                }
              }}
              error={!!fieldErrors.fieldRoleId}
              helperText={fieldErrors.fieldRoleId || ''}
              fullWidth
              required
              disabled={createMutation.isPending}
            >
              <MenuItem value="">
                <em>Выберите роль</em>
              </MenuItem>
              {fieldRoles.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>

            <Alert severity="info" variant="outlined">
              На один день судье можно назначить только один матч. При
              совпадении дат вы увидите причину конфликта.
            </Alert>
          </Box>
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
              createMutation.isPending || !form.userId || !form.fieldRoleId
            }
          >
            {createMutation.isPending ? (
              <CircularProgress size={24} />
            ) : (
              'Назначить'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог удаления назначения */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Снять назначение</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите снять это назначение? Судья будет убран из
            бригады матча.
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
              'Снять'
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
