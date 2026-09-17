import { AppBar, Toolbar, Typography, Button, Box, IconButton, Tooltip } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import LinkIcon from '@mui/icons-material/Link';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'; // иконка для лагерей
import ScienceIcon from '@mui/icons-material/Science'; // иконка для типов тестов
import LeaderboardIcon from '@mui/icons-material/Leaderboard'; // иконка для результатов

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
    if (path === '/training-camps') {
      return location.pathname.startsWith('/training-camps');
    }
    if (path === '/results') {
      return location.pathname.startsWith('/results');
    }
    if (path === '/test-types') {
      return location.pathname.startsWith('/test-types');
    }
    return location.pathname === path;
  };

  return (
    <>
      <AppBar position="static" sx={{ bgcolor: 'background.paper', color: 'text.primary', boxShadow: 1 }}>
        <Toolbar sx={{ flexWrap: 'wrap', py: 1, gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Admin Panel
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
              Отчёт по нормативам
            </Button>
            <Button component={Link} to="/connected-accounts" color="inherit"
              variant={isActive('/connected-accounts') ? 'contained' : 'text'} startIcon={<LinkIcon />}>
              Связанные аккаунты
            </Button>
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