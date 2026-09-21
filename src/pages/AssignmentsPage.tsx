// src/pages/AssignmentsPage.tsx

import { useState, useMemo } from 'react';
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
import { useNavigate } from 'react-router-dom';
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
  const [userFilter, setUserFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
    queryKey: [
      'assignments',
      {
        userId: userFilter || undefined,
        fieldRoleId: roleFilter || undefined,
        dateFrom: dateFrom
          ? new Date(`${dateFrom}T00:00:00`).toISOString()
          : undefined,
        dateTo: dateTo
          ? new Date(`${dateTo}T23:59:59`).toISOString()
          : undefined,
      },
    ],
    queryFn: async () => {
      const res = await assignmentApi.getAll({
        userId: userFilter || undefined,
        fieldRoleId: roleFilter || undefined,
        dateFrom: dateFrom
          ? new Date(`${dateFrom}T00:00:00`).toISOString()
          : undefined,
        dateTo: dateTo
          ? new Date(`${dateTo}T23:59:59`).toISOString()
          : undefined,
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

  const handleClearFilters = () => {
    setUserFilter('');
    setRoleFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleMatchClick = (matchId: string) => {
    navigate(`/matches/${matchId}`);
  };

  const hasFilters = Boolean(
    userFilter || roleFilter || dateFrom || dateTo,
  );

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
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Назначения
      </Typography>

      {/* Информация */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Глобальный отчёт по назначениям. Создание назначений — на странице
        матча. Здесь можно фильтровать и снимать назначения.
      </Alert>

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
          select
          size="small"
          label="Судья"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">
            <em>Все судьи</em>
          </MenuItem>
          {users.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {formatUserName(u)}
            </MenuItem>
          ))}
        </TextField>

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
                'Не удалось загрузить назначения'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : assignments.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {hasFilters
                ? 'Ничего не найдено по фильтрам'
                : 'Назначения не найдены. Назначьте судей на странице матча.'}
            </Typography>
          </Box>
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
                        <TableCell>{renderMatchCell(a.matchId)}</TableCell>
                        <TableCell>
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
                        <TableCell>
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
                                size="small"
                                color="primary"
                                onClick={() => handleMatchClick(a.matchId)}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Снять назначение">
                              <IconButton
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
            Вы уверены, что хотите снять это назначение? Судья будет убран
            из бригады матча.
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