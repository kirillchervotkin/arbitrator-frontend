// src/pages/schedule/CitiesPage.tsx

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
  Tooltip,
  InputAdornment,
  Backdrop,
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
import { cityApi } from '../services/api';
import {
  City,
  CreateCityDto,
  UpdateCityDto,
  InvalidParam,
} from '../types';

// ------------------------------------------------------------------
// Форма
// ------------------------------------------------------------------

type CityForm = {
  name: string;
  region: string;
};

const defaultForm: CityForm = {
  name: '',
  region: '',
};

type FieldErrors = {
  name?: string;
  region?: string;
};

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function CitiesPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [form, setForm] = useState<CityForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCityId, setDeleteCityId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Debounce поиска (автокомплит по имени)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setQuerySearch(searchInput);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchInput]);

  // Запрос городов (без пагинации).
  // Если задан search — бэкенд вернёт только совпадения по имени.
  // Если нет — все города, отсортированные по имени.
  const {
    data: cities = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<City[]>({
    queryKey: ['cities', { search: querySearch || undefined }],
    queryFn: async () => {
      const res = await cityApi.getAll({
        search: querySearch || undefined,
        orderBy: 'name',
        orderDir: 'ASC',
      });
      return res.data;
    },
  });

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
    mutationFn: (payload: CreateCityDto) => cityApi.create(payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Город создан', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['cities'] });
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
    mutationFn: ({ id, data }: { id: string; data: UpdateCityDto }) =>
      cityApi.update(id, data),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Город обновлён', severity: 'success' });
      setEditDialogOpen(false);
      setEditingCity(null);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['cities'] });
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
    mutationFn: (id: string) => cityApi.remove(id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Город удалён', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteCityId(null);
      queryClient.invalidateQueries({ queryKey: ['cities'] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ||
            'Невозможно удалить: город используется в матчах'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // --- Обработчики ---

  const handleCreate = () => {
    const payload: CreateCityDto = {
      name: form.name.trim(),
      region: form.region.trim() || null,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editingCity) return;
    const payload: UpdateCityDto = {
      name: form.name.trim(),
      region: form.region.trim() || null,
    };
    updateMutation.mutate({ id: editingCity.id, data: payload });
  };

  const handleEditOpen = (city: City) => {
    setEditingCity(city);
    setForm({
      name: city.name,
      region: city.region ?? '',
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteCityId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteCityId) deleteMutation.mutate(deleteCityId);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setQuerySearch('');
  };

  const handleFieldChange = (field: keyof CityForm, value: string) => {
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

  const renderCityDialog = (
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
            label="Регион"
            value={form.region}
            onChange={(e) => handleFieldChange('region', e.target.value)}
            error={!!fieldErrors.region}
            helperText={fieldErrors.region || 'Например: Московская область'}
            fullWidth
            disabled={isPending}
            autoComplete="off"
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
        Города
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
              ? error.response?.data?.message || 'Не удалось загрузить города'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : cities.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {querySearch
                ? 'Ничего не найдено по запросу'
                : 'Города не найдены. Создайте первый город.'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Регион</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cities.map((city) => (
                    <TableRow key={city.id} hover>
                      <TableCell>{city.name}</TableCell>
                      <TableCell>{city.region || '—'}</TableCell>
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
                              onClick={() => handleEditOpen(city)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(city.id)}
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
                Всего: {cities.length} городов
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
      {renderCityDialog(
        createDialogOpen,
        () => setCreateDialogOpen(false),
        handleCreate,
        'Создание города',
        'Создать',
        createMutation.isPending,
      )}

      {/* Диалог редактирования */}
      {renderCityDialog(
        editDialogOpen,
        () => {
          setEditDialogOpen(false);
          setEditingCity(null);
        },
        handleUpdate,
        'Редактирование города',
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
            Вы уверены, что хотите удалить этот город? Действие необратимо.
            Если город используется в матчах — удаление будет отклонено.
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
