import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { isAxiosError } from 'axios';
import { oauthApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import type {
  OAuthErrorCode,
  PolarStatusReason,
  PolarStatusResponse,
} from '../types';

type Notice = {
  severity: 'success' | 'error' | 'info' | 'warning';
  text: string;
  actionUrl?: string;
  /** Просто повторный connect() без сброса. */
  canRetry?: boolean;
  /** Сначала disconnect() (DELETE /v3/users/{id} + revokeToken), затем connect(). */
  needsReset?: boolean;
};

const POLAR_FLOW_URL = 'https://flow.polar.com/';
const POLAR_ACCOUNT_URL = 'https://account.polar.com/';

function messageForOAuthError(code: OAuthErrorCode | null): Notice {
  switch (code) {
    case 'consents_required':
      return {
        severity: 'warning',
        text:
          'Polar требует подтвердить обязательные согласия. ' +
          'Нажмите «Сбросить и подключить заново» — мы отвяжем аккаунт ' +
          'от Polar, и при следующей попытке Polar снова покажет экран ' +
          'согласий. Если экран не появится, примите согласия вручную ' +
          'в настройках аккаунта Polar.',
        actionUrl: POLAR_ACCOUNT_URL,
        needsReset: true,
      };
    case 'already_linked':
      return {
        severity: 'error',
        text:
          'Этот Polar-аккаунт уже привязан к другому пользователю Arbitrator. ' +
          'Нажмите «Сбросить и подключить заново», чтобы разорвать связь ' +
          'и попробовать снова. Если не поможет — отвяжите Arbitrator ' +
          'в Polar Flow (Settings → Partners).',
        actionUrl: POLAR_FLOW_URL,
        needsReset: true,
      };
    case 'invalid_state':
      return {
        severity: 'error',
        text:
          'Сессия авторизации истекла. Нажмите «Подключить Polar» ещё раз.',
        canRetry: true,
      };
    case 'authorization_declined':
      return {
        severity: 'info',
        text:
          'Вы отклонили доступ в Polar. Чтобы подключить аккаунт, ' +
          'разрешите доступ к тренировкам и повторите попытку.',
        canRetry: true,
      };
    case 'unsupported_client_type':
      return {
        severity: 'error',
        text: 'Этот тип клиента не поддерживается. Обновите страницу.',
      };
    case 'connection_failed':
    default:
      return {
        severity: 'error',
        text:
          'Не удалось связать аккаунт Polar. Проверьте соединение ' +
          'и попробуйте подключить его ещё раз.',
        canRetry: true,
      };
  }
}

function messageForStatus(reason: PolarStatusReason): string {
  switch (reason) {
    case 'connected':
      return 'Аккаунт подключён';
    case 'consents_required':
      return 'Требуется подтвердить согласия в Polar';
    case 'not_registered':
      return 'Аккаунт не подключён';
    case 'not_linked':
      return 'Аккаунт не подключён';
    case 'unknown':
    default:
      return 'Не удалось проверить подключение. Обновите страницу.';
  }
}

function colorForStatus(reason: PolarStatusReason | undefined): string {
  switch (reason) {
    case 'connected':
      return 'success.main';
    case 'consents_required':
      return 'warning.main';
    default:
      return 'text.secondary';
  }
}

const CONSENTS_NOTICE: Notice = {
  severity: 'warning',
  text:
    'Polar требует подтвердить обязательные согласия. ' +
    'Нажмите «Сбросить и подключить заново» — мы отвяжем аккаунт ' +
    'от Polar, и при следующей попытке Polar снова покажет экран ' +
    'согласий. Если экран не появится, примите согласия вручную ' +
    'в настройках аккаунта Polar.',
  actionUrl: POLAR_ACCOUNT_URL,
  needsReset: true,
};

/**
 * Читает query-параметры результата OAuth, которые бэкенд выставил
 * при редиректе на /connected-accounts.
 *
 *   ?polar=connected
 *   ?polar=error&reason=consents_required
 *
 * Возвращает Notice или null, если параметров нет.
 */
function readRedirectResult(): Notice | null {
  const params = new URLSearchParams(window.location.search);
  const polar = params.get('polar');

  if (polar === 'connected') {
    return {
      severity: 'success',
      text: 'Аккаунт Polar успешно связан.',
    };
  }

  if (polar === 'error') {
    const reason = params.get('reason') as OAuthErrorCode | null;
    return messageForOAuthError(reason);
  }

  return null;
}

/** Убирает query-параметры из URL после того, как показали уведомление. */
function stripQueryParams(): void {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, '', cleanUrl);
}

export default function ConnectedAccountsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PolarStatusResponse['polar'] | null>(
    null,
  );
  const [statusError, setStatusError] = useState(false);
  const [pending, setPending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Начальное значение notice вычисляется один раз при монтировании —
  // в lazy initializer, до первого рендера. Так мы избегаем setState
  // в теле useEffect (React ругается на cascading renders).
  const [notice, setNotice] = useState<Notice | null>(() =>
    readRedirectResult(),
  );

  useEffect(() => {
    document.title = 'Связанные аккаунты — Arbitrator';

    // Если пришли из OAuth-редиректа с query-параметрами результата —
    // чистим URL, чтобы при F5 уведомление не показывалось снова.
    // Это работа с внешней системой (history API), а не setState.
    const params = new URLSearchParams(window.location.search);
    if (params.has('polar')) {
      stripQueryParams();
    }

    let active = true;

    void oauthApi
      .status()
      .then(({ data }) => {
        if (!active) return;
        setStatus(data.polar);

        // Не перетираем результат OAuth-редиректа (success/error),
        // если он уже установлен. Иначе — показываем consents_required,
        // если бэкенд сообщает о необходимости согласий.
        setNotice((prev) => {
          if (prev) return prev;
          if (data.polar.reason === 'consents_required') {
            return CONSENTS_NOTICE;
          }
          return prev;
        });
      })
      .catch(() => {
        if (active) setStatusError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const connected = status?.connected ?? null;

  /**
   * Стартует OAuth-флоу: получает URL у бэкенда и делает полноценный
   * редирект в текущей вкладке. Popup не используем — браузеры
   * блокируют window.open после await, а cross-origin postMessage
   * не всегда долетает до родителя.
   *
   * При opts.reset сначала вызываем disconnect() — это отзывает
   * access token в Polar и чистит локальные токены, чтобы Polar
   * заново провёл пользователя через экран согласий.
   */
  const connect = async (opts?: { reset?: boolean }) => {
    if (pending) return;

    setPending(true);
    setNotice(null);

    try {
      if (opts?.reset) {
        try {
          await oauthApi.disconnect();
        } catch {
          // не блокируем OAuth, если сброс не удался
        }
      }

      const { data } = await oauthApi.connect('polar');

      // Полноценный редирект в текущей вкладке — как в intervals.icu.
      // Браузер уйдёт на Polar, а после consent вернётся на
      // /oauth/callback, который в свою очередь сделает 302 на
      // /connected-accounts с результатом.
      window.location.href = data.url;
    } catch (error) {
      setPending(false);
      setNotice({
        severity: 'error',
        text:
          isAxiosError(error) && error.response?.status === 401
            ? 'Сессия истекла. Войдите в Arbitrator снова и повторите подключение.'
            : 'Не удалось открыть авторизацию Polar. Проверьте соединение и попробуйте ещё раз.',
        canRetry: true,
      });
    }
  };

  /**
   * Полное отключение Polar:
   *   1. DELETE /v3/users/{id} на стороне Polar — отзывает access token
   *      и снимает регистрацию приложения у пользователя;
   *   2. revokeToken локально — чистит сохранённые токены в БД.
   *
   * После этого статус сбрасывается в not_linked, и можно заново
   * пройти OAuth-флоу (Polar снова покажет экран согласий).
   */
  const disconnect = async () => {
    if (disconnecting) return;

    setConfirmOpen(false);
    setDisconnecting(true);
    setNotice(null);

    try {
      await oauthApi.disconnect();

      setStatus({ connected: false, reason: 'not_linked' });
      setStatusError(false);
      setNotice({
        severity: 'success',
        text:
          'Аккаунт Polar отключён. Можно подключить его заново — ' +
          'Polar снова покажет экран согласий.',
      });
    } catch (error) {
      setNotice({
        severity: 'error',
        text:
          isAxiosError(error) && error.response?.status === 401
            ? 'Сессия истекла. Войдите в Arbitrator снова и повторите.'
            : 'Не удалось отключить Polar. Проверьте соединение и попробуйте ещё раз.',
        canRetry: false,
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const statusText = statusError
    ? 'Не удалось проверить подключение. Обновите страницу.'
    : status === null
      ? 'Проверяем подключение…'
      : messageForStatus(status.reason);

  const busy = pending || disconnecting;

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Связанные аккаунты
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Подключите спортивный сервис к своему аккаунту Arbitrator
        {user?.email ? ` (${user.email})` : ''}.
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            Polar Flow
          </Typography>
          <Typography color={colorForStatus(status?.reason)}>
            {statusText}
          </Typography>
          <Typography>
            Авторизуйтесь в Polar и разрешите доступ к тренировкам. Пароль
            вводится на сайте Polar.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            После нажатия кнопки вы перейдёте на сайт Polar. По завершении
            авторизации вернётесь сюда автоматически.
          </Typography>
          {notice && (
            <Alert
              severity={notice.severity}
              action={
                <>
                  {notice.actionUrl && (
                    <Link
                      href={notice.actionUrl}
                      target="_blank"
                      rel="noreferrer"
                      underline="hover"
                      sx={{ alignSelf: 'center' }}
                    >
                      Открыть Polar
                    </Link>
                  )}
                  {notice.canRetry && !busy && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => connect()}
                      sx={{ ml: 1 }}
                    >
                      Повторить
                    </Button>
                  )}
                  {notice.needsReset && !busy && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => connect({ reset: true })}
                      sx={{ ml: 1 }}
                    >
                      Сбросить и подключить заново
                    </Button>
                  )}
                </>
              }
            >
              {notice.text}
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={() => connect()}
              disabled={busy}
              startIcon={
                pending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <LinkIcon />
                )
              }
            >
              {pending
                ? 'Переходим на Polar…'
                : connected
                  ? 'Подключить заново'
                  : 'Подключить Polar'}
            </Button>

            <Button
              variant="outlined"
              color="error"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
              startIcon={
                disconnecting ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <LinkOffIcon />
                )
              }
            >
              {disconnecting ? 'Отключаем…' : 'Отключить Polar'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        aria-labelledby="disconnect-dialog-title"
      >
        <DialogTitle id="disconnect-dialog-title">
          Отключить Polar?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Мы отзовём доступ приложения на стороне Polar и удалим
            сохранённые токены. Синхронизированные тренировки в Arbitrator
            останутся. При повторном подключении Polar снова покажет
            экран согласий.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={disconnecting}
          >
            Отмена
          </Button>
          <Button
            onClick={disconnect}
            color="error"
            variant="contained"
            disabled={disconnecting}
          >
            Отключить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
