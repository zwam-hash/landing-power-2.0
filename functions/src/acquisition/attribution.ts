import type {
  Attribution,
  AttributionConfidence,
  AttributionPlatform,
  SourceType,
  TrackingContext,
} from '@zwam/types';

export function deriveAttribution(raw: TrackingContext): Attribution {
  const source = raw.utm_source || '';
  const medium = raw.utm_medium || '';
  const campaign = raw.utm_campaign || '';
  const content = raw.utm_content || '';
  const term = raw.utm_term || '';
  const referrer = raw.referrer || '';

  const hasPaidClickId = Boolean(
    raw.fbclid || raw.gclid || raw.wbraid || raw.gbraid || raw.ttclid,
  );

  const isPaidMedium = /^(cpc|paid|ppc|ad|paidads|paid_social)$/i.test(medium);

  // 1. Determine source_type
  let sourceType: SourceType = 'direct';
  if (hasPaidClickId || isPaidMedium) {
    sourceType = 'paid';
  } else if (/^(organic|social|search)$/i.test(medium)) {
    sourceType = 'organic';
  } else if (referrer.trim().length > 0) {
    const isSearchOrSocialRef =
      /google|bing|yahoo|duckduckgo|instagram|facebook|tiktok|linkedin/i.test(
        referrer,
      );
    sourceType = isSearchOrSocialRef ? 'organic' : 'referral';
  } else {
    sourceType = 'direct';
  }

  // 2. Determine platform
  let platform: AttributionPlatform | null = null;
  const lowSource = source.toLowerCase();
  const lowRef = referrer.toLowerCase();

  if (/google/i.test(lowSource)) {
    platform = 'google';
  } else if (/facebook|meta/i.test(lowSource)) {
    platform = 'meta';
  } else if (/instagram/i.test(lowSource)) {
    platform = 'instagram';
  } else if (/tiktok/i.test(lowSource)) {
    platform = 'tiktok';
  } else if (/linkedin/i.test(lowSource)) {
    platform = 'linkedin';
  } else if (raw.gclid || raw.wbraid || raw.gbraid) {
    platform = 'google';
  } else if (raw.fbclid || raw.fbp || raw.fbc) {
    platform = 'meta';
  } else if (raw.ttclid) {
    platform = 'tiktok';
  } else if (lowRef.includes('google')) {
    platform = 'google';
  } else if (lowRef.includes('facebook')) {
    platform = 'meta';
  } else if (lowRef.includes('instagram')) {
    platform = 'instagram';
  } else if (lowRef.includes('tiktok')) {
    platform = 'tiktok';
  } else if (lowRef.includes('linkedin')) {
    platform = 'linkedin';
  } else if (sourceType === 'paid' || sourceType === 'organic') {
    platform = 'other';
  } else {
    platform = null;
  }

  // 3. Determine attribution_confidence
  let confidence: AttributionConfidence = 'unknown';
  if (hasPaidClickId || (source && medium)) {
    confidence = 'explicit';
  } else if (sourceType === 'organic' || sourceType === 'referral') {
    confidence = 'inferred';
  } else {
    confidence = 'unknown';
  }

  return {
    source_type: sourceType,
    platform,
    source: source || (sourceType === 'direct' ? 'direct' : 'unknown'),
    medium: medium || (sourceType === 'direct' ? 'none' : 'unknown'),
    campaign: campaign || 'none',
    content: content || 'none',
    term: term || 'none',
    attribution_confidence: confidence,
  };
}
