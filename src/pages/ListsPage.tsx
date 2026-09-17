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
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listApi } from '../services/api';
import { List, CreateListDto, InvalidParam } from '../types';
import { AxiosError } from 'axios';

type NewListForm = {
  name: string;
};

const defaultNewList: NewListForm = { name: '' };

type FieldErrors = {
  name?: string;
};

export default function ListsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [queryName, setQueryName] = useState('');
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newList, setNewList] = useState<NewListForm>(defaultNewList);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Дебаунс для поиска
  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setQueryName(searchInput);
      setOffset(0); // сброс страницы при новом поиске
    }, 300);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [searchInput]);

  // Запрос списков – ключ без limit/offset, чтобы не перезапрашивать при пагинации
  const {
    data = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<List[]>({
    queryKey: ['lists', { name: queryName }],
    queryFn: () => listApi.getLists({ name: queryName || undefined }).then(res => res.data),
  });

  // Пагинация на клиенте
  const total = data.length;
  const paginatedLists = data.slice(offset, offset + limit);

  // Извлечение ошибок полей
  const extractFieldErrors = (err: unknown): FieldErrors => {
    const errors: FieldErrors = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const invalidParams = err.response.data.invalid_params as InvalidParam[];
      for (const param of invalidParams) {
        const firstError = param.errors[0];
        if (firstError) {
          errors[param.name as keyof FieldErrors] = firstError.reason;
        }
      }
    }
    return errors;
  };

  // Мутация создания списка
  const createMutation = useMutation({
    mutationFn: (payload: CreateListDto) => listApi.createList(payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Список создан', severity: 'success' });
      setCreateDialogOpen(false);
      setNewList(defaultNewList);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
    onError: (err: unknown) => {
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

  // Мутация удаления списка
  const deleteMutation = useMutation({
    mutationFn: (id: string) => listApi.deleteList(id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Список удалён', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteListId(null);
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
    onError: (err: unknown) => {
      if (err instanceof AxiosError) {
        setSnackbar({ open: true, message: err.response?.data?.message || 'Ошибка удаления', severity: 'error' });
      } else {
        setSnackbar({ open: true, message: 'Неизвестная ошибка', severity: 'error' });
      }
    },
  });

  // Обработчики
  const handleCreateList = (): void => {
    const payload: CreateListDto = { name: newList.name.trim() };
    createMutation.mutate(payload);
  };

  const handleDeleteClick = (id: string, event: React.MouseEvent): void => {
    event.stopPropagation();
    setDeleteListId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = (): void => {
    if (deleteListId) deleteMutation.mutate(deleteListId);
  };

  const nextPage = (): void => setOffset(prev => Math.min(prev + limit, total - limit));
  const prevPage = (): void => setOffset(prev => Math.max(0, prev - limit));

  const handleClearSearch = (): void => {
    setSearchInput('');
    setQueryName('');
    setOffset(0);
  };

  const handleFieldChange = (value: string): void => {
    setNewList({ name: value });
    if (fieldErrors.name) setFieldErrors({ name: undefined });
  };

  const handleOpenCreateDialog = (): void => {
    setCreateDialogOpen(true);
    setFieldErrors({});
    setNewList(defaultNewList);
  };

  // Переход на страницу управления пользователями
  const handleRowClick = (listId: string): void => {
    navigate(`/lists/${listId}/users`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Управление списками
      </Typography>

      {/* Панель поиска и кнопок */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Поиск по названию..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          autoComplete="off"
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

      {/* Таблица со списками */}
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {(error as Error)?.message || 'Не удалось загрузить списки'}
          </Alert>
        ) : paginatedLists.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Списки не найдены
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedLists.map((list: List) => (
                    <TableRow
                      key={list.id}
                      onClick={() => handleRowClick(list.id)}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    >
                      <TableCell>{list.name}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Удалить">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleDeleteClick(list.id, e)}
                            disabled={deleteMutation.isPending}
                          >
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
                Всего: {total} списков
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={prevPage} disabled={offset === 0 || isFetching} variant="outlined" size="small">
                  Назад
                </Button>
                <Button
                  onClick={nextPage}
                  disabled={offset + limit >= total || isFetching}
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

      {/* Диалог создания списка */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создание списка</DialogTitle>
        <DialogContent>
          <TextField
            label="Название*"
            value={newList.name}
            onChange={(e) => handleFieldChange(e.target.value)}
            required
            fullWidth
            error={!!fieldErrors.name}
            helperText={fieldErrors.name || ''}
            disabled={createMutation.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={createMutation.isPending}>
            Отмена
          </Button>
          <Button
            onClick={handleCreateList}
            variant="contained"
            disabled={!newList.name || createMutation.isPending}
          >
            {createMutation.isPending ? <CircularProgress size={24} /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог удаления списка */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>Вы уверены, что хотите удалить этот список?</Typography>
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

      {/* Snackbar уведомления */}
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
