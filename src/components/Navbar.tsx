import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import LinkIcon from '@mui/icons-material/Link';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ScienceIcon from '@mui/icons-material/Science';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
// ===== Иконки календаря и судейства =====
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SportsIcon from '@mui/icons-material/Sports';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import GroupsIcon from '@mui/icons-material/Groups';
import BadgeIcon from '@mui/icons-material/Badge';

export default function Navbar({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Подсветка активного маршрута: для вложенных путей учитываем префикс
  const isActive = (path: string) => {
    if (path === '/tournaments')
      return location.pathname.startsWith('/tournaments');
    if (path === '/training-camps') {
      return location.pathname.startsWith('/training-camps');
    }
    if (path === '/training-sessions') {
      return location.pathname.startsWith('/training-sessions');
    }
    if (path === '/results') {
      return location.pathname.startsWith('/results');
    }
    if (path === '/test-types') {
      return location.pathname.startsWith('/test-types');
    }
    if (path === '/matches') {
      return location.pathname.startsWith('/matches');
    }
    if (path === '/questionnaires') {
      return location.pathname.startsWith('/questionnaires');
    }
    if (path === '/lists') {
      return location.pathname.startsWith('/lists');
    }
    return location.pathname === path;
  };

  return (
    <>
      <AppBar
        position="static"
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar sx={{ flexWrap: 'wrap', py: 1, gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mr: 2 }}>
            Admin Panel
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* ===== Группа 1: Главное ===== */}
            <Button
              component={Link}
              to="/"
              color="inherit"
              variant={isActive('/') ? 'contained' : 'text'}
              startIcon={<DashboardIcon />}
            >
              Главная
            </Button>
            <Button
              component={Link}
              to="/tournaments"
              color="inherit"
              variant={isActive('/tournaments') ? 'contained' : 'text'}
              startIcon={<EmojiEventsIcon />}
            >
              Турниры
            </Button>
            <Button
              component={Link}
              to="/matches"
              color="inherit"
              variant={isActive('/matches') ? 'contained' : 'text'}
              startIcon={<SportsSoccerIcon />}
            >
              Матчи
            </Button>
            <Button
              component={Link}
              to="/assignments"
              color="inherit"
              variant={isActive('/assignments') ? 'contained' : 'text'}
              startIcon={<SportsIcon />}
            >
              Назначения
            </Button>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* ===== Группа 2: Справочники ===== */}
            <Button
              component={Link}
              to="/cities"
              color="inherit"
              variant={isActive('/cities') ? 'contained' : 'text'}
              startIcon={<LocationCityIcon />}
            >
              Города
            </Button>
            <Button
              component={Link}
              to="/teams"
              color="inherit"
              variant={isActive('/teams') ? 'contained' : 'text'}
              startIcon={<GroupsIcon />}
            >
              Команды
            </Button>
            <Button
              component={Link}
              to="/field-roles"
              color="inherit"
              variant={isActive('/field-roles') ? 'contained' : 'text'}
              startIcon={<BadgeIcon />}
            >
              Роли
            </Button>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* ===== Группа 3: Спортсмены ===== */}
            <Button
              component={Link}
              to="/users"
              color="inherit"
              variant={isActive('/users') ? 'contained' : 'text'}
              startIcon={<PeopleIcon />}
            >
              Пользователи
            </Button>
            <Button
              component={Link}
              to="/lists"
              color="inherit"
              variant={isActive('/lists') ? 'contained' : 'text'}
              startIcon={<ListAltIcon />}
            >
              Списки
            </Button>
            <Button
              component={Link}
              to="/questionnaires"
              color="inherit"
              variant={isActive('/questionnaires') ? 'contained' : 'text'}
              startIcon={<AssignmentIcon />}
            >
              Анкеты
            </Button>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* ===== Группа 4: Тренировки ===== */}
            <Button
              component={Link}
              to="/training-camps"
              color="inherit"
              variant={isActive('/training-camps') ? 'contained' : 'text'}
              startIcon={<EmojiEventsIcon />}
            >
              Сборы
            </Button>
            <Button
              component={Link}
              to="/training-sessions"
              color="inherit"
              variant={isActive('/training-sessions') ? 'contained' : 'text'}
              startIcon={<FitnessCenterIcon />}
            >
              Тренировки
            </Button>
            <Button
              component={Link}
              to="/test-types"
              color="inherit"
              variant={isActive('/test-types') ? 'contained' : 'text'}
              startIcon={<ScienceIcon />}
            >
              Типы тестов
            </Button>
            <Button
              component={Link}
              to="/results"
              color="inherit"
              variant={isActive('/results') ? 'contained' : 'text'}
              startIcon={<LeaderboardIcon />}
            >
              Результаты
            </Button>
            <Button
              component={Link}
              to="/standards-report"
              color="inherit"
              variant={isActive('/standards-report') ? 'contained' : 'text'}
              startIcon={<AssessmentIcon />}
            >
              Отчёт
            </Button>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* ===== Группа 5: Прочее ===== */}
            <Button
              component={Link}
              to="/connected-accounts"
              color="inherit"
              variant={isActive('/connected-accounts') ? 'contained' : 'text'}
              startIcon={<LinkIcon />}
            >
              Аккаунты
            </Button>
          </Box>

          {/* Logout — прижат к правому краю */}
          <Box sx={{ ml: 'auto' }}>
            <Tooltip title="Выйти">
              <IconButton onClick={handleLogout} color="error">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 3 }}>{children}</Box>
    </>
  );
}
