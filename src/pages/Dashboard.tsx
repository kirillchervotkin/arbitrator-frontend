import { Box, Typography, Button, Paper, Divider } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import ListAltIcon from '@mui/icons-material/ListAlt';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssessmentIcon from '@mui/icons-material/Assessment';
// ===== Иконки календаря и судейства =====
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SportsIcon from '@mui/icons-material/Sports';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import GroupsIcon from '@mui/icons-material/Groups';
import BadgeIcon from '@mui/icons-material/Badge';
import ScienceIcon from '@mui/icons-material/Science';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';

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
          Добро пожаловать,{' '}
          <span style={{ color: '#1976d2' }}>
            {user?.email || 'Гость'}
          </span>
          !
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          Вы успешно вошли в систему. Выберите раздел для управления.
        </Typography>
        <Button
          sx={{ mt: 3 }}
          variant="outlined"
          onClick={() => navigate('/connected-accounts')}
        >
          Связанные аккаунты · Polar
        </Button>

        {/* ===== Календарь и судейство ===== */}
        <Typography
          variant="h6"
          sx={{ mt: 4, mb: 2, fontWeight: 600 }}
        >
          Календарь и судейство
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<EmojiEventsIcon />}
            onClick={() => navigate('/tournaments')}
            size="large"
          >
            Турниры
          </Button>
          <Button
            variant="contained"
            startIcon={<SportsSoccerIcon />}
            onClick={() => navigate('/matches')}
            size="large"
          >
            Матчи
          </Button>
          <Button
            variant="contained"
            startIcon={<SportsIcon />}
            onClick={() => navigate('/assignments')}
            size="large"
          >
            Назначения
          </Button>
        </Box>

        {/* ===== Справочники ===== */}
        <Typography
          variant="h6"
          sx={{ mt: 4, mb: 2, fontWeight: 600 }}
        >
          Справочники
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<LocationCityIcon />}
            onClick={() => navigate('/cities')}
            size="large"
          >
            Города
          </Button>
          <Button
            variant="outlined"
            startIcon={<GroupsIcon />}
            onClick={() => navigate('/teams')}
            size="large"
          >
            Команды
          </Button>
          <Button
            variant="outlined"
            startIcon={<BadgeIcon />}
            onClick={() => navigate('/field-roles')}
            size="large"
          >
            Роли на поле
          </Button>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* ===== Спортсмены ===== */}
        <Typography
          variant="h6"
          sx={{ mb: 2, fontWeight: 600 }}
        >
          Спортсмены
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
            startIcon={<AssignmentIcon />}
            onClick={() => navigate('/questionnaires')}
            size="large"
          >
            Анкеты
          </Button>
        </Box>

        {/* ===== Тренировки ===== */}
        <Typography
          variant="h6"
          sx={{ mt: 4, mb: 2, fontWeight: 600 }}
        >
          Тренировки и тесты
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
            startIcon={<FitnessCenterIcon />}
            onClick={() => navigate('/training-sessions')}
            size="large"
          >
            Тренировки
          </Button>
          <Button
            variant="contained"
            startIcon={<ScienceIcon />}
            onClick={() => navigate('/test-types')}
            size="large"
          >
            Типы тестов
          </Button>
          <Button
            variant="contained"
            startIcon={<LeaderboardIcon />}
            onClick={() => navigate('/results')}
            size="large"
          >
            Результаты
          </Button>
          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={() => navigate('/standards-report')}
            size="large"
          >
            Отчёт по нормативам
          </Button>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* ===== Выход ===== */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
