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
// src/pages/AssignmentsPage.tsx

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
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import {
  assignmentApi,
  userApi,
  fieldRoleApi,
  matchApi,
  teamApi,
} from '../services/api';
import {
  Assignment,
  User,
  FieldRole,
  Match,
  Team,
  PaginatedResponse,
} from '../types';

// ------------------------------------------------------------------
// Утилиты
// ------------------------------------------------------------------

function formatUserName(user: User): string {
  const parts = [user.lastName, user.firstName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.email;
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

export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // --- Фильтры ---
  const [searchParams, setSearchParams] = useSearchParams();
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };
  const userFilter = searchParams.get('userId') ?? '';
  const roleFilter = searchParams.get('fieldRoleId') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const setUserFilter = (value: string) => updateFilter('userId', value);
  const setRoleFilter = (value: string) => updateFilter('fieldRoleId', value);
  const setDateFrom = (value: string) => updateFilter('dateFrom', value);
  const setDateTo = (value: string) => updateFilter('dateTo', value);

  const rangeError = calendarRangeError(dateFrom, dateTo);

  // --- Удаление ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(
    null,
  );

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

  // --- Запрос назначений ---
  const {
    data: assignments = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<Assignment[]>({
    enabled: !rangeError,
    queryKey: [
      'assignments',
      {
        userId: userFilter || undefined,
        fieldRoleId: roleFilter || undefined,
        dateFrom: calendarDayBoundary(dateFrom),
        dateTo: calendarDayBoundary(dateTo, true),
      },
    ],
    queryFn: async () => {
      const res = await assignmentApi.getAll({
        userId: userFilter || undefined,
        fieldRoleId: roleFilter || undefined,
        dateFrom: calendarDayBoundary(dateFrom),
        dateTo: calendarDayBoundary(dateTo, true),
        orderDir: 'DESC',
      });
      return res.data;
    },
  });

  // --- Справочники ---
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-for-assignments'],
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

  // Матчи — грузим с большим лимитом, чтобы построить мапу для отображения.
  // Матчей в системе тысячи, но обычно в отчёте нужно несколько десятков.
  const { data: matchesData } = useQuery<PaginatedResponse<Match>>({
    queryKey: ['matches-for-assignments'],
    queryFn: async () => {
      const res = await matchApi.getAll({ limit: 2000, offset: 0 });
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

  // --- Мапы ---
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const roleMap = useMemo(() => {
    const map = new Map<string, FieldRole>();
    for (const r of fieldRoles) map.set(r.id, r);
    return map;
  }, [fieldRoles]);

  const matchMap = useMemo(() => {
    const map = new Map<string, Match>();
    const rows = matchesData?.rows ?? [];
    for (const m of rows) map.set(m.id, m);
    return map;
  }, [matchesData]);

  const teamMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) map.set(t.id, t.name);
    return map;
  }, [teams]);

  // --- Мутации ---
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
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      // Инвалидируем crew всех матчей — на всякий случай
      queryClient.invalidateQueries({ queryKey: ['match-crew'] });
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
  const handleDeleteClick = (id: string) => {
    setDeleteAssignmentId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteAssignmentId) deleteMutation.mutate(deleteAssignmentId);
  };

  const handleClearFilters = () => setSearchParams({});

  const handleMatchClick = (matchId: string) => {
    navigate(`/matches/${matchId}`, {
      state: { returnTo: `/assignments?${searchParams}` },
    });
  };

  const hasFilters = Boolean(userFilter || roleFilter || dateFrom || dateTo);

  // ------------------------------------------------------------------
  // Рендер строки "матч"
  // ------------------------------------------------------------------

  const renderMatchCell = (matchId: string) => {
    const m = matchMap.get(matchId);

    if (!m) {
      // Матч не попал в первые 2000 — показываем короткий ID
      return (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontFamily: 'monospace' }}
        >
          #{matchId.slice(0, 8)}
        </Typography>
      );
    }

    const homeName = m.homeTeamId ? teamMap.get(m.homeTeamId) : null;
    const awayName = m.awayTeamId ? teamMap.get(m.awayTeamId) : null;

    let label: string;
    if (homeName && awayName) {
      label = `${homeName} — ${awayName}`;
    } else if (homeName) {
      label = `${homeName} — ?`;
    } else if (awayName) {
      label = `? — ${awayName}`;
    } else {
      label = 'Участники не определены';
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {formatMatchDate(m.matchDate)}
        </Typography>
      </Box>
    );
  };

  // ------------------------------------------------------------------
  // Рендер
  // ------------------------------------------------------------------

  return (
    <Box sx={competitionPageSx}>
      <CompetitionHeader
        title="Назначения"
        description="Судьи, роли и матчи — все назначения в одном месте."
        action={
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate('/matches')}
          >
            Выбрать матч для назначения
          </Button>
        }
      />

      <CompetitionSummary
        items={[
          {
            label: 'Назначений в выборке',
            value: isLoading ? '—' : assignments.length,
          },
          {
            label: 'Судей',
            value: isLoading
              ? '—'
              : new Set(assignments.map((a) => a.userId)).size,
          },
          {
            label: 'Матчей',
            value: isLoading
              ? '—'
              : new Set(assignments.map((a) => a.matchId)).size,
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
          <Autocomplete
            options={users}
            value={users.find((u) => u.id === userFilter) ?? null}
            getOptionLabel={formatUserName}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, user) => setUserFilter(user?.id ?? '')}
            noOptionsText="Судьи не найдены"
            clearText="Сбросить"
            openText="Показать судей"
            closeText="Закрыть"
            sx={{ flex: '1 1 240px', minWidth: 0 }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Судья"
                placeholder="Поиск по имени"
              />
            )}
          />

          <TextField
            select
            size="small"
            label="Роль"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">
              <em>Все роли</em>
            </MenuItem>
            {fieldRoles.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="С даты матча"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 170 }}
          />

          <TextField
            size="small"
            label="По дату матча"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 170 }}
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
              ? error.response?.data?.message ||
                'Не удалось загрузить назначения'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : assignments.length === 0 && !isLoading ? (
          <CompetitionEmpty
            title={
              hasFilters
                ? 'Назначений по этим условиям нет'
                : 'Назначений пока нет'
            }
            description={
              hasFilters
                ? 'Попробуйте другого судью, роль или период.'
                : 'Откройте матч и добавьте судей в его бригаду. Назначения появятся здесь.'
            }
            action={hasFilters ? 'Сбросить фильтры' : 'Выбрать матч'}
            onAction={
              hasFilters ? handleClearFilters : () => navigate('/matches')
            }
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Матч</TableCell>
                    <TableCell>Судья</TableCell>
                    <TableCell>Роль</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignments.map((a) => {
                    const user = userMap.get(a.userId);
                    const role = roleMap.get(a.fieldRoleId);

                    return (
                      <TableRow key={a.id} hover>
                        <TableCell data-label="Матч">
                          {renderMatchCell(a.matchId)}
                        </TableCell>
                        <TableCell data-label="Судья">
                          {user ? (
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.25,
                              }}
                            >
                              <Typography variant="body2">
                                {formatUserName(user)}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {user.email}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontFamily: 'monospace' }}
                            >
                              #{a.userId.slice(0, 8)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell data-label="Роль">
                          {role ? (
                            <Chip
                              label={role.name}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontFamily: 'monospace' }}
                            >
                              #{a.fieldRoleId.slice(0, 8)}
                            </Typography>
                          )}
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
                            <Tooltip title="Открыть матч">
                              <IconButton
                                aria-label="Открыть матч"
                                size="small"
                                color="primary"
                                onClick={() => handleMatchClick(a.matchId)}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
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
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Всего: {assignments.length} назначений
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

      {/* Диалог удаления */}
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
