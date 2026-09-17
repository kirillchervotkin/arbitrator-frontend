// src/components/ImportResultsDialog.tsx
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { AxiosError } from 'axios';
import * as XLSX from 'xlsx';
import { resultApi } from '../services/api';
import { type CampUserDto, type TestType } from '../types';

// ============================================================
// Типы
// ============================================================

type SlotKey = string;

type PreviewCell = {
  value: number | null;
  /** Для level-теста — вторая метрика (segments). */
  segments: number | null;
  /** Есть ли в этой ячейке данные (не пустая). */
  filled: boolean;
  /** Зачтён / не зачтён — на каждую ячейку отдельно. */
  credited: boolean;
  /** Из какой строки Excel пришло — только для отладки. */
  rawTrial: number | null;
};

type PreviewUserRow = {
  /** Локальный id для React key. */
  id: string;
  /** Bib из файла. */
  bibRaw: string;
  /** ФИО из файла — только для отображения. */
  nameRaw: string;
  /** Найденный пользователь лагеря или null. */
  userId: string | null;
  /** Текст ошибки (пусто, если всё ок). */
  error?: string;
  /** Значения по слотам. Ключ = "main-1" | "ten-1" | "single". */
  cells: Record<SlotKey, PreviewCell>;
};

// ============================================================
// Утилиты
// ============================================================

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n =
    typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toLegNumber(v: unknown): number {
  const n = toNum(v);
  return n === null || n < 1 ? 1 : Math.floor(n);
}

function tryMatchByBib(
  bibRaw: string,
  participants: CampUserDto[],
): CampUserDto | null {
  const bib = bibRaw.trim();
  if (!bib) return null;
  return participants.find((p) => String(p.bib) === bib) ?? null;
}

function emptyCell(): PreviewCell {
  return {
    value: null,
    segments: null,
    filled: false,
    credited: true,
    rawTrial: null,
  };
}

function slotKeyMain(leg: number): SlotKey {
  return `main-${leg}`;
}

function slotKeyTen(leg: number): SlotKey {
  return `ten-${leg}`;
}

const SINGLE_SLOT: SlotKey = 'single';

// ============================================================
// Парсер Excel → PreviewUserRow[]
// ============================================================

function parseRows(
  raw: Record<string, unknown>[],
  participants: CampUserDto[],
  testType: TestType,
  attemptsCount: number,
): PreviewUserRow[] {
  type Accum = {
    id: string;
    bibRaw: string;
    nameRaw: string;
    userId: string | null;
    error?: string;
    cells: Record<SlotKey, PreviewCell>;
  };

  const byBib = new Map<string, Accum>();
  const order: string[] = [];

  for (const r of raw) {
    const nameRaw = String(r['Name'] ?? '').trim();
    if (!nameRaw) continue;

    const bibRaw = String(r['Bib'] ?? '').trim();
    const user = tryMatchByBib(bibRaw, participants);

    const legNumber = toLegNumber(r['Trial']);
    const time = toNum(r['Time']);
    const level = toNum(r['Level']);
    const segments = toNum(r['Segments']);

    const groupKey = bibRaw || `no-bib:${nameRaw}`;

    let acc = byBib.get(groupKey);
    if (!acc) {
      let error: string | undefined;
      if (!bibRaw) error = 'Не указан Bib';
      else if (!user) error = `Bib ${bibRaw} не найден в лагере`;

      acc = {
        id: `${Date.now()}-${order.length}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        bibRaw,
        nameRaw,
        userId: user?.id ?? null,
        error,
        cells: {},
      };
      byBib.set(groupKey, acc);
      order.push(groupKey);
    }

    const key: SlotKey =
      testType.parameter === 'time'
        ? slotKeyMain(legNumber)
        : SINGLE_SLOT;

    const cell: PreviewCell = (() => {
      if (testType.parameter === 'time') {
        return {
          value: time,
          segments: null,
          filled: time !== null,
          credited: true,
          rawTrial: legNumber,
        };
      }
      if (testType.parameter === 'segments') {
        return {
          value: segments,
          segments: null,
          filled: segments !== null,
          credited: true,
          rawTrial: legNumber,
        };
      }
      // level
      return {
        value: level,
        segments,
        filled: level !== null || segments !== null,
        credited: true,
        rawTrial: legNumber,
      };
    })();

    acc.cells[key] = cell;
  }

  const totalSlots = attemptsCount + 1;

  const rows: PreviewUserRow[] = order.map((k) => {
    const acc = byBib.get(k)!;

    if (testType.parameter === 'time') {
      for (let leg = 1; leg <= totalSlots; leg++) {
        const km = slotKeyMain(leg);
        if (!acc.cells[km]) acc.cells[km] = emptyCell();
        const kt = slotKeyTen(leg);
        if (!acc.cells[kt]) acc.cells[kt] = emptyCell();
      }
    } else if (!acc.cells[SINGLE_SLOT]) {
      acc.cells[SINGLE_SLOT] = emptyCell();
    }

    return {
      id: acc.id,
      bibRaw: acc.bibRaw,
      nameRaw: acc.nameRaw,
      userId: acc.userId,
      error: acc.error,
      cells: acc.cells,
    };
  });

  return rows;
}

// ============================================================
// Компонент
// ============================================================

export function ImportResultsDialog({
  open,
  onClose,
  campId,
  testType,
  participants,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  campId: string;
  testType: TestType | null;
  participants: CampUserDto[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<PreviewUserRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const attemptsCount = testType?.attemptsCount ?? 3;
  const totalSlots = attemptsCount + 1;
  const isTimeTest = testType?.parameter === 'time';
  const isSegmentsTest = testType?.parameter === 'segments';
  const isLevelTest = testType?.parameter === 'level';

  const slotLegs = Array.from({ length: totalSlots }, (_, i) => i + 1);

  const reset = () => {
    setRows([]);
    setFileName('');
    setIsSaving(false);
  };

  const handleClose = () => {
    if (isSaving) return;
    reset();
    onClose();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !testType) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: null,
        raw: false,
      });
      const parsed = parseRows(data, participants, testType, attemptsCount);
      setRows(parsed);
      setFileName(file.name);

      if (parsed.length === 0) {
        setSnackbar({
          open: true,
          message:
            'В файле не найдено ни одной строки со спортсменом. ' +
            'Проверьте колонку Name.',
          severity: 'error',
        });
      }
    } catch (err) {
       
      console.error(err);
      setSnackbar({
        open: true,
        message: 'Не удалось прочитать файл',
        severity: 'error',
      });
    } finally {
      e.target.value = '';
    }
  };

  const rematch = (row: PreviewUserRow): PreviewUserRow => {
    const user = tryMatchByBib(row.bibRaw, participants);
    let error: string | undefined;
    if (!row.bibRaw.trim()) error = 'Не указан Bib';
    else if (!user) error = `Bib ${row.bibRaw.trim()} не найден в лагере`;
    return { ...row, userId: user?.id ?? null, error };
  };

  const updateBib = (id: string, bibRaw: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? rematch({ ...r, bibRaw }) : r)),
    );
  };

  const updateCell = (
    id: string,
    key: SlotKey,
    patch: Partial<PreviewCell>,
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const current = r.cells[key] ?? emptyCell();
        const next = { ...current, ...patch };
        next.filled = next.value !== null || next.segments !== null;
        return { ...r, cells: { ...r.cells, [key]: next } };
      }),
    );
  };

  /** Переключить статус зачтён/не зачтён у конкретной ячейки. */
  const toggleCredited = (id: string, key: SlotKey) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const current = r.cells[key] ?? emptyCell();
        return {
          ...r,
          cells: {
            ...r.cells,
            [key]: { ...current, credited: !current.credited },
          },
        };
      }),
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    if (!testType) return;

    const validRows = rows.filter((r) => r.userId && !r.error);
    if (validRows.length === 0) {
      setSnackbar({
        open: true,
        message: 'Нет валидных строк для сохранения',
        severity: 'error',
      });
      return;
    }

    const byUser = new Map<
      string,
      {
        userId: string;
        items: Array<{
          isTen: boolean;
          legNumber: number;
          status: 'completed' | 'not_credited';
          time: number | null;
          level: number | null;
          segments: number | null;
        }>;
      }
    >();

    for (const r of validRows) {
      if (!r.userId) continue;

      const items: Array<{
        isTen: boolean;
        legNumber: number;
        status: 'completed' | 'not_credited';
        time: number | null;
        level: number | null;
        segments: number | null;
      }> = [];

      if (isTimeTest) {
        for (const leg of slotLegs) {
          const mainCell = r.cells[slotKeyMain(leg)];
          if (mainCell?.filled) {
            items.push({
              isTen: false,
              legNumber: leg,
              status: mainCell.credited ? 'completed' : 'not_credited',
              time: mainCell.value,
              level: null,
              segments: null,
            });
          }
          const tenCell = r.cells[slotKeyTen(leg)];
          if (tenCell?.filled) {
            items.push({
              isTen: true,
              legNumber: leg,
              status: tenCell.credited ? 'completed' : 'not_credited',
              time: tenCell.value,
              level: null,
              segments: null,
            });
          }
        }
      } else if (isSegmentsTest) {
        const cell = r.cells[SINGLE_SLOT];
        if (cell?.filled) {
          items.push({
            isTen: false,
            legNumber: 1,
            status: cell.credited ? 'completed' : 'not_credited',
            time: null,
            level: null,
            segments: cell.value,
          });
        }
      } else {
        // level
        const cell = r.cells[SINGLE_SLOT];
        if (cell?.filled) {
          items.push({
            isTen: false,
            legNumber: 1,
            status: cell.credited ? 'completed' : 'not_credited',
            time: null,
            level: cell.value,
            segments: cell.segments,
          });
        }
      }

      if (items.length === 0) continue;

      const entry = byUser.get(r.userId) ?? { userId: r.userId, items: [] };
      entry.items.push(...items);
      byUser.set(r.userId, entry);
    }

    const totalItems = [...byUser.values()].reduce(
      (acc, u) => acc + u.items.length,
      0,
    );

    if (totalItems === 0) {
      setSnackbar({
        open: true,
        message: 'Нет заполненных ячеек для сохранения',
        severity: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      await resultApi.uploadBulk(campId, {
        users: [...byUser.values()],
        testTypeIds: [testType.id],
      });

      setSnackbar({
        open: true,
        message: `Сохранено результатов: ${totalItems}`,
        severity: 'success',
      });
      onSaved();
      reset();
      onClose();
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message || 'Ошибка сохранения'
          : 'Неизвестная ошибка';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const validCount = rows.filter((r) => r.userId && !r.error).length;
  const errorCount = rows.length - validCount;

  /**
   * Рендер ячейки слот-значения: поле ввода + чип зачтён/не зачтён.
   */
  const renderCell = (
    row: PreviewUserRow,
    key: SlotKey,
    opts: { isLevelSecond?: boolean } = {},
  ) => {
    const cell = row.cells[key] ?? emptyCell();
    const value = opts.isLevelSecond ? cell.segments : cell.value;
    const onChangeValue = (raw: string) => {
      const parsed = raw === '' ? null : Number(raw);
      if (opts.isLevelSecond) {
        updateCell(row.id, key, { segments: parsed });
      } else {
        updateCell(row.id, key, { value: parsed });
      }
    };

    return (
      <Stack spacing={0.5} sx={{ alignItems: 'stretch' }}>
        <TextField
          size="small"
          type="number"
          value={value ?? ''}
          placeholder="—"
          onChange={(e) => onChangeValue(e.target.value)}
          slotProps={{
            htmlInput: {
              step: opts.isLevelSecond || isSegmentsTest ? '1' : '0.01',
              min: 0,
            },
          }}
          sx={{ width: '100%', minWidth: 90 }}
        />
        <Chip
          size="small"
          variant={cell.credited ? 'filled' : 'outlined'}
          color={cell.credited ? 'success' : 'warning'}
          label={cell.credited ? 'Зачтён' : 'Не зачтён'}
          onClick={() => toggleCredited(row.id, key)}
          sx={{
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 11,
            height: 22,
            '& .MuiChip-label': { px: 1 },
          }}
        />
      </Stack>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xl"
        fullWidth
        slotProps={{ paper: { sx: { height: '85vh' } } }}
      >
        <DialogTitle>
          Импорт результатов из Excel
          {testType && (
            <Typography
              variant="body2"
              color="text.secondary"
              component="div"
              sx={{ mt: 0.5 }}
            >
              Тест: <b>{testType.name}</b>
            </Typography>
          )}
        </DialogTitle>

        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              disabled={isSaving}
            >
              Выбрать файл
              <input
                type="file"
                hidden
                accept=".xlsx,.xls,.xml"
                onChange={handleFile}
              />
            </Button>

            {fileName && (
              <Typography variant="body2" color="text.secondary">
                {fileName}
              </Typography>
            )}

            {rows.length > 0 && (
              <Stack direction="row" spacing={1}>
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label={`Валидных: ${validCount}`}
                />
                {errorCount > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    variant="outlined"
                    label={`Ошибок: ${errorCount}`}
                  />
                )}
              </Stack>
            )}
          </Stack>

          {rows.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Выберите Excel-файл для предпросмотра
              </Typography>
            </Box>
          ) : (
            <TableContainer
              sx={{ flex: 1, border: '1px solid', borderColor: 'divider' }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  {isTimeTest ? (
                    <>
                      <TableRow>
                        <TableCell
                          rowSpan={2}
                          sx={{
                            fontWeight: 600,
                            minWidth: 90,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          Bib
                        </TableCell>
                        <TableCell
                          rowSpan={2}
                          sx={{
                            fontWeight: 600,
                            minWidth: 200,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          Спортсмен (из файла)
                        </TableCell>
                        <TableCell
                          colSpan={totalSlots}
                          align="center"
                          sx={{ fontWeight: 600 }}
                        >
                          Основной
                        </TableCell>
                        <TableCell
                          colSpan={totalSlots}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            borderLeft: '2px solid',
                            borderColor: 'divider',
                          }}
                        >
                          10 м
                        </TableCell>
                        <TableCell
                          rowSpan={2}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          Действия
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        {slotLegs.map((leg) => (
                          <TableCell
                            key={`h-main-${leg}`}
                            align="center"
                            sx={{ minWidth: 100 }}
                          >
                            {leg === totalSlots ? 'Пересдача' : `Забег ${leg}`}
                          </TableCell>
                        ))}
                        {slotLegs.map((leg) => (
                          <TableCell
                            key={`h-ten-${leg}`}
                            align="center"
                            sx={{
                              minWidth: 100,
                              borderLeft:
                                leg === 1 ? '2px solid' : undefined,
                              borderColor: 'divider',
                            }}
                          >
                            {leg === totalSlots ? 'Пересдача' : `Забег ${leg}`}
                          </TableCell>
                        ))}
                      </TableRow>
                    </>
                  ) : isSegmentsTest ? (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, minWidth: 90 }}>
                        Bib
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          minWidth: 200,
                          borderRight: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Спортсмен (из файла)
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 600,
                          minWidth: 140,
                          borderLeft: '2px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Отрезки
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 600,
                          borderLeft: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Действия
                      </TableCell>
                    </TableRow>
                  ) : (
                    // isLevelTest
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, minWidth: 90 }}>
                        Bib
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          minWidth: 200,
                          borderRight: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Спортсмен (из файла)
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 600,
                          minWidth: 120,
                          borderLeft: '2px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Уровень
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ fontWeight: 600, minWidth: 120 }}
                      >
                        Отрезки
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 600,
                          borderLeft: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        Действия
                      </TableCell>
                    </TableRow>
                  )}
                </TableHead>
                <TableBody>
                  {rows.map((r) => {
                    const hasError = !!r.error;
                    const rowBg = hasError
                      ? 'rgba(244, 67, 54, 0.08)'
                      : undefined;

                    return (
                      <TableRow key={r.id} sx={{ backgroundColor: rowBg }}>
                        <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <TextField
                            size="small"
                            value={r.bibRaw}
                            error={hasError}
                            onChange={(e) =>
                              updateBib(r.id, e.target.value)
                            }
                            sx={{ width: 80 }}
                          />
                        </TableCell>

                        <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <Typography variant="body2">
                            {r.nameRaw || '—'}
                          </Typography>
                          {hasError && (
                            <Typography
                              variant="caption"
                              color="error"
                              sx={{ display: 'block' }}
                            >
                              {r.error}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Ячейки значений по слотам */}
                        {isTimeTest && (
                          <>
                            {slotLegs.map((leg) => (
                              <TableCell
                                key={`cell-main-${r.id}-${leg}`}
                                sx={{ p: 0.5, verticalAlign: 'top' }}
                              >
                                {renderCell(r, slotKeyMain(leg))}
                              </TableCell>
                            ))}

                            {slotLegs.map((leg) => (
                              <TableCell
                                key={`cell-ten-${r.id}-${leg}`}
                                sx={{
                                  p: 0.5,
                                  verticalAlign: 'top',
                                  borderLeft:
                                    leg === 1
                                      ? '2px solid'
                                      : undefined,
                                  borderColor: 'divider',
                                }}
                              >
                                {renderCell(r, slotKeyTen(leg))}
                              </TableCell>
                            ))}
                          </>
                        )}

                        {isSegmentsTest && (
                          <TableCell
                            sx={{
                              p: 0.5,
                              verticalAlign: 'top',
                              borderLeft: '2px solid',
                              borderColor: 'divider',
                            }}
                          >
                            {renderCell(r, SINGLE_SLOT)}
                          </TableCell>
                        )}

                        {isLevelTest && (
                          <>
                            <TableCell
                              sx={{
                                p: 0.5,
                                verticalAlign: 'top',
                                borderLeft: '2px solid',
                                borderColor: 'divider',
                              }}
                            >
                              {renderCell(r, SINGLE_SLOT)}
                            </TableCell>
                            <TableCell
                              sx={{ p: 0.5, verticalAlign: 'top' }}
                            >
                              {renderCell(r, SINGLE_SLOT, {
                                isLevelSecond: true,
                              })}
                            </TableCell>
                          </>
                        )}

                        <TableCell
                          align="center"
                          sx={{
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                            verticalAlign: 'top',
                            pt: 1.5,
                          }}
                        >
                          <Tooltip title="Удалить спортсмена из превью">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeRow(r.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mr: 'auto' }}
          >
            {rows.length > 0 && `Спортсменов: ${rows.length}`}
          </Typography>

          <Button onClick={handleClose} disabled={isSaving}>
            Отмена
          </Button>

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving || validCount === 0}
          >
            {isSaving ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              `Сохранить (${validCount})`
            )}
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
    </>
  );
}
