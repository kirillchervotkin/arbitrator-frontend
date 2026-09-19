// src/utils/oauth.ts
import type { OAuthErrorCode, OAuthResult } from '../types';

const OAUTH_MESSAGE_TYPE = 'OAUTH_CONNECT';

const KNOWN_ERROR_CODES: readonly OAuthErrorCode[] = [
  'invalid_state',
  'authorization_declined',
  'consents_required',
  'already_linked',
  'unsupported_client_type',
  'connection_failed',
];

function isKnownErrorCode(value: unknown): value is OAuthErrorCode {
  return (
    typeof value === 'string' &&
    (KNOWN_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Разбирает сообщение от OAuth-попапа.
 *
 * Возвращает `null`, если сообщение не от нашего попапа / не нашего типа —
 * в этом случае вызывающий код должен просто игнорировать событие.
 *
 * Иначе возвращает объект `{ success, error }`:
 *   - `success: true`  → `error` всегда `null`;
 *   - `success: false` → `error` содержит известный код, либо `null`,
 *                        если бэкенд прислал что-то незнакомое
 *                        (тогда фронт покажет дефолтное сообщение).
 */
export function readOAuthResult(
  event: MessageEvent,
  popup: Window,
  expectedOrigin: string,
): OAuthResult | null {
  // 1. Origin — тот, что мы сами зафиксировали (FRONTEND_URL).
  if (event.origin !== expectedOrigin) return null;

  // 2. Источник — именно наше окно, а не сторонний opener.
  if (event.source !== popup) return null;

  const data = event.data as
    | { type?: unknown; success?: unknown; error?: unknown }
    | null
    | undefined;

  if (!data || typeof data !== 'object') return null;
  if (data.type !== OAUTH_MESSAGE_TYPE) return null;
  if (typeof data.success !== 'boolean') return null;

  if (data.success) {
    return { success: true, error: null };
  }

  return {
    success: false,
    error: isKnownErrorCode(data.error) ? data.error : null,
  };
}

/**
 * Строит URL авторизации Polar с защитой от open-redirect.
 *
 * Бэкенд возвращает `url` от `oauthService.buildAuthUrl(...)` — это
 * уже собранный абсолютный URL к polaraccesslink.com. Мы всё равно
 * проверяем хост, чтобы случайная ошибка на бэке (или подмена ответа)
 * не увела попап на чужой домен.
 */
export function polarAuthorizationUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') {
    throw new Error(`OAuth URL must use https, got ${url.protocol}`);
  }
  const allowedHosts = new Set([
    'flow.polar.com',
    'www.polaraccesslink.com',
    'polaraccesslink.com',
  ]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error(`Unexpected OAuth host: ${url.hostname}`);
  }
  return url.toString();
}