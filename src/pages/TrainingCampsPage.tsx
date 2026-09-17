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
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { trainingCampApi } from '../services/api';
import { TrainingCamp, CreateTrainingCampDto, PaginatedResponse, InvalidParam } from '../types';
import { AxiosError } from 'axios';

type CampForm = Omit<CreateTrainingCampDto, 'isActive'> & { isActive: boolean };

const defaultForm: CampForm = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  location: '',
  isActive: true,
};

type FieldErrors = {
  name?: string;
  startDate?: string;
  endDate?: string;
};

const LIMIT = 10;

export default function TrainingCampsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [queryName, setQueryName] = useState('');
  const [queryLocation, setQueryLocation] = useState('');
  const [offset, setOffset] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCamp, setEditingCamp] = useState<TrainingCamp | null>(null);
  const [form, setForm] = useState<CampForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCampId, setDeleteCampId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setQueryName(searchInput);
      setOffset(0);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchInput]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<PaginatedResponse<TrainingCamp>>({
    queryKey: ['training-camps', { name: queryName, location: queryLocation, limit: LIMIT, offset }],
    queryFn: () =>
      trainingCampApi
        .getAll({
          limit: LIMIT,
          offset,
          name: queryName || undefined,
          location: queryLocation || undefined,
          orderBy: 'start_date',
          orderDir: 'ASC',
        })
        .then((res) => res.data),
  });

  const camps = data?.rows ?? [];
  const total = data?.total ?? 0;

  const extractFieldErrors = (err: unknown): FieldErrors => {
    const errors: FieldErrors = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const invalidParams = err.response.data.invalid_params as InvalidParam[];
      for (const param of invalidParams) {
        if (param.name === 'name') errors.name = param.errors[0]?.reason;
        if (param.name === 'startDate') errors.startDate = param.errors[0]?.reason;
        if (param.name === 'endDate') errors.endDate = param.errors[0]?.reason;
      }
    }
    return errors;
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateTrainingCampDto) => trainingCampApi.create(payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Сбор создан', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['training-camps'] });
    },
    onError: (err: unknown) => {
      const fe = extractFieldErrors(err);
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        setSnackbar({ open: true, message: 'Проверьте правильность заполнения полей', severity: 'error' });
      } else {
        const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка создания';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTrainingCampDto> }) =>
      trainingCampApi.update(id, data),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Сбор обновлён', severity: 'success' });
      setEditDialogOpen(false);
      setEditingCamp(null);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['training-camps'] });
    },
    onError: (err: unknown) => {
      const fe = extractFieldErrors(err);
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        setSnackbar({ open: true, message: 'Проверьте правильность заполнения полей', severity: 'error' });
      } else {
        const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка обновления';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trainingCampApi.delete(id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Сбор удалён', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteCampId(null);
      queryClient.invalidateQueries({ queryKey: ['training-camps'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка удаления';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const handleCreate = () => {
    const payload: CreateTrainingCampDto = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      location: form.location?.trim() || undefined,
      isActive: form.isActive,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editingCamp) return;
    const payload: Partial<CreateTrainingCampDto> = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      location: form.location?.trim() || undefined,
      isActive: form.isActive,
    };
    updateMutation.mutate({ id: editingCamp.id, data: payload });
  };

  const handleEditOpen = (camp: TrainingCamp) => {
    setEditingCamp(camp);
    setForm({
      name: camp.name,
      description: camp.description || '',
      startDate: camp.startDate,
      endDate: camp.endDate,
      location: camp.location || '',
      isActive: camp.isActive,
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteCampId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteCampId) deleteMutation.mutate(deleteCampId);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setQueryName('');
    setQueryLocation('');
    setOffset(0);
  };

  const nextPage = () => setOffset((prev) => Math.min(prev + LIMIT, total - LIMIT));
  const prevPage = () => setOffset((prev) => Math.max(0, prev - LIMIT));

  const handleRowClick = (campId: string) => {
    navigate(`/training-camps/${campId}/participants`);
  };

  const renderCampDialog = (
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
        <TextField
          label="Название*"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={!!fieldErrors.name}
          helperText={fieldErrors.name || ''}
          fullWidth
          margin="dense"
          disabled={isPending}
        />
        <TextField
          label="Описание"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          fullWidth
          multiline
          rows={2}
          margin="dense"
          disabled={isPending}
        />
        <TextField
          label="Дата начала"
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          error={!!fieldErrors.startDate}
          helperText={fieldErrors.startDate || ''}
          fullWidth
          margin="dense"
          disabled={isPending}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
        />
        <TextField
          label="Дата окончания"
          type="date"
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          error={!!fieldErrors.endDate}
          helperText={fieldErrors.endDate || ''}
          fullWidth
          margin="dense"
          disabled={isPending}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
        />
        <TextField
          label="Местоположение"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          fullWidth
          margin="dense"
          disabled={isPending}
        />
        <FormControlLabel
          control={
            <Switch
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              disabled={isPending}
            />
          }
          label="Активен"
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Отмена
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={isPending}>
          {isPending ? <CircularProgress size={24} /> : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Тренировочные сборы
      </Typography>

      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Поиск по названию..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ flex: 1, minWidth: 150 }}
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
          size="small"
          placeholder="Локация"
          value={queryLocation}
          onChange={(e) => setQueryLocation(e.target.value)}
          sx={{ minWidth: 120 }}
        />
        <Button
          variant="contained"
          onClick={() => refetch()}
          disabled={isFetching}
          startIcon={isFetching ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
        >
          Обновить
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => {
            setForm(defaultForm);
            setFieldErrors({});
            setCreateDialogOpen(true);
          }}
        >
          Создать
        </Button>
      </Paper>

      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {(error as Error)?.message || 'Не удалось загрузить сборы'}
          </Alert>
        ) : camps.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Сборы не найдены
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Локация</TableCell>
                    <TableCell>Дата начала</TableCell>
                    <TableCell>Дата окончания</TableCell>
                    <TableCell>Активен</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {camps.map((camp) => (
                    <TableRow
                      key={camp.id}
                      onClick={() => handleRowClick(camp.id)}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    >
                      <TableCell>{camp.name}</TableCell>
                      <TableCell>{camp.location || '—'}</TableCell>
                      <TableCell>{camp.startDate}</TableCell>
                      <TableCell>{camp.endDate}</TableCell>
                      <TableCell>
                        <Chip
                          label={camp.isActive ? 'Активен' : 'Неактивен'}
                          color={camp.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Редактировать">
                          <IconButton size="small" onClick={() => handleEditOpen(camp)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Участники">
                          <IconButton size="small" color="primary" onClick={() => handleRowClick(camp.id)}>
                            <PeopleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton size="small" color="error" onClick={() => handleDeleteClick(camp.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Всего: {total} лагерей
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={prevPage} disabled={offset === 0 || isFetching} variant="outlined" size="small">
                  Назад
                </Button>
                <Button
                  onClick={nextPage}
                  disabled={offset + LIMIT >= total || isFetching}
                  variant="outlined"
                  size="small"
                >
                  Вперед
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

      {renderCampDialog(
        createDialogOpen,
        () => setCreateDialogOpen(false),
        handleCreate,
        'Создание сбора',
        'Создать',
        createMutation.isPending,
      )}

      {renderCampDialog(
        editDialogOpen,
        () => {
          setEditDialogOpen(false);
          setEditingCamp(null);
        },
        handleUpdate,
        'Редактирование сборы',
        'Сохранить',
        updateMutation.isPending,
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>Вы уверены, что хотите удалить этот лагерь?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteMutation.isPending}>
            Отмена
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <CircularProgress size={24} /> : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}