// src/pages/TestGradesPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Tooltip,
  TextField,
  Backdrop,
  Chip,
  Stack,
  InputAdornment,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Palette as PaletteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { testGradeApi, testTypeApi } from '../services/api';
import type {
  TestGrade,
  CreateTestGradeDto,
  UpdateTestGradeDto,
  InvalidParam,
} from '../types';

// ============================================================
// Форма
// ============================================================

type GradeForm = {
  grade: string;
  threshold: string; // храним строкой, конвертим при submit
  color: string;     // HEX #RRGGBB
};

const defaultForm: GradeForm = {
  grade: '',
  threshold: '',
  color: '#4CAF50',
};

type FieldErrors = Partial<Record<'grade' | 'threshold' | 'color', string>>;

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * Собирает PATCH-патч из формы, включая только реально изменённые поля.
 *
 * Контракт PATCH: отсутствующее поле = «не трогай». Это критично для
 * YDB, где колонка `grade` входит в PRIMARY KEY и её присутствие в SET
 * (даже с тем же значением) вызывает ложный 400120 unique violation.
 *
 * Возвращает null, если менять нечего — вызывающий код закрывает
 * диалог без запроса.
 */
function buildUpdatePatch(form: GradeForm, original: TestGrade): UpdateTestGradeDto | null {
  const patch: UpdateTestGradeDto = {};

  const trimmedGrade = form.grade.trim();
  const thresholdNum = Number(form.threshold);

  if (trimmedGrade !== original.grade) patch.grade = trimmedGrade;
  if (thresholdNum !== original.threshold) patch.threshold = thresholdNum;
  if (form.color !== original.color) patch.color = form.color;

  return Object.keys(patch).length > 0 ? patch : null;
}

// ============================================================
// Компонент
// ============================================================

export default function TestGradesPage() {
  const { testTypeId } = useParams<{ testTypeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TestGrade | null>(null);
  const [form, setForm] = useState<GradeForm>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // ----- тип теста (для заголовка) -----
  const { data: testType } = useQuery({
    queryKey: ['test-type', testTypeId],
    queryFn: () => testTypeApi.getById(testTypeId!).then((r) => r.data),
    enabled: !!testTypeId,
  });

  // ----- список градаций -----
  const {
    data: grades = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<TestGrade[]>({
    queryKey: ['test-grades', testTypeId],
    queryFn: () => testGradeApi.getAllByTestType(testTypeId!).then((r) => r.data),
    enabled: !!testTypeId,
  });

  // ----- извлечение ошибок полей из ответа API -----
  const extractFieldErrors = (err: unknown): FieldErrors => {
    const errors: FieldErrors = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const invalidParams = err.response.data.invalid_params as InvalidParam[];
      for (const p of invalidParams) {
        const first = p.errors[0];
        if (first) errors[p.name as keyof FieldErrors] = first.reason;
      }
    }
    return errors;
  };

  // ----- клиентская валидация -----
  const validateForm = (f: GradeForm): FieldErrors => {
    const e: FieldErrors = {};
    if (!f.grade.trim()) {
      e.grade = 'Укажите название градации';
    } else if (f.grade.trim().length > 50) {
      e.grade = 'Не более 50 символов';
    }

    const num = Number(f.threshold);
    if (f.threshold.trim() === '' || !Number.isFinite(num) || num < 0) {
      e.threshold = 'Число ≥ 0';
    }

    if (!HEX_COLOR_RE.test(f.color)) {
      e.color = 'Формат #RRGGBB';
    }

    return e;
  };

  // ----- мутации -----
  const createMutation = useMutation({
    mutationFn: (payload: CreateTestGradeDto) =>
      testGradeApi.create(testTypeId!, payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Градация создана', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['test-grades', testTypeId] });
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
    mutationFn: ({ id, data }: { id: string; data: UpdateTestGradeDto }) =>
      testGradeApi.update(testTypeId!, id, data),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Градация обновлена', severity: 'success' });
      setEditDialogOpen(false);
      setEditing(null);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['test-grades', testTypeId] });
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
    mutationFn: (id: string) => testGradeApi.remove(testTypeId!, id),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Градация удалена', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['test-grades', testTypeId] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message || 'Ошибка удаления'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // ----- обработчики -----
  const handleOpenCreate = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setCreateDialogOpen(true);
  };

  const handleOpenEdit = (g: TestGrade) => {
    setEditing(g);
    setForm({
      grade: g.grade,
      threshold: String(g.threshold),
      color: g.color,
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    const errs = validateForm(form);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    const payload: CreateTestGradeDto = {
      grade: form.grade.trim(),
      threshold: Number(form.threshold),
      color: form.color,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editing) return;

    const errs = validateForm(form);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    const patch = buildUpdatePatch(form, editing);
    if (!patch) {
      // Нечего сохранять — просто закрываем диалог без сетевого запроса.
      setSnackbar({ open: true, message: 'Изменений нет', severity: 'success' });
      setEditDialogOpen(false);
      setEditing(null);
      setForm(defaultForm);
      return;
    }

    updateMutation.mutate({ id: editing.id, data: patch });
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteId) deleteMutation.mutate(deleteId);
  };

  const handleFieldChange = <K extends keyof GradeForm>(field: K, value: GradeForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // ----- рендер диалога (общий для create/edit) -----
  const renderDialog = (
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
            label="Название градации *"
            value={form.grade}
            onChange={(e) => handleFieldChange('grade', e.target.value)}
            error={!!fieldErrors.grade}
            helperText={fieldErrors.grade || ''}
            fullWidth
            disabled={isPending}
            slotProps={{ htmlInput: { maxLength: 50 } }}
          />

          <TextField
            label="Порог *"
            type="number"
            value={form.threshold}
            onChange={(e) => handleFieldChange('threshold', e.target.value)}
            error={!!fieldErrors.threshold}
            helperText={fieldErrors.threshold || 'Число ≥ 0 (например, время в секундах)'}
            fullWidth
            disabled={isPending}
            slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
          />

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <input
              type="color"
              value={HEX_COLOR_RE.test(form.color) ? form.color : '#000000'}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              disabled={isPending}
              style={{
                width: 56,
                height: 40,
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
                padding: 2,
                background: 'transparent',
              }}
            />
            <TextField
              label="Цвет (HEX) *"
              value={form.color}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              error={!!fieldErrors.color}
              helperText={fieldErrors.color || 'Формат #RRGGBB'}
              fullWidth
              disabled={isPending}
              slotProps={{
                htmlInput: { maxLength: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PaletteIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </Box>
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

  // ============================================================
  // Render
  // ============================================================
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <Tooltip title="К типам тестов">
          <IconButton onClick={() => navigate('/test-types')}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Градации теста
        </Typography>
      </Stack>

      {testType && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Тип теста:&nbsp;
          <b>{testType.name}</b>
          &nbsp;({testType.gender === 'male' ? 'мужской' : 'женский'},{' '}
          {testType.parameter})
        </Typography>
      )}

      {/* Панель кнопок */}
      <Paper
        sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}
      >
        <Button
          variant="contained"
          onClick={() => refetch()}
          disabled={isFetching}
          startIcon={
            isFetching ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />
          }
        >
          Обновить
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
        >
          Создать градацию
        </Button>
      </Paper>

      {/* Таблица */}
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error instanceof AxiosError
              ? error.response?.data?.message || 'Не удалось загрузить градации'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : grades.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              У этого типа теста пока нет градаций
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Градация</TableCell>
                    <TableCell>Порог</TableCell>
                    <TableCell>Цвет</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {grades.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Chip
                          label={g.grade}
                          size="small"
                          sx={{
                            bgcolor: g.color,
                            color: '#fff',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell>{g.threshold}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '4px',
                              bgcolor: g.color,
                              border: '1px solid rgba(0,0,0,0.15)',
                            }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {g.color}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="Редактировать">
                            <IconButton size="small" onClick={() => handleOpenEdit(g)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(g.id)}
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
                Всего градаций: {grades.length}
              </Typography>
            </Box>

            <Backdrop
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
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

      {/* Диалоги создания / редактирования */}
      {renderDialog(
        createDialogOpen,
        () => setCreateDialogOpen(false),
        handleCreate,
        'Создание градации',
        'Создать',
        createMutation.isPending,
      )}

      {renderDialog(
        editDialogOpen,
        () => {
          setEditDialogOpen(false);
          setEditing(null);
        },
        handleUpdate,
        'Редактирование градации',
        'Сохранить',
        updateMutation.isPending,
      )}

      {/* Диалог удаления */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить эту градацию? Действие необратимо.
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
            {deleteMutation.isPending ? <CircularProgress size={24} /> : 'Удалить'}
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