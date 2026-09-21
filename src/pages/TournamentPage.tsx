import { competitionPageSx } from '../components/competition/competitionStyles';
// src/pages/TournamentPage.tsx

import { useState, useMemo } from 'react';
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
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  CalendarToday as CalendarIcon,
  SportsSoccer as SportsSoccerIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { tournamentApi, stageApi } from '../services/api';
import {
  Tournament,
  Stage,
  CreateStageDto,
  UpdateStageDto,
  StageType,
  StageFormat,
  InvalidParam,
} from '../types';

// ------------------------------------------------------------------
// Справочники отображения
// ------------------------------------------------------------------

const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  LEAGUE: 'Чемпионат',
  CUP: 'Кубок',
  SUPER_CUP: 'Суперкубок',
};

const STAGE_TYPE_LABELS: Record<StageType, string> = {
  STAGE: 'Этап',
  GROUP: 'Группа',
  ROUND: 'Раунд',
  PLAYOFF: 'Плей-офф',
};

const STAGE_TYPE_COLORS: Record<
  StageType,
  'default' | 'primary' | 'secondary' | 'warning'
> = {
  STAGE: 'default',
  GROUP: 'primary',
  ROUND: 'secondary',
  PLAYOFF: 'warning',
};

const STAGE_FORMAT_LABELS: Record<StageFormat, string> = {
  ROUND_ROBIN: 'Круговой',
  ELIMINATION: 'Олимпийская система',
};

// ------------------------------------------------------------------
// Хелпер: какому type соответствует какой format
// ------------------------------------------------------------------

function allowedFormatsFor(type: StageType): StageFormat[] {
  if (type === 'GROUP') return ['ROUND_ROBIN'];
  if (type === 'ROUND') return ['ELIMINATION'];
  return []; // STAGE, PLAYOFF — контейнеры, format = null
}

function isContainer(type: StageType): boolean {
  return type === 'STAGE' || type === 'PLAYOFF';
}

// ------------------------------------------------------------------
// Форма этапа
// ------------------------------------------------------------------

type StageForm = {
  name: string;
  type: StageType;
  format: StageFormat | '';
  parentStageId: string;
  sortOrder: string;
  settings: string; // JSON как текст
};

const defaultStageForm: StageForm = {
  name: '',
  type: 'GROUP',
  format: 'ROUND_ROBIN',
  parentStageId: '',
  sortOrder: '0',
  settings: '',
};

type FieldErrors = {
  name?: string;
  type?: string;
  format?: string;
  parentStageId?: string;
  sortOrder?: string;
  settings?: string;
};

// ------------------------------------------------------------------
// Утилиты
// ------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ------------------------------------------------------------------
// Страница
// ------------------------------------------------------------------

export default function TournamentPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Диалоги ---
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [form, setForm] = useState<StageForm>(defaultStageForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // --- Удаление ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteStageId, setDeleteStageId] = useState<string | null>(null);

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

  // --- Запрос турнира ---
  const {
    data: tournament,
    isLoading: isTournamentLoading,
    isError: isTournamentError,
    error: tournamentError,
  } = useQuery<Tournament>({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const res = await tournamentApi.getById(tournamentId!);
      return res.data;
    },
    enabled: !!tournamentId,
  });

  // --- Запрос этапов ---
  const {
    data: stages = [],
    isLoading: isStagesLoading,
    isFetching: isStagesFetching,
    isError: isStagesError,
    error: stagesError,
    refetch: refetchStages,
  } = useQuery<Stage[]>({
    queryKey: ['stages', tournamentId],
    queryFn: async () => {
      const res = await stageApi.getAll(tournamentId!);
      return res.data;
    },
    enabled: !!tournamentId,
  });

  // --- Мапа этапов для отображения parentStageId ---
  const stageMap = useMemo(() => {
    const map = new Map<string, Stage>();
    for (const s of stages) map.set(s.id, s);
    return map;
  }, [stages]);

  // Сортированные этапы: сначала корневые, потом дочерние
  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => {
      // Корневые — наверх
      if (a.parentStageId === null && b.parentStageId !== null) return -1;
      if (a.parentStageId !== null && b.parentStageId === null) return 1;
      // Дальше по sortOrder
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
  }, [stages]);

  // --- Извлечение ошибок полей ---
  const extractFieldErrors = (err: unknown): FieldErrors => {
    const errors: FieldErrors = {};
    if (err instanceof AxiosError && err.response?.data?.invalid_params) {
      const invalidParams = err.response.data.invalid_params as InvalidParam[];
      for (const param of invalidParams) {
        const firstError = param.errors[0];
        if (firstError && param.name in defaultStageForm) {
          errors[param.name as keyof FieldErrors] = firstError.reason;
        }
      }
    }
    return errors;
  };

  // --- Мутации ---

  const createMutation = useMutation({
    mutationFn: (payload: CreateStageDto) =>
      stageApi.create(tournamentId!, payload),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Этап создан', severity: 'success' });
      setCreateDialogOpen(false);
      setForm(defaultStageForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['stages', tournamentId] });
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
    mutationFn: ({
      stageId,
      data,
    }: {
      stageId: string;
      data: UpdateStageDto;
    }) => stageApi.update(tournamentId!, stageId, data),
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Этап обновлён',
        severity: 'success',
      });
      setEditDialogOpen(false);
      setEditingStage(null);
      setForm(defaultStageForm);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['stages', tournamentId] });
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
    mutationFn: (stageId: string) => stageApi.remove(tournamentId!, stageId),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Этап удалён', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteStageId(null);
      queryClient.invalidateQueries({ queryKey: ['stages', tournamentId] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ||
            'Невозможно удалить: у этапа есть дочерние этапы или матчи'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // --- Обработчики ---

  const handleCreate = () => {
    const payload: CreateStageDto = {
      name: form.name.trim(),
      type: form.type,
      format: isContainer(form.type) ? null : (form.format as StageFormat),
      parentStageId: form.parentStageId || null,
      sortOrder: Number(form.sortOrder) || 0,
      settings: form.settings.trim() ? safeParseJson(form.settings) : null,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editingStage) return;

    const payload: UpdateStageDto = {
      name: form.name.trim(),
      type: form.type,
      format: isContainer(form.type) ? null : (form.format as StageFormat),
      parentStageId: form.parentStageId || null,
      sortOrder: Number(form.sortOrder) || 0,
      settings: form.settings.trim() ? safeParseJson(form.settings) : null,
    };
    updateMutation.mutate({ stageId: editingStage.id, data: payload });
  };

  const handleEditOpen = (stage: Stage) => {
    setEditingStage(stage);
    setForm({
      name: stage.name,
      type: stage.type,
      format: stage.format ?? '',
      parentStageId: stage.parentStageId ?? '',
      sortOrder: String(stage.sortOrder),
      settings: stage.settings ? JSON.stringify(stage.settings, null, 2) : '',
    });
    setFieldErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (stageId: string) => {
    setDeleteStageId(stageId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteStageId) deleteMutation.mutate(deleteStageId);
  };

  const handleFieldChange = (field: keyof StageForm, value: string) => {
    // При смене типа — автоматически подставляем корректный format
    if (field === 'type') {
      const newType = value as StageType;
      const allowed = allowedFormatsFor(newType);
      setForm((prev) => ({
        ...prev,
        type: newType,
        format: allowed.length > 0 ? allowed[0] : '',
      }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleOpenCreateDialog = () => {
    setForm(defaultStageForm);
    setFieldErrors({});
    setCreateDialogOpen(true);
  };

  const handleOpenMatches = (stageId?: string) => {
    const params = new URLSearchParams({ tournamentId: tournamentId! });
    if (stageId) params.set('stageId', stageId);
    navigate(`/matches?${params}`);
  };

  // ------------------------------------------------------------------
  // Состояния загрузки / ошибки
  // ------------------------------------------------------------------

  if (isTournamentLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isTournamentError || !tournament) {
    return (
      <Box sx={competitionPageSx}>
        <Alert severity="error">
          {tournamentError instanceof AxiosError
            ? tournamentError.response?.data?.message ||
              'Не удалось загрузить турнир'
            : 'Произошла неизвестная ошибка'}
        </Alert>
        <Button
          sx={{ mt: 2 }}
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/tournaments')}
        >
          К списку турниров
        </Button>
      </Box>
    );
  }

  // ------------------------------------------------------------------
  // Рендер формы этапа
  // ------------------------------------------------------------------

  const renderStageForm = (isPending: boolean) => {
    const container = isContainer(form.type);
    const allowedFormats = allowedFormatsFor(form.type);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        <TextField
          label="Название *"
          value={form.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          error={!!fieldErrors.name}
          helperText={fieldErrors.name || 'Например: Группа A, 1/4 финала'}
          fullWidth
          required
          disabled={isPending}
          autoComplete="off"
        />

        <TextField
          select
          label="Тип *"
          value={form.type}
          onChange={(e) => handleFieldChange('type', e.target.value)}
          error={!!fieldErrors.type}
          helperText={
            fieldErrors.type ||
            'Группа и раунд содержат матчи. Этап и плей-офф объединяют вложенные этапы.'
          }
          fullWidth
          required
          disabled={isPending}
        >
          <MenuItem value="STAGE">Этап — объединение групп</MenuItem>
          <MenuItem value="GROUP">Группа</MenuItem>
          <MenuItem value="ROUND">Раунд</MenuItem>
          <MenuItem value="PLAYOFF">Плей-офф — объединение раундов</MenuItem>
        </TextField>

        {!container && (
          <TextField
            select
            label="Формат *"
            value={form.format}
            onChange={(e) => handleFieldChange('format', e.target.value)}
            error={!!fieldErrors.format}
            helperText={
              fieldErrors.format ||
              'В группе команды играют по кругу, в раунде — на выбывание.'
            }
            fullWidth
            required
            disabled={isPending || allowedFormats.length <= 1}
          >
            {allowedFormats.map((f) => (
              <MenuItem key={f} value={f}>
                {STAGE_FORMAT_LABELS[f]}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          select
          label="Родительский этап"
          value={form.parentStageId}
          onChange={(e) => handleFieldChange('parentStageId', e.target.value)}
          error={!!fieldErrors.parentStageId}
          helperText={
            fieldErrors.parentStageId || 'Оставьте пустым, если этап корневой'
          }
          fullWidth
          disabled={isPending}
        >
          <MenuItem value="">
            <em>Без родительского этапа</em>
          </MenuItem>
          {stages
            .filter((s) => s.id !== editingStage?.id)
            .map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} ({STAGE_TYPE_LABELS[s.type]})
              </MenuItem>
            ))}
        </TextField>

        <TextField
          label="Порядок"
          type="number"
          value={form.sortOrder}
          onChange={(e) => handleFieldChange('sortOrder', e.target.value)}
          error={!!fieldErrors.sortOrder}
          helperText={fieldErrors.sortOrder || 'Чем меньше — тем выше в списке'}
          fullWidth
          disabled={isPending}
          slotProps={{ htmlInput: { min: 0 } }}
        />

        <Box
          component="details"
          open={fieldErrors.settings ? true : undefined}
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            pt: 2,
            '& summary': { cursor: 'pointer', fontWeight: 600, mb: 2 },
          }}
        >
          <summary>Дополнительные настройки регламента</summary>
          <TextField
            label="Настройки (JSON)"
            value={form.settings}
            onChange={(e) => handleFieldChange('settings', e.target.value)}
            error={!!fieldErrors.settings}
            helperText={
              fieldErrors.settings ||
              'Опционально. Например: {"rounds": 2, "pointsForWin": 3}'
            }
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            disabled={isPending}
            slotProps={{
              input: {
                style: { fontFamily: 'monospace', fontSize: 13 },
              },
            }}
          />
        </Box>
      </Box>
    );
  };

  // ------------------------------------------------------------------
  // Рендер
  // ------------------------------------------------------------------

  return (
    <Box sx={competitionPageSx}>
      {/* Шапка */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <IconButton
          aria-label="К списку турниров"
          onClick={() => navigate('/tournaments')}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {tournament.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Сезон {tournament.season}
          </Typography>
        </Box>
      </Box>

      {/* Карточка турнира */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
          }}
        >
          <Chip
            label={TOURNAMENT_TYPE_LABELS[tournament.type] ?? tournament.type}
            color="primary"
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {formatDate(tournament.startDate)} —{' '}
              {formatDate(tournament.endDate)}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ mb: 3 }}>
        <Button variant="outlined" onClick={() => handleOpenMatches()}>
          Открыть все матчи турнира
        </Button>
      </Box>
      {/* Список этапов */}
      <Paper sx={{ p: 3, position: 'relative' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <EventIcon />
            Этапы турнира
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={
                isStagesFetching ? (
                  <CircularProgress size={16} />
                ) : (
                  <RefreshIcon />
                )
              }
              onClick={() => refetchStages()}
              disabled={isStagesFetching}
            >
              Обновить
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateDialog}
            >
              Создать этап
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {isStagesError ? (
          <Alert severity="error">
            {stagesError instanceof AxiosError
              ? stagesError.response?.data?.message ||
                'Не удалось загрузить этапы'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : sortedStages.length === 0 && !isStagesLoading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              В турнире пока нет этапов. Создайте первый — например, «Групповой
              этап» или «Группа A».
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell>Формат</TableCell>
                  <TableCell>Родитель</TableCell>
                  <TableCell align="center">Порядок</TableCell>
                  <TableCell align="center">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedStages.map((s) => {
                  const parent = s.parentStageId
                    ? stageMap.get(s.parentStageId)
                    : null;

                  return (
                    <TableRow key={s.id} hover>
                      <TableCell data-label="Название">
                        <Typography
                          variant="body2"
                          sx={{
                            pl: s.parentStageId ? 3 : 0,
                            fontWeight: s.parentStageId ? 400 : 600,
                          }}
                        >
                          {s.parentStageId ? '└─ ' : ''}
                          {s.name}
                        </Typography>
                      </TableCell>
                      <TableCell data-label="Тип">
                        <Chip
                          label={STAGE_TYPE_LABELS[s.type]}
                          color={STAGE_TYPE_COLORS[s.type]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell data-label="Формат">
                        {s.format ? (
                          <Typography variant="body2">
                            {STAGE_FORMAT_LABELS[s.format]}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Контейнер
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell data-label="Родитель">
                        {parent ? (
                          <Typography variant="body2" color="text.secondary">
                            {parent.name}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell data-label="Порядок" align="center">
                        {s.sortOrder}
                      </TableCell>
                      <TableCell data-label="Действия" align="center">
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Tooltip title="Матчи этапа">
                            <IconButton
                              aria-label="Матчи этапа"
                              size="small"
                              color="primary"
                              onClick={() => handleOpenMatches(s.id)}
                            >
                              <SportsSoccerIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Редактировать">
                            <IconButton
                              aria-label="Редактировать"
                              size="small"
                              onClick={() => handleEditOpen(s)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              aria-label="Удалить"
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(s.id)}
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
        )}

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
          open={isStagesLoading || isStagesFetching}
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            Загрузка этапов...
          </Typography>
        </Backdrop>
      </Paper>

      {/* Диалог создания этапа */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Создание этапа</DialogTitle>
        <DialogContent>
          {renderStageForm(createMutation.isPending)}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            disabled={createMutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={createMutation.isPending || !form.name.trim()}
          >
            {createMutation.isPending ? (
              <CircularProgress size={24} />
            ) : (
              'Создать'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования этапа */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Редактирование этапа</DialogTitle>
        <DialogContent>
          {renderStageForm(updateMutation.isPending)}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditDialogOpen(false)}
            disabled={updateMutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={handleUpdate}
            variant="contained"
            disabled={updateMutation.isPending || !form.name.trim()}
          >
            {updateMutation.isPending ? (
              <CircularProgress size={24} />
            ) : (
              'Сохранить'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить этот этап? Если у него есть дочерние
            этапы — удаление будет отклонено.
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

// ------------------------------------------------------------------
// Вспомогательная функция: безопасный парсинг JSON
// ------------------------------------------------------------------

function safeParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
