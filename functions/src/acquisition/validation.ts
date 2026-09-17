import type { EventType } from '@zwam/types';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_EVENT_TYPES: EventType[] = [
  'page_view',
  'scroll',
  'engaged_time',
  'high_intent',
  'package_click',
  'form_start',
  'whatsapp_click',
  'custom',
];

const RESTRICTED_METADATA_KEYS = [
  'client_id',
  'lead_score',
  'lead_quality',
  'recommended_action',
  'opportunity_id',
  'sale_id',
  'revenue',
];

export function isValidUuidV4(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_V4_REGEX.test(id);
}

export function isValidEventType(type?: string): type is EventType {
  if (!type || typeof type !== 'string') return false;
  return ALLOWED_EVENT_TYPES.includes(type as EventType);
}

export function validateEventMetadata(
  eventType: EventType,
  metadata?: Record<string, unknown>,
): Record<string, unknown> {
  const safeMeta =
    metadata && typeof metadata === 'object' ? { ...metadata } : {};

  // Size restriction: JSON representation under 10KB
  if (JSON.stringify(safeMeta).length > 10240) {
    throw new Error(
      'BadRequest: Event metadata exceeds maximum allowed size of 10KB.',
    );
  }

  // Reject injections of restricted administrative/commercial fields
  for (const restrictedKey of RESTRICTED_METADATA_KEYS) {
    if (restrictedKey in safeMeta) {
      throw new Error(
        `BadRequest: Restricted field '${restrictedKey}' cannot be set via public event metadata.`,
      );
    }
  }

  // Mandatory event_name if custom event_type
  if (eventType === 'custom') {
    const eventName = safeMeta.event_name;
    if (
      !eventName ||
      typeof eventName !== 'string' ||
      eventName.trim().length === 0
    ) {
      throw new Error(
        "BadRequest: Event type 'custom' requires a valid non-empty 'event_name' string in metadata.",
      );
    }
  }

  return safeMeta;
}
