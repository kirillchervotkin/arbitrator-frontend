import { useEffect, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';

const groups = [
  {
    title: 'Соревнования',
    links: [
      ['/tournaments', 'Турниры'],
      ['/matches', 'Матчи'],
      ['/assignments', 'Назначения'],
    ],
  },
  {
    title: 'Справочники',
    links: [
      ['/cities', 'Города'],
      ['/teams', 'Команды'],
      ['/field-roles', 'Роли судей'],
    ],
  },
  {
    title: 'Спортсмены',
    links: [
      ['/users', 'Пользователи'],
      ['/lists', 'Списки'],
      ['/questionnaires', 'Анкеты'],
    ],
  },
  {
    title: 'Подготовка',
    links: [
      ['/training-camps', 'Сборы'],
      ['/training-sessions', 'Тренировки'],
      ['/test-types', 'Типы тестов'],
      ['/results', 'Результаты'],
      ['/standards-report', 'Отчёт'],
    ],
  },
  {
    title: 'Прочее',
    links: [
      ['/', 'Главная'],
      ['/connected-accounts', 'Аккаунты'],
    ],
  },
];

export default function Navbar({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const active = (path: string) =>
    path === '/'
      ? pathname === '/'
      : pathname === path || pathname.startsWith(`${path}/`);
  const current = groups.flatMap((g) => g.links).find(([path]) => active(path));
  const pageTitle = current?.[1] ?? 'Главная';
  useEffect(() => {
    document.title = `${pageTitle} · Arbitrator`;
  }, [pageTitle]);
  const competition = groups[0].links.find(([path]) => active(path))?.[0];
  return (
    <Box sx={{ minHeight: '100vh', minWidth: 0, bgcolor: '#f5f7fb' }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'white',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: 64 }}>
          <IconButton
            aria-label="Открыть все разделы"
            onClick={() => setOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <Box
            component={Link}
            to="/"
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <SportsSoccerIcon color="primary" />
            <Typography
              sx={{ fontWeight: 800, letterSpacing: -0.5, fontSize: 20 }}
            >
              Arbitrator
            </Typography>
          </Box>
          <Typography
            color="text.secondary"
            sx={{ fontSize: 13, display: { xs: 'none', md: 'block' }, ml: 2 }}
          >
            Управление соревнованиями и судейством
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={() => setOpen(true)}
            color="inherit"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Все разделы
          </Button>
          <Tooltip title="Выйти">
            <IconButton
              aria-label="Выйти из аккаунта"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
        {competition && (
          <Tabs
            value={competition}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Разделы соревнований"
            sx={{ px: { xs: 1, md: 4 }, minHeight: 48 }}
          >
            {groups[0].links.map(([path, label]) => (
              <Tab
                key={path}
                value={path}
                label={label}
                component={Link}
                to={path}
                sx={{ textTransform: 'none', fontWeight: 650 }}
              />
            ))}
          </Tabs>
        )}
      </AppBar>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: 300, maxWidth: '90vw' } } }}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography sx={{ fontWeight: 750 }}>Все разделы</Typography>
          <IconButton aria-label="Закрыть меню" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        {groups.map((group) => (
          <Box key={group.title}>
            <Divider />
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', px: 3, pt: 1.5 }}
            >
              {group.title}
            </Typography>
            <List dense sx={{ px: 1 }}>
              {group.links.map(([path, label]) => (
                <ListItemButton
                  key={path}
                  component={Link}
                  to={path}
                  selected={active(path)}
                  onClick={() => setOpen(false)}
                  sx={{ borderRadius: '8px', px: 2 }}
                >
                  <ListItemText primary={label} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))}
      </Drawer>
      <Box
        component="main"
        sx={{ minWidth: 0, p: competition ? 0 : { xs: 1, md: 3 } }}
      >
        {children}
      </Box>
    </Box>
  );
}
