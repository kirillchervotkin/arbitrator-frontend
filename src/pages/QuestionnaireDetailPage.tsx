import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionnaireApi } from '../services/api';

interface QuestionnaireFormData {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  sportsCategory: string | null;
  orderNumber: string | null;
  assignmentDate: string | null;
  assigningAuthority: string | null;
  isFifaJudge: boolean | null;
  fifaId: string | null;
  hasVarLicense: boolean | null;
  heightCm: number | null;
  jogelEquipmentSize: string | null;
  jogelShoeSize: number | null;
  citizenship: string | null;
  countryOfResidence: string | null;
  passportType: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  issuedBy: string | null;
  issueDate: string | null;
  departmentCode: string | null;
  phone: string | null;
}

export default function QuestionnaireDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<QuestionnaireFormData | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const {
    data: questionnaire,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['questionnaire', userId],
    queryFn: () =>
      questionnaireApi.getByUserId(userId!).then((res) => res.data),
    enabled: !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<QuestionnaireFormData>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId, firstName, lastName, email, ...rest } = data;
      return questionnaireApi.update(userId!, { ...rest, userId: userId! });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire', userId] });
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      setSnackbar({
        open: true,
        message: 'Анкета успешно обновлена!',
        severity: 'success',
      });
      setIsEditing(false);
      setFormData(null);
    },
    onError: () => {
      setSnackbar({
        open: true,
        message: 'Ошибка обновления анкеты.',
        severity: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => questionnaireApi.delete(userId!),
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Анкета удалена!',
        severity: 'success',
      });
      setTimeout(() => navigate('/questionnaires'), 1500);
    },
    onError: () => {
      setSnackbar({
        open: true,
        message: 'Ошибка удаления анкеты.',
        severity: 'error',
      });
    },
  });

  const startEditing = () => {
    if (questionnaire) {
      setFormData({ ...questionnaire });
      setIsEditing(true);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev!,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = () => {
    if (formData) {
      updateMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Вы уверены, что хотите удалить эту анкету?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !questionnaire) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Анкета не найдена.</Alert>
        <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/questionnaires')}>
          Назад к списку
        </Button>
      </Box>
    );
  }

  // Данные для отображения: либо редактируемая копия, либо исходные данные
  const currentData: QuestionnaireFormData = isEditing && formData ? formData : questionnaire;

  const renderField = (
    label: string,
    field: keyof QuestionnaireFormData,
    type: string = 'text'
  ) => {
    const value = currentData[field] ?? '';
    const isUserField = ['firstName', 'lastName', 'email'].includes(field);
    return (
      <Box sx={{ width: { xs: '100%', sm: '50%', md: '33.33%' }, p: 1 }}>
        <TextField
          fullWidth
          label={label}
          name={field}
          value={value}
          onChange={handleChange}
          disabled={!isEditing || isUserField}
          type={type}
          slotProps={{ inputLabel: { shrink: true } }}
          margin="dense"
        />
      </Box>
    );
  };

  const renderBooleanField = (label: string, field: keyof QuestionnaireFormData) => {
    const value = currentData[field] ?? false;
    return (
      <Box sx={{ width: { xs: '100%', sm: '50%', md: '33.33%' }, p: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!value}
              onChange={handleChange}
              name={field}
              disabled={!isEditing}
            />
          }
          label={label}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Анкета пользователя
        </Typography>
        <Box>
          {!isEditing ? (
            <>
              <Button variant="contained" onClick={startEditing}>
                Редактировать
              </Button>
              <Button
                variant="outlined"
                color="error"
                sx={{ ml: 2 }}
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
              <Button variant="outlined" sx={{ ml: 2 }} onClick={() => navigate('/questionnaires')}>
                Назад
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
              <Button
                variant="outlined"
                sx={{ ml: 2 }}
                onClick={() => {
                  setIsEditing(false);
                  setFormData(null);
                }}
              >
                Отмена
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Данные пользователя
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          {renderField('Имя', 'firstName')}
          {renderField('Фамилия', 'lastName')}
          {renderField('Email', 'email')}
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" sx={{ mb: 2 }}>
          Судейские данные
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          {renderField('Спортивная категория', 'sportsCategory')}
          {renderField('Номер приказа', 'orderNumber')}
          {renderField('Дата присвоения', 'assignmentDate', 'date')}
          {renderField('Орган присвоения', 'assigningAuthority')}
          {renderBooleanField('Судья FIFA', 'isFifaJudge')}
          {renderField('FIFA ID', 'fifaId')}
          {renderBooleanField('Лицензия VAR', 'hasVarLicense')}
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" sx={{ mb: 2 }}>
          Физические параметры и экипировка
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          {renderField('Рост (см)', 'heightCm', 'number')}
          {renderField('Размер экипировки Jogel', 'jogelEquipmentSize')}
          {renderField('Размер обуви Jogel', 'jogelShoeSize', 'number')}
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" sx={{ mb: 2 }}>
          Паспортные и личные данные
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          {renderField('Гражданство', 'citizenship')}
          {renderField('Страна резидентства', 'countryOfResidence')}
          {renderField('Вид паспорта', 'passportType')}
          {renderField('Серия паспорта', 'passportSeries')}
          {renderField('Номер паспорта', 'passportNumber')}
          {renderField('Кем выдан', 'issuedBy')}
          {renderField('Дата выдачи', 'issueDate', 'date')}
          {renderField('Код подразделения', 'departmentCode')}
          {renderField('Телефон', 'phone')}
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
