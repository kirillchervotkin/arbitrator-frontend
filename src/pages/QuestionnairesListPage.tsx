import { useState } from 'react';
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
  Chip,
  Pagination,
  Alert,
  Snackbar,
  SelectChangeEvent,
  Tooltip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { questionnaireApi } from '../services/api';
import { listApi } from '../services/api';
import { QuestionnaireWithUser } from '../types';
import DownloadIcon from '@mui/icons-material/Download';

interface QuestionnairesResponse {
  rows: QuestionnaireWithUser[];
  total: number;
}

export default function QuestionnairesListPage() {
  const navigate = useNavigate();
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const limit = 20;

  // Загрузка всех списков для фильтра
  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: () => listApi.getLists().then((res) => res.data),
  });

  // Загрузка анкет с фильтром по спискам
  const {
    data: questionnairesData,
    isLoading,
    error,
    refetch,
  } = useQuery<QuestionnairesResponse>({
    queryKey: ['questionnaires', { listIds: selectedListIds, page, limit }],
    queryFn: () =>
      questionnaireApi
        .getAll({
          listIds: selectedListIds.length > 0 ? selectedListIds : undefined,
          limit,
          offset: (page - 1) * limit,
        })
        .then((res) => res.data),
    placeholderData: (previousData) => previousData,
  });

  const questionnaires = questionnairesData?.rows || [];
  const total = questionnairesData?.total || 0;

  const handleListFilterChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];
    setSelectedListIds(value);
    setPage(1);
  };

  const handleRowClick = (userId: string) => {
    navigate(`/questionnaires/${userId}`);
  };

  // Функция экспорта в Excel
  const handleExport = async () => {
    // Проверяем, выбран ли хотя бы один список
    if (selectedListIds.length === 0) {
      setSnackbar({
        open: true,
        message: 'Для экспорта выберите хотя бы один список.',
        severity: 'error',
      });
      return;
    }

    setIsExporting(true);
    try {
      // Запрашиваем все анкеты для выбранных списков без пагинации (увеличиваем лимит)
      const response = await questionnaireApi.getAll({
        listIds: selectedListIds,
        limit: 10000, // достаточно большой лимит
        offset: 0,
      });

      const allData = response.data.rows;

      if (allData.length === 0) {
        setSnackbar({
          open: true,
          message: 'Нет данных для экспорта.',
          severity: 'error',
        });
        setIsExporting(false);
        return;
      }

      // Преобразуем данные в плоскую таблицу для Excel
      const excelData = allData.map((q) => ({
        'Имя': q.firstName || '',
        'Фамилия': q.lastName || '',
        'Email': q.email || '',
        'Телефон': q.phone || '',
        'Спортивная категория': q.sportsCategory || '',
        'Номер приказа': q.orderNumber || '',
        'Дата присвоения': q.assignmentDate || '',
        'Орган присвоения': q.assigningAuthority || '',
        'Судья FIFA': q.isFifaJudge ? 'Да' : 'Нет',
        'FIFA ID': q.fifaId || '',
        'Лицензия VAR': q.hasVarLicense ? 'Да' : 'Нет',
        'Рост (см)': q.heightCm || '',
        'Размер экипировки Jogel': q.jogelEquipmentSize || '',
        'Размер обуви Jogel': q.jogelShoeSize || '',
        'Гражданство': q.citizenship || '',
        'Страна резидентства': q.countryOfResidence || '',
        'Вид паспорта': q.passportType || '',
        'Серия паспорта': q.passportSeries || '',
        'Номер паспорта': q.passportNumber || '',
        'Кем выдан': q.issuedBy || '',
        'Дата выдачи': q.issueDate || '',
        'Код подразделения': q.departmentCode || '',
      }));

      // Создаём книгу Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, 'Анкеты');

      // Генерируем файл и скачиваем
      const fileName = `Анкеты_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setSnackbar({
        open: true,
        message: `Экспортировано ${allData.length} анкет.`,
        severity: 'success',
      });
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: 'Ошибка при экспорте.',
        severity: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Ошибка загрузки анкет.</Alert>
        <Button variant="outlined" sx={{ mt: 2 }} onClick={() => refetch()}>
          Повторить
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Анкеты пользователей
      </Typography>

      {/* Фильтр по спискам + кнопка экспорта */}
      <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ flexGrow: 1, minWidth: 200 }}>
            <InputLabel id="list-filter-label">Фильтр по спискам</InputLabel>
            <Select
              labelId="list-filter-label"
              multiple
              value={selectedListIds}
              onChange={handleListFilterChange}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((listId) => {
                    const list = lists.find((l) => l.id === listId);
                    return <Chip key={listId} label={list?.name || listId} size="small" />;
                  })}
                </Box>
              )}
              label="Фильтр по спискам"
            >
              {lists.map((list) => (
                <MenuItem key={list.id} value={list.id}>
                  {list.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={() => refetch()}>
            Обновить
          </Button>
          <Tooltip title="Экспортировать анкеты из выбранных списков в Excel">
            <Button
              variant="contained"
              color="success"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={isExporting || selectedListIds.length === 0}
            >
              {isExporting ? 'Экспорт...' : 'Экспорт в Excel'}
            </Button>
          </Tooltip>
        </Box>
      </Paper>

      {/* Таблица анкет */}
      <Paper elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Пользователь</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Категория</TableCell>
              <TableCell>Телефон</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {questionnaires.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Нет анкет.
                </TableCell>
              </TableRow>
            ) : (
              questionnaires.map((q) => (
                <TableRow
                  key={q.userId}
                  hover
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(q.userId)}
                >
                  <TableCell>{`${q.lastName || ''} ${q.firstName || ''}`.trim() || 'Без имени'}</TableCell>
                  <TableCell>{q.email || '—'}</TableCell>
                  <TableCell>{q.sportsCategory || '—'}</TableCell>
                  <TableCell>{q.phone || '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(q.userId);
                      }}
                    >
                      Открыть
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {/* Пагинация */}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
          />
        </Box>
      </Paper>

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