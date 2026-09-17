import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { isAxiosError } from 'axios';
import { oauthApi } from '../services/api';
import { readOAuthResult, polarAuthorizationUrl } from '../utils/oauth';
import { useAuth } from '../hooks/useAuth';

type Notice = { severity: 'success' | 'error' | 'info'; text: string };

export default function ConnectedAccountsPage() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    document.title = 'Связанные аккаунты — Arbitrator';
    let active = true;
    void oauthApi.status().then(({ data }) => {
      if (active) setConnected(data.polar.connected);
    }).catch(() => { if (active) setStatusError(true); });
    return () => { active = false; cleanup.current?.(); };
  }, []);

  const connect = async () => {
    if (cleanup.current) return;
    // Open synchronously from the click so browsers do not block the popup.
    const popup = window.open('about:blank', '_blank', 'popup,width=600,height=760');
    if (!popup) {
      setNotice({ severity: 'error', text: 'Разрешите всплывающие окна для этого сайта и попробуйте ещё раз.' });
      return;
    }
    setPending(true);
    setNotice(null);
    let active = true;
    const callbackOrigin = new URL(import.meta.env.VITE_OAUTH_CALLBACK_URL || window.location.origin).origin;
    const finish = (result: Notice) => {
      if (!active) return;
      cleanup.current?.();
      setPending(false);
      setNotice(result);
    };
    const onMessage = (event: MessageEvent) => {
      const success = readOAuthResult(event, popup, callbackOrigin);
      if (success === null) return;
      if (success) {
        setConnected(true);
        setStatusError(false);
      }
      finish(success
        ? { severity: 'success', text: 'Аккаунт Polar успешно связан.' }
        : { severity: 'error', text: 'Не удалось связать аккаунт Polar. Попробуйте подключить его ещё раз.' });
    };
    window.addEventListener('message', onMessage);
    const poll = window.setInterval(() => {
      if (popup.closed) finish({ severity: 'info', text: 'Окно авторизации закрыто. Подтверждение подключения не получено.' });
    }, 500);
    const timeout = window.setTimeout(() => finish({ severity: 'error', text: 'Время ожидания истекло. Повторите подключение Polar.' }), 5 * 60 * 1000);
    cleanup.current = () => {
      active = false;
      window.removeEventListener('message', onMessage);
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      popup.close();
      cleanup.current = null;
    };
    try {
      const { data } = await oauthApi.connect('polar');
      if (!active) return;
      popup.location.href = polarAuthorizationUrl(data.url);
    } catch (error) {
      finish({ severity: 'error', text: isAxiosError(error) && error.response?.status === 401
        ? 'Сессия истекла. Войдите в Arbitrator снова и повторите подключение.'
        : 'Не удалось открыть авторизацию Polar. Проверьте соединение и попробуйте ещё раз.' });
    }
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>Связанные аккаунты</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Подключите спортивный сервис к своему аккаунту Arbitrator{user?.email ? ` (${user.email})` : ''}.
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">Polar Flow</Typography>
          <Typography color={connected ? 'success.main' : 'text.secondary'}>
            {statusError ? 'Не удалось проверить подключение. Обновите страницу.' : connected === null ? 'Проверяем подключение…' : connected ? 'Аккаунт подключён' : 'Аккаунт не подключён'}
          </Typography>
          <Typography>Авторизуйтесь в Polar и разрешите доступ к тренировкам. Пароль вводится на сайте Polar.</Typography>
          <Typography variant="body2" color="text.secondary">Если Polar уже подключён, повторная авторизация обновит связь.</Typography>
          {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
          <Box>
            <Button variant="contained" onClick={connect} disabled={pending} startIcon={pending ? <CircularProgress size={18} color="inherit" /> : <LinkIcon />}>
              {pending ? 'Ожидаем авторизацию Polar…' : connected ? 'Подключить заново' : 'Подключить Polar'}
            </Button>
            {pending && <Button sx={{ ml: 1 }} onClick={() => {
              cleanup.current?.();
              setPending(false);
              setNotice({ severity: 'info', text: 'Подключение отменено.' });
            }}>Отмена</Button>}
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
