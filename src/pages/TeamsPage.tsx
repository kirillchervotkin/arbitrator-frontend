// src/pages/schedule/TeamsPage.tsx

import { useState, useEffect, useRef, useMemo } from 'react';
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
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { teamApi, cityApi } from '../services/api';
import {
  Team,
  City,
  CreateTeamDto,
  UpdateTeamDto,
  InvalidParam,
} from '../types';

// ------------------------------------------------------------------
// Форма
// ------------------------------------------------------------------

type TeamForm = {
  name: string;
  shortName: string;
  cityId: string; // '' = город не выбран
};

const defaultForm: TeamForm = {
  name: '',
  shortName: '',
  cityId: '',
};

type FieldErrors = {
  name?: string;
  shortName?: string;
  cityId?: string;
};

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function TeamsPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>(''); // '' = все города
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form, setForm] = useState<TeamForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Debounce поиска
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setQuerySearch(searchInput);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchInput]);

  // Запрос команд (без пагинации)
  const {
    data: teams = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<Team[]>({
    queryKey: ['teams', { search: querySearch || undefined, cityId: cityFilter || undefined }],
    queryFn: async () => {
      const res = await teamApi.getAll({
        search: querySearch || undefined,
        cityId: cityFilter || undefined,
        orderBy: 'name',
        orderDir: 'ASC',
      });
      return res.data;
    },
  });

  // Запрос городов один раз — для dropdown и для отображения cityName в таблице
  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ['cities'],
    queryFn: async () => {
      const res = await cityApi.getAll({ orderBy: 'name', orderDir: 'ASC' });
      return res.data;
    },
  });

  // Карта cityId → cityName, чтобы не делать N+1 запросов
  const cityMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cities) {
      map.set(c.id, c.name);
    }
    return map;
  }, [cities]);

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
    mutationFn: (payload: CreateTeamDto) => teamApi.create(payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Команда создана', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['teams'] });
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
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamDto }) =>
      teamApi.update(id, data),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Команда обновлена', severity: 'success' });
      setEditDialogOpen(false);
      setEditingTeam(null);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['teams'] });
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
    mutationFn: (id: string) => teamApi.remove(id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Команда удалена', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteTeamId(null);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ||
            'Невозможно удалить: команда участвует в матчах'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // --- Обработчики ---

  const handleCreate = () => {
    const payload: CreateTeamDto = {
      name: form.name.trim(),
      shortName: form.shortName.trim() || null,
      cityId: form.cityId || null,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editingTeam) return;
    const payload: UpdateTeamDto = {
      name: form.name.trim(),
      shortName: form.shortName.trim() || null,
      cityId: form.cityId || null,
    };
    updateMutation.mutate({ id: editingTeam.id, data: payload });
  };

  const handleEditOpen = (team: Team) => {
    setEditingTeam(team);
    setForm({
      name: team.name,
      shortName: team.shortName ?? '',
      cityId: team.cityId ?? '',
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTeamId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteTeamId) deleteMutation.mutate(deleteTeamId);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setQuerySearch('');
    setCityFilter('');
  };

  const handleFieldChange = (field: keyof TeamForm, value: string) => {
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

  // --- Рендер диалога (общий для create / edit) ---

  const renderTeamDialog = (
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
            label="Короткое название"
            value={form.shortName}
            onChange={(e) => handleFieldChange('shortName', e.target.value)}
            error={!!fieldErrors.shortName}
            helperText={fieldErrors.shortName || 'Для UI-таблиц, например «ЗЕН»'}
            fullWidth
            disabled={isPending}
            autoComplete="off"
          />
          <TextField
            select
            label="Домашний город"
            value={form.cityId}
            onChange={(e) => handleFieldChange('cityId', e.target.value)}
            error={!!fieldErrors.cityId}
            helperText={fieldErrors.cityId || 'Опционально'}
            fullWidth
            disabled={isPending}
          >
            <MenuItem value="">
              <em>Не указан</em>
            </MenuItem>
            {cities.map((city) => (
              <MenuItem key={city.id} value={city.id}>
                {city.name}
                {city.region ? ` (${city.region})` : ''}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Отмена
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={isPending || !form.name.trim()}
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
        Команды
      </Typography>

      {/* Панель поиска и кнопок */}
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
          label="Город"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">
            <em>Все города</em>
          </MenuItem>
          {cities.map((city) => (
            <MenuItem key={city.id} value={city.id}>
              {city.name}
            </MenuItem>
          ))}
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
              ? error.response?.data?.message || 'Не удалось загрузить команды'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : teams.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {querySearch || cityFilter
                ? 'Ничего не найдено по фильтрам'
                : 'Команды не найдены. Создайте первую команду.'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Короткое</TableCell>
                    <TableCell>Домашний город</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id} hover>
                      <TableCell>{team.name}</TableCell>
                      <TableCell>{team.shortName || '—'}</TableCell>
                      <TableCell>
                        {team.cityId
                          ? cityMap.get(team.cityId) ?? '—'
                          : '—'}
                      </TableCell>
                      <TableCell align="center">
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Tooltip title="Редактировать">
                            <IconButton
                              size="small"
                              onClick={() => handleEditOpen(team)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(team.id)}
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
                Всего: {teams.length} команд
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
      {renderTeamDialog(
        createDialogOpen,
        () => setCreateDialogOpen(false),
        handleCreate,
        'Создание команды',
        'Создать',
        createMutation.isPending,
      )}

      {/* Диалог редактирования */}
      {renderTeamDialog(
        editDialogOpen,
        () => {
          setEditDialogOpen(false);
          setEditingTeam(null);
        },
        handleUpdate,
        'Редактирование команды',
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
            Вы уверены, что хотите удалить эту команду? Действие необратимо.
            Если команда участвует в матчах — удаление будет отклонено.
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
