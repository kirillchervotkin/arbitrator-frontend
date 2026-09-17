import { useState } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Snackbar,
  Backdrop,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { testTypeApi, listApi, trainingCampApi, standardsReportApi } from '../services/api';
import { TestType, List, TrainingCamp, StandardsReportItem } from '../types';

// ============================================================
// Вспомогательные функции (из парсера XML)
// ============================================================

const categoryNamesRu: Record<string, string> = {
  Excellent: 'Отлично',
  Good: 'Хорошо',
  Mediocre: 'Средне',
  Poor: 'Плохо',
  'Very Poor': 'Очень плохо',
};

function getCategory(sex: string, value: number | null, testName: string): string {
  if (value === null || isNaN(value)) return '';
  const val = value;
  const isMale = sex === 'M' || sex === 'Male';
  const t = testName.toLowerCase();

  if (t === 'coda') {
    if (isMale) {
      if (val > 10) return 'Very Poor';
      if (val >= 9.61) return 'Poor';
      if (val >= 9.41) return 'Mediocre';
      if (val >= 9.21) return 'Good';
      return 'Excellent';
    } else {
      if (val > 10.5) return 'Very Poor';
      if (val >= 10.2) return 'Poor';
      if (val >= 9.8) return 'Mediocre';
      if (val >= 9.51) return 'Good';
      return 'Excellent';
    }
  } else if (t === '20m') {
    if (isMale) {
      if (val > 3.3) return 'Very Poor';
      if (val >= 3.21) return 'Poor';
      if (val >= 3.11) return 'Mediocre';
      if (val >= 3.0) return 'Good';
      return 'Excellent';
    } else {
      if (val > 3.6) return 'Very Poor';
      if (val >= 3.51) return 'Poor';
      if (val >= 3.41) return 'Mediocre';
      if (val >= 3.3) return 'Good';
      return 'Excellent';
    }
  } else if (t === '30m') {
    if (isMale) {
      if (val > 4.51) return 'Very Poor';
      if (val >= 4.41) return 'Poor';
      if (val >= 4.31) return 'Mediocre';
      if (val >= 4.21) return 'Good';
      return 'Excellent';
    } else {
      if (val > 4.9) return 'Very Poor';
      if (val >= 4.81) return 'Poor';
      if (val >= 4.71) return 'Mediocre';
      if (val >= 4.61) return 'Good';
      return 'Excellent';
    }
  } else if (t === '40m') {
    if (isMale) {
      if (val < 5.4) return 'Excellent';
      if (val <= 5.59) return 'Good';
      if (val <= 5.79) return 'Mediocre';
      if (val <= 6) return 'Poor';
      return 'Very Poor';
    } else {
      if (val < 6) return 'Excellent';
      if (val <= 6.19) return 'Good';
      if (val <= 6.3) return 'Mediocre';
      if (val <= 6.4) return 'Poor';
      return 'Very Poor';
    }
  }
  return '';
}

function getCategory10m(sex: string, value: number | null): string {
  if (value === null || isNaN(value)) return '';
  const val = value;
  const isMale = sex === 'M' || sex === 'Male';
  if (isMale) {
    if (val < 1.65) return 'Excellent';
    if (val <= 1.70) return 'Good';
    if (val <= 1.75) return 'Mediocre';
    if (val <= 1.77) return 'Poor';
    return 'Very Poor';
  } else {
    if (val < 1.77) return 'Excellent';
    if (val <= 1.80) return 'Good';
    if (val <= 1.85) return 'Mediocre';
    if (val <= 1.87) return 'Poor';
    return 'Very Poor';
  }
}

function getTestStatus(
  trials: (number | null)[],
  testName: string,
  sex: string
): 'pass' | 'fail' {
  let limit: number;
  const isMale = sex === 'M' || sex === 'Male';
  switch (testName.toLowerCase()) {
    case 'coda':
      limit = isMale ? 10 : 11;
      break;
    case '20m':
      limit = isMale ? 3.3 : 3.6;
      break;
    case '30m':
      limit = isMale ? 4.6 : 5.1;
      break;
    case '40m':
      limit = isMale ? 6.0 : 6.4;
      break;
    default:
      return 'fail';
  }
  let successCount = 0;
  for (const v of trials) {
    if (v !== null && !isNaN(v) && v <= limit) successCount++;
  }
  return successCount >= 2 ? 'pass' : 'fail';
}

function computeAverage(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && !isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'Excellent': return '#c8e6c9';
    case 'Good':      return '#dcedc8';
    case 'Mediocre':  return '#fff9c4';
    case 'Poor':      return '#ffccbc';
    case 'Very Poor': return '#ffcdd2';
    default: return 'transparent';
  }
}

// ============================================================
// Компонент
// ============================================================

export default function StandardsReportPage() {
  const [selectedTestTypeId, setSelectedTestTypeId] = useState<string>('');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedCampId, setSelectedCampId] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data: testTypesData, isLoading: testTypesLoading } = useQuery({
    queryKey: ['testTypes'],
    queryFn: () => testTypeApi.getAll({ limit: 1000 }).then((res) => res.data),
  });
  const testTypes: TestType[] = testTypesData?.rows || [];

  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => listApi.getLists().then((res) => res.data),
  });
  const listItems: List[] = lists || [];

  const { data: campsData, isLoading: campsLoading } = useQuery({
    queryKey: ['trainingCamps'],
    queryFn: () => trainingCampApi.getAll({ limit: 1000 }).then((res) => res.data),
  });
  const camps: TrainingCamp[] = campsData?.rows || [];

  const selectedTestType = testTypes.find((t) => t.id === selectedTestTypeId);

  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
    isError: reportError,
    error: reportErrorObj,
    refetch,
  } = useQuery({
    queryKey: ['standardsReport', selectedTestTypeId, selectedListId, selectedCampId],
    queryFn: () =>
      standardsReportApi
        .getReport({
          testTypeId: selectedTestTypeId,
          listId: selectedListId,
          trainingCampId: selectedCampId || undefined,
        })
        .then((res) => res.data),
    enabled: !!selectedTestTypeId && !!selectedListId,
  });

  const reportItems: StandardsReportItem[] = reportData || [];

  // Решаем, показывать ли 10м колонки: только для тестов, отличных от CODA
  const testName = selectedTestType?.name?.toLowerCase() || '';
  const showLapColumns = testName !== 'coda';

  const [sexMap, setSexMap] = useState<Record<string, string>>({});

  const handleSexChange = (index: number, sex: string) => {
    setSexMap((prev) => ({ ...prev, [index]: sex }));
  };

  const isLoading = testTypesLoading || listsLoading || campsLoading || reportLoading || reportFetching;

  // ============================================================
  // Рендер таблицы
  // ============================================================

  const renderTable = () => {
    if (reportItems.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {selectedTestTypeId && selectedListId
              ? 'Нет данных для отображения'
              : 'Выберите тип теста и список пользователей'}
          </Typography>
        </Box>
      );
    }

    // Формируем заголовки (всегда фиксированные)
    const baseHeaders = ['№', 'ФИО', 'Пол', 'Попытка 1', 'Попытка 2', 'Попытка 3', 'Среднее'];
    const lapHeaders = showLapColumns
      ? ['10м П1', '10м П2', '10м П3', 'Ср. 10м']
      : [];
    const headers = [...baseHeaders, ...lapHeaders, 'Оценка', 'Статус'];

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {headers.map((h) => (
                <TableCell key={h} sx={{ fontWeight: 600, textAlign: 'center' }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {reportItems.map((item, idx) => {
              const sex = sexMap[idx] || item.sex || 'F';
              const trials = (item.times ?? []) as (number | null)[];
              const lapTrials = (item.times10m ?? []) as (number | null)[];

              const avgMain = computeAverage(trials);
              const avgLap = showLapColumns ? computeAverage(lapTrials) : null;

              const catMain = avgMain !== null ? getCategory(sex, avgMain, selectedTestType?.name || '') : '';
              const catLap = avgLap !== null ? getCategory10m(sex, avgLap) : '';
              const statusKey = getTestStatus(trials, selectedTestType?.name || '', sex);
              const statusText = statusKey === 'pass' ? 'Сдан' : 'Не сдан';
              const catNames = categoryNamesRu;

              const cellStyle = (cat: string) => ({
                backgroundColor: getCategoryColor(cat),
                textAlign: 'center' as const,
                padding: '4px 6px',
              });

              return (
                <TableRow key={idx}>
                  <TableCell sx={{ textAlign: 'center' }}>{idx + 1}</TableCell>
                  <TableCell>{`${item.lastName} ${item.firstName}`}</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Select
                      value={sex}
                      onChange={(e) => handleSexChange(idx, e.target.value)}
                      size="small"
                      sx={{ border: 'none', background: 'transparent', minWidth: 50 }}
                    >
                      <MenuItem value="M">M</MenuItem>
                      <MenuItem value="F">F</MenuItem>
                    </Select>
                  </TableCell>

                  {[0, 1, 2].map((i) => {
                    const val = trials[i] ?? null;
                    const cat = getCategory(sex, val, selectedTestType?.name || '');
                    return (
                      <TableCell key={`main-${i}`} sx={cellStyle(cat)}>
                        {val !== null ? val.toFixed(2) : ''}
                      </TableCell>
                    );
                  })}

                  <TableCell sx={cellStyle(catMain)}>
                    {avgMain !== null ? avgMain.toFixed(2) : ''}
                  </TableCell>

                  {showLapColumns && (
                    <>
                      {[0, 1, 2].map((i) => {
                        const val = lapTrials[i] ?? null;
                        const cat = getCategory10m(sex, val);
                        return (
                          <TableCell key={`lap-${i}`} sx={cellStyle(cat)}>
                            {val !== null ? val.toFixed(2) : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell sx={cellStyle(catLap)}>
                        {avgLap !== null ? avgLap.toFixed(2) : ''}
                      </TableCell>
                    </>
                  )}

                  <TableCell sx={cellStyle(catMain)}>
                    {catMain ? catNames[catMain] : ''}
                  </TableCell>
                  <TableCell
                    sx={{
                      backgroundColor: statusKey === 'pass' ? '#c8e6c9' : '#ffcdd2',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {statusText}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // ============================================================
  // Основной рендер
  // ============================================================

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Отчёт по нормативам
      </Typography>

      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Тип теста *</InputLabel>
          <Select
            value={selectedTestTypeId}
            onChange={(e) => setSelectedTestTypeId(e.target.value)}
            label="Тип теста *"
          >
            {testTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Список *</InputLabel>
          <Select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            label="Список *"
          >
            {listItems.map((list) => (
              <MenuItem key={list.id} value={list.id}>
                {list.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Лагерь (опц.)</InputLabel>
          <Select
            value={selectedCampId}
            onChange={(e) => setSelectedCampId(e.target.value)}
            label="Лагерь (опц.)"
          >
            <MenuItem value="">Не выбран</MenuItem>
            {camps.map((camp) => (
              <MenuItem key={camp.id} value={camp.id}>
                {camp.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          onClick={() => refetch()}
          disabled={!selectedTestTypeId || !selectedListId || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
        >
          Обновить
        </Button>
      </Paper>

      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {reportError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {reportErrorObj instanceof AxiosError
              ? reportErrorObj.response?.data?.message || 'Не удалось загрузить отчёт'
              : 'Произошла неизвестная ошибка'}
          </Alert>
        ) : (
          <>
            {renderTable()}
            <Backdrop
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              open={isLoading}
            >
              <CircularProgress />
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                Загрузка данных...
              </Typography>
            </Backdrop>
          </>
        )}
      </Paper>

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