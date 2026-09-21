// src/pages/FieldRolesPage.tsx

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
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { fieldRoleApi } from '../services/api';
import {
  FieldRole,
  CreateFieldRoleDto,
  UpdateFieldRoleDto,
  InvalidParam,
} from '../types';

// ------------------------------------------------------------------
// Справочник кодов ролей (для подсказки и валидации)
// ------------------------------------------------------------------


// ------------------------------------------------------------------
// Форма
// ------------------------------------------------------------------

type FieldRoleForm = {
  code: string;
  name: string;
  sortOrder: string; // храним строкой для input, конвертируем при отправке
};

const defaultForm: FieldRoleForm = {
  code: '',
  name: '',
  sortOrder: '',
};

type FieldErrors = {
  code?: string;
  name?: string;
  sortOrder?: string;
};

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function FieldRolesPage() {
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<FieldRole | null>(null);
  const [form, setForm] = useState<FieldRoleForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Запрос ролей — без пагинации, без фильтров.
  // Сортировка по sortOrder: Главный судья, Помощник, Резервный, VAR, AVAR.
  const {
    data: roles = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<FieldRole[]>({
    queryKey: ['field-roles'],
    queryFn: async () => {
      const res = await fieldRoleApi.getAll({
        orderBy: 'sortOrder',
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
    mutationFn: (payload: CreateFieldRoleDto) => fieldRoleApi.create(payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Роль создана', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['field-roles'] });
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
    mutationFn: ({ id, data }: { id: string; data: UpdateFieldRoleDto }) =>
      fieldRoleApi.update(id, data),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Роль обновлена', severity: 'success' });
      setEditDialogOpen(false);
      setEditingRole(null);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['field-roles'] });
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
    mutationFn: (id: string) => fieldRoleApi.remove(id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Роль удалена', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteRoleId(null);
      queryClient.invalidateQueries({ queryKey: ['field-roles'] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ||
            'Невозможно удалить: на роль есть назначения'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // --- Обработчики ---

  const handleCreate = () => {
    const payload: CreateFieldRoleDto = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      sortOrder: Number(form.sortOrder) || 0,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editingRole) return;
    const payload: UpdateFieldRoleDto = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      sortOrder: Number(form.sortOrder) || 0,
    };
    updateMutation.mutate({ id: editingRole.id, data: payload });
  };

  const handleEditOpen = (role: FieldRole) => {
    setEditingRole(role);
    setForm({
      code: role.code,
      name: role.name,
      sortOrder: String(role.sortOrder),
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteRoleId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteRoleId) deleteMutation.mutate(deleteRoleId);
  };

  const handleFieldChange = (field: keyof FieldRoleForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleOpenCreateDialog = () => {
    // Автоподстановка следующего sortOrder
    const maxOrder = roles.reduce(
      (max, r) => (r.sortOrder > max ? r.sortOrder : max),
      0,
    );
    setForm({
      code: '',
      name: '',
      sortOrder: String(maxOrder + 1),
    });
    setFieldErrors({});
    setCreateDialogOpen(true);
  };

  // --- Рендер диалога (общий для create / edit) ---

  const renderRoleDialog = (
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
            label="Код *"
            value={form.code}
            onChange={(e) => handleFieldChange('code', e.target.value)}
            error={!!fieldErrors.code}
            helperText={
              fieldErrors.code ||
              'Программный идентификатор: REFEREE, ASSISTANT, RESERVE, VAR, AVAR'
            }
            fullWidth
            required
            disabled={isPending}
            autoComplete="off"
            slotProps={{ htmlInput: { style: { textTransform: 'uppercase' } } }}
          />
          <TextField
            label="Название *"
            value={form.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name || 'Отображается в UI'}
            fullWidth
            required
            disabled={isPending}
            autoComplete="off"
          />
          <TextField
            label="Порядок *"
            type="number"
            value={form.sortOrder}
            onChange={(e) => handleFieldChange('sortOrder', e.target.value)}
            error={!!fieldErrors.sortOrder}
            helperText={fieldErrors.sortOrder || 'Чем меньше — тем выше в списке'}
            fullWidth
            required
            disabled={isPending}
            slotProps={{ htmlInput: { min: 1 } }}
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
          disabled={isPending || !form.code.trim() || !form.name.trim()}
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
        Роли на поле
      </Typography>

      {/* Информационная плашка */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Справочник фиксированный: <strong>REFEREE</strong>,{' '}
        <strong>ASSISTANT</strong>, <strong>RESERVE</strong>,{' '}
        <strong>VAR</strong>, <strong>AVAR</strong>. В dev-окружении роли
        создаются автоматически при первом запуске. Редактирование и удаление
        доступны, но обычно не требуются.
      </Alert>

      {/* Панель кнопок */}
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
          Добавить роль
        </Button>
      </Paper>

      {/* Таблица */}
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error instanceof AxiosError
              ? error.response?.data?.message || 'Не удалось загрузить роли'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : roles.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Роли не найдены. В dev-окружении они создаются автоматически —
              попробуйте перезапустить приложение.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width={80}>Порядок</TableCell>
                    <TableCell>Код</TableCell>
                    <TableCell>Название</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id} hover>
                      <TableCell>
                        <Chip
                          label={role.sortOrder}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                          }}
                        >
                          {role.code}
                        </Typography>
                      </TableCell>
                      <TableCell>{role.name}</TableCell>
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
                              onClick={() => handleEditOpen(role)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(role.id)}
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
                Всего: {roles.length} ролей
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
      {renderRoleDialog(
        createDialogOpen,
        () => setCreateDialogOpen(false),
        handleCreate,
        'Создание роли',
        'Создать',
        createMutation.isPending,
      )}

      {/* Диалог редактирования */}
      {renderRoleDialog(
        editDialogOpen,
        () => {
          setEditDialogOpen(false);
          setEditingRole(null);
        },
        handleUpdate,
        'Редактирование роли',
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
            Вы уверены, что хотите удалить эту роль? Если на неё есть
            назначения — удаление будет отклонено.
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
