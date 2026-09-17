// src/pages/TestTypesPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Grade as GradeIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { testTypeApi } from '../services/api';
import type {
  TestType,
  CreateTestTypeDto,
  UpdateTestTypeDto,
  TestParameter,
  PaginatedResponse,
  InvalidParam,
} from '../types';

// ============================================================
// Типы формы
// ============================================================

type Gender = 'male' | 'female';

type Form = {
  name: string;
  gender: Gender;
  parameter: TestParameter;        // задаёт, какие поля показывать
  failThresholdTime: string;       // храним строкой, конвертим при submit
  failThresholdLevel: string;
  failThresholdSegments: string;
  attemptsCount: string;
};

const defaultForm: Form = {
  name: '',
  gender: 'male',
  parameter: 'time',
  failThresholdTime: '',
  failThresholdLevel: '',
  failThresholdSegments: '',
  attemptsCount: '1',
};

type FieldErrors = Partial<
  Record<
    | 'name'
    | 'gender'
    | 'failThresholdTime'
    | 'failThresholdLevel'
    | 'failThresholdSegments'
    | 'attemptsCount',
    string
  >
>;

const LIMIT = 10;

const parameterLabels: Record<TestParameter, string> = {
  time: 'Время',
  level: 'Уровень',
  segments: 'Отрезки',
};

const parameterColors: Record<TestParameter, 'primary' | 'secondary' | 'default'> = {
  time: 'primary',
  level: 'secondary',
  segments: 'default',
};

// ============================================================
// Логирование ошибок
// ============================================================

type LogContext = {
  scope: string;
  extra?: Record<string, unknown>;
};

/**
 * Подробно логирует ошибку в консоль.
 * Возвращает человекочитаемое сообщение для snackbar.
 */
function logError(err: unknown, ctx: LogContext): string {
  const tag = `[TestTypesPage][${ctx.scope}]`;

  // --- 1. Сырой объект целиком ---
   
  console.groupCollapsed(`${tag} error`);
   
  console.error('raw error:', err);
  if (ctx.extra) {
     
    console.error('extra:', ctx.extra);
  }

  // --- 2. Если это AxiosError — разбираем подробно ---
  if (err instanceof AxiosError) {
    const { config, response, request, message, code } = err;
    const status = response?.status;
    const url = config?.url;
    const method = (config?.method ?? 'get').toUpperCase();
    const reqData = config?.data;
    const resData = response?.data;
    const resHeaders = response?.headers;

     
    console.error('axios meta:', {
      method,
      url,
      status,
      code,
      message,
      requestData: reqData,
      responseData: resData,
      responseHeaders: resHeaders,
    });

    // Если ответ — HTML (например, 502 от nginx), покажем первые 500 символов
    if (typeof resData === 'string') {
       
      console.error('response (text, first 500):', resData.slice(0, 500));
    }

    // network error / timeout / CORS
    if (!response) {
       
      console.error('no response — network / CORS / timeout / abort?', {
        code,
        message,
        request,
      });
    }

     
    console.groupEnd();

    // ---- Формируем сообщение для snackbar ----
    const fromBody =
      (resData && (resData.message || resData.error || resData.detail)) || null;

    if (fromBody) return String(fromBody);
    if (status) return `HTTP ${status} ${method} ${url ?? ''}`.trim();
    if (code === 'ECONNABORTED') return 'Превышено время ожидания запроса';
    return `${message || 'Сетевая ошибка'} (${method} ${url ?? ''})`.trim();
  }

  // --- 3. Не AxiosError — обычный Error/что угодно ---
  if (err instanceof Error) {
     
    console.error('stack:', err.stack);
     
    console.groupEnd();
    return err.message || 'Неизвестная ошибка';
  }

   
  console.error('unknown error type:', typeof err, err);
   
  console.groupEnd();
  return 'Неизвестная ошибка';
}

// ============================================================
// Компонент
// ============================================================

export default function TestTypesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Поиск / пагинация
  const [searchInput, setSearchInput] = useState('');
  const [queryName, setQueryName] = useState('');
  const [genderFilter, setGenderFilter] = useState<'' | Gender>('');
  const [offset, setOffset] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Диалоги
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TestType | null>(null);
  const [form, setForm] = useState<Form>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // ----- debounce поиска -----
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setQueryName(searchInput);
      setOffset(0);
    }, 300);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [searchInput]);

  // ----- запрос списка -----
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<PaginatedResponse<TestType>>({
    queryKey: ['test-types', { name: queryName, gender: genderFilter, limit: LIMIT, offset }],
    queryFn: () =>
      testTypeApi
        .getAll({
          limit: LIMIT,
          offset,
          name: queryName || undefined,
          gender: genderFilter || undefined,
          orderBy: 'name',
          orderDir: 'ASC',
        })
        .then((res) => res.data),
  });

  // ----- логирование ошибки запроса списка -----
  useEffect(() => {
    if (isError && error) {
      logError(error, {
        scope: 'query:list',
        extra: { queryName, genderFilter, offset, limit: LIMIT },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, error]);

  const testTypes = data?.rows ?? [];
  const total = data?.total ?? 0;

  // ----- извлечение ошибок полей из ответа API -----
  const extractFieldErrors = (err: unknown): FieldErrors => {
    const errors: FieldErrors = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const invalidParams = err.response.data.invalid_params as InvalidParam[];
       
      console.warn('[TestTypesPage] invalid_params from API:', invalidParams);
      for (const p of invalidParams) {
        const first = p.errors[0];
        if (first) {
          errors[p.name as keyof FieldErrors] = first.reason;
        }
      }
    }
    return errors;
  };

  // ----- payload builders -----
  const formToCreateDto = (f: Form): CreateTestTypeDto => {
    const base = { name: f.name.trim(), gender: f.gender };
    if (f.parameter === 'time') {
      return {
        ...base,
        failThresholdTime: Number(f.failThresholdTime),
        attemptsCount: Number(f.attemptsCount),
      };
    }
    if (f.parameter === 'segments') {
      return {
        ...base,
        failThresholdSegments: Number(f.failThresholdSegments),
      };
    }
    // level
    return {
      ...base,
      failThresholdLevel: Number(f.failThresholdLevel),
      failThresholdSegments: Number(f.failThresholdSegments),
    };
  };

  /**
   * Для PATCH отправляем ВСЕ пороговые поля с явными null,
   * чтобы при смене типа теста старые значения затирались.
   * Валидатор UpdateTestTypeDto проверяет комбинацию, используя `!= null`,
   * поэтому явные null эквивалентны «не задано».
   */
  const formToUpdateDto = (f: Form): UpdateTestTypeDto => {
    const base = { name: f.name.trim(), gender: f.gender };
    if (f.parameter === 'time') {
      return {
        ...base,
        failThresholdTime: Number(f.failThresholdTime),
        failThresholdLevel: null,
        failThresholdSegments: null,
        attemptsCount: Number(f.attemptsCount),
      };
    }
    if (f.parameter === 'segments') {
      return {
        ...base,
        failThresholdTime: null,
        failThresholdLevel: null,
        failThresholdSegments: Number(f.failThresholdSegments),
        attemptsCount: null,
      };
    }
    // level
    return {
      ...base,
      failThresholdTime: null,
      failThresholdLevel: Number(f.failThresholdLevel),
      failThresholdSegments: Number(f.failThresholdSegments),
      attemptsCount: null,
    };
  };

  // ----- клиентская валидация -----
  const validateForm = (f: Form): FieldErrors => {
    const e: FieldErrors = {};
    if (!f.name.trim()) e.name = 'Укажите название';

    const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
    const isPosNum = (v: string) => Number.isFinite(num(v)) && num(v) >= 0;
    const isPosInt = (v: string) => Number.isInteger(num(v)) && num(v) >= 1;

    if (f.parameter === 'time') {
      if (!isPosNum(f.failThresholdTime)) e.failThresholdTime = 'Укажите число ≥ 0';
      if (!isPosInt(f.attemptsCount)) e.attemptsCount = 'Целое число ≥ 1';
    } else if (f.parameter === 'segments') {
      if (!isPosInt(f.failThresholdSegments))
        e.failThresholdSegments = 'Целое число ≥ 0';
    } else if (f.parameter === 'level') {
      if (!isPosNum(f.failThresholdLevel)) e.failThresholdLevel = 'Число ≥ 0';
      if (!isPosInt(f.failThresholdSegments))
        e.failThresholdSegments = 'Целое число ≥ 0';
    }
    return e;
  };

  // ----- мутации -----
  const createMutation = useMutation({
    mutationFn: (payload: CreateTestTypeDto) => testTypeApi.create(payload),
    onSuccess: (res, variables) => {
       
      console.info('[TestTypesPage][createMutation] ok', {
        payload: variables,
        response: res?.data,
      });
      setSnackbar({ open: true, message: 'Тип теста создан', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['test-types'] });
    },
    onError: (err: unknown, variables) => {
      const fe = extractFieldErrors(err);
      const msg = logError(err, {
        scope: 'createMutation',
        extra: { payload: variables },
      });

      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        setSnackbar({
          open: true,
          message: 'Проверьте правильность заполнения полей',
          severity: 'error',
        });
      } else {
        setSnackbar({ open: true, message: msg, severity: 'error' });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTestTypeDto }) =>
      testTypeApi.update(id, data),
    onSuccess: (res, variables) => {
       
      console.info('[TestTypesPage][updateMutation] ok', {
        id: variables?.id,
        payload: variables?.data,
        response: res?.data,
      });
      setSnackbar({ open: true, message: 'Тип теста обновлён', severity: 'success' });
      setEditDialogOpen(false);
      setEditing(null);
      setForm(defaultForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['test-types'] });
    },
    onError: (err: unknown, variables) => {
      const fe = extractFieldErrors(err);
      const msg = logError(err, {
        scope: 'updateMutation',
        extra: { id: variables?.id, payload: variables?.data },
      });

      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        setSnackbar({
          open: true,
          message: 'Проверьте правильность заполнения полей',
          severity: 'error',
        });
      } else {
        setSnackbar({ open: true, message: msg, severity: 'error' });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => testTypeApi.delete(id),
    onSuccess: (res, id) => {
       
      console.info('[TestTypesPage][deleteMutation] ok, id =', id, {
        response: res?.data,
      });
      setSnackbar({ open: true, message: 'Тип теста удалён', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['test-types'] });
    },
    onError: (err: unknown, id) => {
      const msg = logError(err, {
        scope: 'deleteMutation',
        extra: { id },
      });
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // ----- обработчики -----
  const handleCreate = () => {
    const errors = validateForm(form);
    if (Object.keys(errors).length) {
       
      console.warn('[TestTypesPage][handleCreate] client validation failed:', errors);
      setFieldErrors(errors);
      return;
    }
    const payload = formToCreateDto(form);
     
    console.info('[TestTypesPage][handleCreate] sending payload:', payload);
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editing) return;
    const errors = validateForm(form);
    if (Object.keys(errors).length) {
       
      console.warn('[TestTypesPage][handleUpdate] client validation failed:', errors);
      setFieldErrors(errors);
      return;
    }
    const payload = formToUpdateDto(form);
     
    console.info('[TestTypesPage][handleUpdate] sending payload:', {
      id: editing.id,
      data: payload,
    });
    updateMutation.mutate({ id: editing.id, data: payload });
  };

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setCreateDialogOpen(true);
  };

  const handleOpenEdit = (t: TestType) => {
    setEditing(t);
    setForm({
      name: t.name,
      gender: t.gender as Gender,
      parameter: t.parameter,
      failThresholdTime: t.failThresholdTime != null ? String(t.failThresholdTime) : '',
      failThresholdLevel: t.failThresholdLevel != null ? String(t.failThresholdLevel) : '',
      failThresholdSegments:
        t.failThresholdSegments != null ? String(t.failThresholdSegments) : '',
      attemptsCount: t.attemptsCount != null ? String(t.attemptsCount) : '1',
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
     
    console.info('[TestTypesPage] open delete dialog, id =', id);
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteId) {
       
      console.warn('[TestTypesPage] confirm delete, but deleteId is null');
      return;
    }
     
    console.info('[TestTypesPage] confirm delete, id =', deleteId);
    deleteMutation.mutate(deleteId);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setQueryName('');
    setGenderFilter('');
    setOffset(0);
  };

  const handleFieldChange = <K extends keyof Form>(field: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleOpenGrades = (id: string) => {
    navigate(`/test-types/${id}/grades`);
  };

  const nextPage = () => setOffset((prev) => Math.min(prev + LIMIT, Math.max(0, total - LIMIT)));
  const prevPage = () => setOffset((prev) => Math.max(0, prev - LIMIT));

  // ----- рендер диалога (create/edit) -----
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
            label="Название *"
            value={form.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name || ''}
            fullWidth
            disabled={isPending}
          />

          <FormControl fullWidth disabled={isPending}>
            <InputLabel>Пол *</InputLabel>
            <Select
              value={form.gender}
              label="Пол *"
              onChange={(e) => handleFieldChange('gender', e.target.value as Gender)}
            >
              <MenuItem value="male">Мужской</MenuItem>
              <MenuItem value="female">Женский</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={isPending}>
            <InputLabel>Тип теста *</InputLabel>
            <Select
              value={form.parameter}
              label="Тип теста *"
              onChange={(e) =>
                handleFieldChange('parameter', e.target.value as TestParameter)
              }
            >
              <MenuItem value="time">По времени</MenuItem>
              <MenuItem value="segments">По отрезкам</MenuItem>
              <MenuItem value="level">По уровню + отрезкам</MenuItem>
            </Select>
          </FormControl>

          {form.parameter === 'time' && (
            <>
              <TextField
                label="Порог несдачи (время) *"
                type="number"
                value={form.failThresholdTime}
                onChange={(e) => handleFieldChange('failThresholdTime', e.target.value)}
                error={!!fieldErrors.failThresholdTime}
                helperText={fieldErrors.failThresholdTime || ''}
                fullWidth
                disabled={isPending}
                slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
              />
              <TextField
                label="Количество попыток *"
                type="number"
                value={form.attemptsCount}
                onChange={(e) => handleFieldChange('attemptsCount', e.target.value)}
                error={!!fieldErrors.attemptsCount}
                helperText={fieldErrors.attemptsCount || ''}
                fullWidth
                disabled={isPending}
                slotProps={{ htmlInput: { step: '1', min: 1 } }}
              />
            </>
          )}

          {form.parameter === 'segments' && (
            <TextField
              label="Порог несдачи (отрезки) *"
              type="number"
              value={form.failThresholdSegments}
              onChange={(e) => handleFieldChange('failThresholdSegments', e.target.value)}
              error={!!fieldErrors.failThresholdSegments}
              helperText={fieldErrors.failThresholdSegments || ''}
              fullWidth
              disabled={isPending}
              slotProps={{ htmlInput: { step: '1', min: 0 } }}
            />
          )}

          {form.parameter === 'level' && (
            <>
              <TextField
                label="Порог несдачи (уровень) *"
                type="number"
                value={form.failThresholdLevel}
                onChange={(e) => handleFieldChange('failThresholdLevel', e.target.value)}
                error={!!fieldErrors.failThresholdLevel}
                helperText={fieldErrors.failThresholdLevel || ''}
                fullWidth
                disabled={isPending}
                slotProps={{ htmlInput: { step: '0.1', min: 0 } }}
              />
              <TextField
                label="Порог несдачи (отрезки) *"
                type="number"
                value={form.failThresholdSegments}
                onChange={(e) => handleFieldChange('failThresholdSegments', e.target.value)}
                error={!!fieldErrors.failThresholdSegments}
                helperText={fieldErrors.failThresholdSegments || ''}
                fullWidth
                disabled={isPending}
                slotProps={{ htmlInput: { step: '1', min: 0 } }}
              />
            </>
          )}
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Типы тестов
      </Typography>

      {/* Панель поиска */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Поиск по названию..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ flex: 1, minWidth: 180 }}
          autoComplete="off"
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
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Пол</InputLabel>
          <Select
            value={genderFilter}
            label="Пол"
            onChange={(e) => {
              setGenderFilter(e.target.value as '' | Gender);
              setOffset(0);
            }}
          >
            <MenuItem value="">Все</MenuItem>
            <MenuItem value="male">Мужской</MenuItem>
            <MenuItem value="female">Женский</MenuItem>
          </Select>
        </FormControl>
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
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Создать
        </Button>
      </Paper>

      {/* Таблица */}
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error instanceof AxiosError
              ? error.response?.data?.message || 'Не удалось загрузить типы тестов'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : testTypes.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Типы тестов не найдены
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Пол</TableCell>
                    <TableCell>Параметр</TableCell>
                    <TableCell>Порог</TableCell>
                    <TableCell>Попыток</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testTypes.map((t) => {
                    let thresholdText = '—';
                    if (t.parameter === 'time' && t.failThresholdTime != null) {
                      thresholdText = `≤ ${t.failThresholdTime}`;
                    } else if (t.parameter === 'segments' && t.failThresholdSegments != null) {
                      thresholdText = `${t.failThresholdSegments} отр.`;
                    } else if (
                      t.parameter === 'level' &&
                      t.failThresholdLevel != null &&
                      t.failThresholdSegments != null
                    ) {
                      thresholdText = `ур. ${t.failThresholdLevel}, ${t.failThresholdSegments} отр.`;
                    }

                    return (
                      <TableRow key={t.id}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.gender === 'male' ? 'Мужской' : 'Женский'}</TableCell>
                        <TableCell>
                          <Chip
                            label={parameterLabels[t.parameter]}
                            color={parameterColors[t.parameter]}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{thresholdText}</TableCell>
                        <TableCell>{t.attemptsCount ?? '—'}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                            <Tooltip title="Градации">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenGrades(t.id)}
                              >
                                <GradeIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Редактировать">
                              <IconButton size="small" onClick={() => handleOpenEdit(t)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(t.id)}
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

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Всего: {total} типов
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={prevPage}
                  disabled={offset === 0 || isFetching}
                  variant="outlined"
                  size="small"
                >
                  Назад
                </Button>
                <Button
                  onClick={nextPage}
                  disabled={offset + LIMIT >= total || isFetching}
                  variant="outlined"
                  size="small"
                >
                  Вперёд
                </Button>
              </Box>
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

      {/* Диалоги */}
      {renderDialog(
        createDialogOpen,
        () => setCreateDialogOpen(false),
        handleCreate,
        'Создание типа теста',
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
        'Редактирование типа теста',
        'Сохранить',
        updateMutation.isPending,
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить этот тип теста? Действие необратимо.
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
