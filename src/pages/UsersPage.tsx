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
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Link as LinkIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, authApi } from '../services/api';
import { User, CreateUserData } from '../types';
import { AxiosError } from 'axios';

type NewUserForm = {
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
};

const defaultNewUser: NewUserForm = {
  email: '',
  firstName: '',
  lastName: '',
  birthDate: '',
};

type FieldErrors = {
  email?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
};

export default function UsersPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [queryEmail, setQueryEmail] = useState('');
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(defaultNewUser);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
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
      setQueryEmail(searchInput);
      setOffset(0);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchInput]);

  // Запрос пользователей
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users', { limit, offset, email: queryEmail }],
    queryFn: () => userApi.getUsers({ limit, offset, email: queryEmail || undefined }),
  });

  const users = data?.data?.rows || [];
  const total = data?.data?.total || 0;

  // Извлечение ошибок полей
  const extractFieldErrors = (err: unknown): FieldErrors => {
    const errors: FieldErrors = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const invalidParams = err.response.data.invalid_params as Array<{
        name: string;
        errors: Array<{ reason: string; code?: string; source?: { pointer: string } }>;
      }>;
      for (const param of invalidParams) {
        const firstError = param.errors[0];
        if (firstError) {
          errors[param.name as keyof FieldErrors] = firstError.reason;
        }
      }
    }
    return errors;
  };

  // Мутации
  const createMutation = useMutation({
    mutationFn: (payload: CreateUserData) => userApi.createUser(payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Пользователь создан', severity: 'success' });
      setCreateDialogOpen(false);
      setNewUser(defaultNewUser);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setFieldErrors(fieldErrors);
        setSnackbar({ open: true, message: 'Проверьте правильность заполнения полей', severity: 'error' });
      } else {
        if (err instanceof AxiosError) {
          setSnackbar({ open: true, message: err.response?.data?.message || 'Ошибка создания', severity: 'error' });
        } else {
          setSnackbar({ open: true, message: 'Неизвестная ошибка', severity: 'error' });
        }
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteUser(id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Пользователь удалён', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteUserId(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      if (err instanceof AxiosError) {
        setSnackbar({ open: true, message: err.response?.data?.message || 'Ошибка удаления', severity: 'error' });
      } else {
        setSnackbar({ open: true, message: 'Неизвестная ошибка', severity: 'error' });
      }
    },
  });

  const activationMutation = useMutation({
    mutationFn: (userId: string) => authApi.createActivationUrl(userId),
    onSuccess: (response) => {
      const url = response.data.activationUrl;
      navigator.clipboard.writeText(url);
      setSnackbar({ open: true, message: 'URL активации скопирован в буфер обмена', severity: 'success' });
    },
    onError: (err: Error) => {
      if (err instanceof AxiosError) {
        setSnackbar({ open: true, message: err.response?.data?.message || 'Ошибка создания URL', severity: 'error' });
      } else {
        setSnackbar({ open: true, message: 'Неизвестная ошибка', severity: 'error' });
      }
    },
  });

  // Обработчики
  const handleCreateUser = () => {
    const payload: CreateUserData = {
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      // Отправляем строку как есть (YYYY-MM-DD), без преобразования в Date
      birthDate: newUser.birthDate || undefined,
    };
    createMutation.mutate(payload);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteUserId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteUserId) deleteMutation.mutate(deleteUserId);
  };

  const handleActivationUrl = (userId: string) => {
    activationMutation.mutate(userId);
  };

  const nextPage = () => setOffset((prev) => prev + limit);
  const prevPage = () => setOffset((prev) => Math.max(0, prev - limit));

  const handleClearSearch = () => {
    setSearchInput('');
    setQueryEmail('');
    setOffset(0);
  };

  const handleFieldChange = (field: keyof NewUserForm, value: string) => {
    setNewUser((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleOpenCreateDialog = () => {
    setCreateDialogOpen(true);
    setFieldErrors({});
    setNewUser(defaultNewUser);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Управление пользователями
      </Typography>

      {/* Панель поиска и кнопок */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Поиск по email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          autoComplete="off"
          id="search-input"
          name="search-input"
          // Поле всегда доступно для ввода, даже во время загрузки
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
          onClick={handleOpenCreateDialog}
        >
          Создать
        </Button>
      </Paper>

      {/* Контейнер с таблицей и оверлеем загрузки */}
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error instanceof AxiosError
              ? error.response?.data?.message || 'Не удалось загрузить пользователей'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : users.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Пользователи не найдены
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Имя</TableCell>
                    <TableCell>Фамилия</TableCell>
                    <TableCell>Дата рождения</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.firstName || '—'}</TableCell>
                      <TableCell>{user.lastName || '—'}</TableCell>
                      <TableCell>
                        {user.birthDate ? new Date(user.birthDate).toLocaleDateString('ru-RU') : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.isActive ? 'Активен' : 'Неактивен'}
                          color={user.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="Создать URL активации">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleActivationUrl(user.id)}
                              disabled={activationMutation.isPending}
                            >
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(user.id)}
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Всего: {total} пользователей
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={prevPage} disabled={offset === 0 || isFetching} variant="outlined" size="small">
                  Назад
                </Button>
                <Button onClick={nextPage} disabled={offset + limit >= total || isFetching} variant="outlined" size="small">
                  Вперёд
                </Button>
              </Box>
            </Box>

            {/* Оверлей загрузки – затемняет таблицу, но не убирает её */}
            <Backdrop
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
                color: '#fff',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
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

      {/* Диалог создания пользователя */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создание пользователя</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Email *"
              type="email"
              value={newUser.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              required
              fullWidth
              error={!!fieldErrors.email}
              helperText={fieldErrors.email || ''}
              disabled={createMutation.isPending}
            />
            <TextField
              label="Имя *"
              value={newUser.firstName}
              onChange={(e) => handleFieldChange('firstName', e.target.value)}
              fullWidth
              error={!!fieldErrors.firstName}
              helperText={fieldErrors.firstName || ''}
              disabled={createMutation.isPending}
            />
            <TextField
              label="Фамилия *"
              value={newUser.lastName}
              onChange={(e) => handleFieldChange('lastName', e.target.value)}
              fullWidth
              error={!!fieldErrors.lastName}
              helperText={fieldErrors.lastName || ''}
              disabled={createMutation.isPending}
            />
            <TextField
              label="Дата рождения"
              type="date"
              value={newUser.birthDate}
              onChange={(e) => handleFieldChange('birthDate', e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!fieldErrors.birthDate}
              helperText={fieldErrors.birthDate || ''}
              disabled={createMutation.isPending}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={createMutation.isPending}>
            Отмена
          </Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            disabled={!newUser.email || !newUser.firstName || !newUser.lastName || createMutation.isPending}
          >
            {createMutation.isPending ? <CircularProgress size={24} /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог удаления */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>Вы уверены, что хотите удалить этого пользователя? Действие необратимо.</Typography>
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

      {/* Snackbar для уведомлений */}
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