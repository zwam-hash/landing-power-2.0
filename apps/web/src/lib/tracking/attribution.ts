import type { TrackingContext } from '@zwam/types';

function getCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : undefined;
}

export function captureRawTrackingContext(): TrackingContext {
  if (typeof window === 'undefined') {
    return {};
  }

  const urlParams = new URLSearchParams(window.location.search);

  return {
    utm_source: urlParams.get('utm_source') || undefined,
    utm_medium: urlParams.get('utm_medium') || undefined,
    utm_campaign: urlParams.get('utm_campaign') || undefined,
    utm_content: urlParams.get('utm_content') || undefined,
    utm_term: urlParams.get('utm_term') || undefined,

    fbclid: urlParams.get('fbclid') || undefined,
    fbp: getCookieValue('_fbp') || urlParams.get('fbp') || undefined,
    fbc: getCookieValue('_fbc') || urlParams.get('fbc') || undefined,

    gclid: urlParams.get('gclid') || undefined,
    wbraid: urlParams.get('wbraid') || undefined,
    gbraid: urlParams.get('gbraid') || undefined,

    ttclid: urlParams.get('ttclid') || undefined,

    referrer: document.referrer || undefined,
    landing_url: window.location.href,
  };
}

export function captureDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      device_type: 'unknown',
      browser: 'unknown',
      browser_version: 'unknown',
      os: 'unknown',
      os_version: 'unknown',
      screen_width: 0,
      screen_height: 0,
      viewport_width: 0,
      viewport_height: 0,
      language: 'en',
      timezone: 'UTC',
      user_agent: '',
      referrer: '',
    };
  }

  const ua = navigator.userAgent || '';
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);

  return {
    device_type: isMobile ? 'mobile' : 'desktop',
    browser: navigator.appName || 'browser',
    browser_version: navigator.appVersion || '1.0',
    os: navigator.platform || 'unknown',
    os_version: 'unknown',
    screen_width: window.screen ? window.screen.width : 0,
    screen_height: window.screen ? window.screen.height : 0,
    viewport_width: window.innerWidth || 0,
    viewport_height: window.innerHeight || 0,
    language: navigator.language || 'en',
    timezone: Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone || 'UTC',
    user_agent: ua,
    referrer: document.referrer || '',
  };
}
