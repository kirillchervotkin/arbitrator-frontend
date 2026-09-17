import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listApi, userApi } from '../services/api';
import { User } from '../types';

export default function UsersManagementPage() {
  const { listId } = useParams();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Получение пользователей, привязанных к текущему списку
  const {
    data: usersInList = [],
    isLoading: loadingUsers,
    error: usersError,
  } = useQuery({
    queryKey: ['users-in-list', listId],
    queryFn: () =>
      listApi.getUserListsForList(listId!).then((res) => res.data),
    enabled: !!listId,
  });

  // Получение всех пользователей системы для выпадающего списка
  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const response = await userApi.getUsers({ limit: 1000 }); // можно увеличить лимит
        setAllUsers(response.data.rows);
      } catch (error) {
        console.error('Ошибка загрузки всех пользователей:', error);
      }
    };
    fetchAllUsers();
  }, []);

  // Привязка пользователя к списку
  const assignMutation = useMutation({
    mutationFn: (userId: string) =>
      listApi.assignUserToList(userId, listId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-in-list', listId] });
      setSnackbar({
        open: true,
        message: 'Пользователь добавлен!',
        severity: 'success',
      });
      setSelectedUserId(null);
    },
    onError: (error) => {
      console.error(error);
      setSnackbar({
        open: true,
        message: 'Ошибка добавления пользователя.',
        severity: 'error',
      });
    },
  });

  // Удаление пользователя из списка
  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      listApi.removeUserFromList(userId, listId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-in-list', listId] });
      setSnackbar({
        open: true,
        message: 'Пользователь удален!',
        severity: 'success',
      });
    },
    onError: (error) => {
      console.error(error);
      setSnackbar({
        open: true,
        message: 'Ошибка удаления пользователя.',
        severity: 'error',
      });
    },
  });

  const handleAssignUser = () => {
    if (!selectedUserId) return;
    assignMutation.mutate(selectedUserId);
  };

  const handleRemoveUser = (userId: string) => {
    removeMutation.mutate(userId);
  };

  // Форматирование имени пользователя
  const formatUserName = (user: User) => {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
  };

  // Фильтруем уже добавленных пользователей, чтобы не предлагать их повторно
  const availableUsers = allUsers.filter(
    (user) => !usersInList.some((u) => u.id === user.id)
  );

  if (loadingUsers) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (usersError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Ошибка загрузки пользователей списка.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Управление пользователями списка
      </Typography>

      {/* Блок добавления пользователя */}
      <Paper elevation={3} sx={{ mt: 2, p: 2 }}>
        <FormControl fullWidth>
          <InputLabel id="select-user-label">Выберите пользователя</InputLabel>
          <Select
            labelId="select-user-label"
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(e.target.value as string)}
            label="Выберите пользователя"
            disabled={loadingUsers || assignMutation.isPending}
          >
            {availableUsers.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {formatUserName(user)} ({user.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={handleAssignUser}
          disabled={!selectedUserId || loadingUsers || assignMutation.isPending}
        >
          {assignMutation.isPending ? 'Добавление...' : 'Добавить пользователя'}
        </Button>
      </Paper>

      {/* Таблица пользователей списка */}
      <Paper elevation={3} sx={{ mt: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usersInList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  Нет пользователей в этом списке.
                </TableCell>
              </TableRow>
            ) : (
              usersInList.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell>{formatUserName(user)}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.isActive ? 'Активен' : 'Не активен'}</TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => handleRemoveUser(user.id)}
                      disabled={removeMutation.isPending}
                    >
                      Удалить
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Snackbar уведомления */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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
