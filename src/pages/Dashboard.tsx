import { Box, Typography, Button, Paper } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import ListAltIcon from '@mui/icons-material/ListAlt';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssessmentIcon from '@mui/icons-material/Assessment';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Добро пожаловать, <span style={{ color: '#1976d2' }}>{user?.email || 'Гость'}</span>!
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          Вы успешно вошли в систему. Выберите раздел для управления.
        </Typography>
        <Button sx={{ mt: 3 }} variant="outlined" onClick={() => navigate('/connected-accounts')}>Связанные аккаунты · Polar</Button>
        <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<PeopleIcon />}
            onClick={() => navigate('/users')}
            size="large"
          >
            Пользователи
          </Button>
          <Button
            variant="contained"
            startIcon={<ListAltIcon />}
            onClick={() => navigate('/lists')}
            size="large"
          >
            Списки
          </Button>
          <Button
            variant="contained"
            startIcon={<EmojiEventsIcon />}
            onClick={() => navigate('/training-camps')}
            size="large"
          >
            Тренировочные сборы
          </Button>
          <Button
            variant="contained"
            startIcon={<AssignmentIcon />}
            onClick={() => navigate('/questionnaires')}
            size="large"
          >
            Анкеты
          </Button>
          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={() => navigate('/standards-report')}
            size="large"
          >
            Отчёт по нормативам
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            size="large"
          >
            Выйти
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}