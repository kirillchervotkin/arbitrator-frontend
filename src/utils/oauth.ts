export function readOAuthResult(event: Pick<MessageEvent, 'source' | 'origin' | 'data'>, popup: Window, callbackOrigin: string): boolean | null {
  if (event.source !== popup || event.origin !== callbackOrigin) return null;
  const data: unknown = event.data;
  if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'OAUTH_CONNECT' ||
      !('success' in data) || typeof data.success !== 'boolean') return null;
  return data.success;
}

export function polarAuthorizationUrl(value: string): string {
  const url = new URL(value);
  if (url.origin !== 'https://flow.polar.com' || !url.searchParams.get('state')) {
    throw new Error('Invalid authorization URL');
  }
  return url.href;
}
