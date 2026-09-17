import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  type Ad,
  type Adset,
  type Campaign,
  type Client,
  type Landing,
  type TrackingContext,
  createAdLogic,
  createAdsetLogic,
  createCampaignLogic,
  createOrReuseSessionLogic,
  deriveAttribution,
  getFirestoreAdmin,
  ingestEventLogic,
} from '../functions/src/index.js';

describe('Module 3 — Acquisition Engine & Ingestion (Local / Emulator Mode)', () => {
  const db = getFirestoreAdmin();

  const clientActive: Client = {
    client_id: 'acq_client_01',
    company_name: 'Acquisition Client Active',
    business_sector: 'Ecommerce',
    legal_name: 'Acq Active Inc',
    contact_email: 'acq@client.com',
    contact_phone: '+123456789',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const clientSuspended: Client = {
    client_id: 'acq_client_suspended',
    company_name: 'Acquisition Client Suspended',
    business_sector: 'Retail',
    legal_name: 'Acq Suspended Ltd',
    contact_email: 'suspended@client.com',
    contact_phone: '+987654321',
    status: 'suspended',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const landingActive: Landing = {
    landing_id: 'acq_landing_01',
    client_id: 'acq_client_01',
    name: 'Landing Promocional V1',
    slug: 'promo-v1',
    status: 'published',
    monthly_fee: 100,
    published_version_id: 'v1.2.0',
    operational_status: 'active',
    billing_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const landingInactive: Landing = {
    landing_id: 'acq_landing_inactive',
    client_id: 'acq_client_01',
    name: 'Landing Inactiva',
    slug: 'inactive-landing',
    status: 'published',
    monthly_fee: 100,
    published_version_id: 'v1.0.0',
    operational_status: 'inactive',
    billing_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const landingOtherClient: Landing = {
    landing_id: 'acq_landing_other_client',
    client_id: 'acq_client_suspended',
    name: 'Landing de Otro Cliente',
    slug: 'other-client-landing',
    status: 'published',
    monthly_fee: 100,
    published_version_id: 'v1.0.0',
    operational_status: 'active',
    billing_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const landingActive2: Landing = {
    landing_id: 'acq_landing_02',
    client_id: 'acq_client_01',
    name: 'Landing Promocional V2',
    slug: 'promo-v2',
    status: 'published',
    monthly_fee: 100,
    published_version_id: 'v1.0.0',
    operational_status: 'active',
    billing_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    await db
      .collection('clients')
      .doc(clientActive.client_id)
      .set(clientActive);
    await db
      .collection('clients')
      .doc(clientSuspended.client_id)
      .set(clientSuspended);

    await db
      .collection('landings')
      .doc(landingActive.landing_id)
      .set(landingActive);
    await db
      .collection('landings')
      .doc(landingActive2.landing_id)
      .set(landingActive2);
    await db
      .collection('landings')
      .doc(landingInactive.landing_id)
      .set(landingInactive);
    await db
      .collection('landings')
      .doc(landingOtherClient.landing_id)
      .set(landingOtherClient);
  });

  // =========================================================================
  // 1. ATTRIBUTION DERIVATION & RAW PRESERVATION
  // =========================================================================
  describe('Attribution Engine & RAW TrackingContext', () => {
    it('preserves all RAW parameters including wbraid and gbraid without overwriting', () => {
      const rawContext: TrackingContext = {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'spring_sale',
        utm_content: 'banner_a',
        utm_term: 'running+shoes',
        gclid: 'gclid_12345',
        wbraid: 'wbraid_67890',
        gbraid: 'gbraid_13579',
        fbclid: 'fbclid_999',
        ttclid: 'ttclid_888',
        referrer: 'https://google.com/search',
        landing_url:
          'https://acme.com/promo?gclid=gclid_12345&wbraid=wbraid_67890',
      };

      const attr = deriveAttribution(rawContext);

      // Verify RAW preservation
      expect(rawContext.wbraid).toBe('wbraid_67890');
      expect(rawContext.gbraid).toBe('gbraid_13579');
      expect(rawContext.gclid).toBe('gclid_12345');

      // Derived attribution assertions
      expect(attr.source_type).toBe('paid');
      expect(attr.platform).toBe('google');
      expect(attr.attribution_confidence).toBe('explicit');
    });

    it('derives Meta paid attribution from fbclid', () => {
      const rawContext: TrackingContext = {
        fbclid: 'fb_click_123',
        utm_source: 'facebook',
        utm_medium: 'paid',
        referrer: 'https://m.facebook.com/',
      };

      const attr = deriveAttribution(rawContext);
      expect(attr.source_type).toBe('paid');
      expect(attr.platform).toBe('meta');
      expect(attr.attribution_confidence).toBe('explicit');
    });

    it('derives Organic search attribution from Google referrer without click IDs', () => {
      const rawContext: TrackingContext = {
        referrer: 'https://www.google.com/',
      };

      const attr = deriveAttribution(rawContext);
      expect(attr.source_type).toBe('organic');
      expect(attr.platform).toBe('google');
      expect(attr.attribution_confidence).toBe('inferred');
    });

    it('derives Organic social attribution from Instagram referrer', () => {
      const rawContext: TrackingContext = {
        referrer: 'https://l.instagram.com/',
      };

      const attr = deriveAttribution(rawContext);
      expect(attr.source_type).toBe('organic');
      expect(attr.platform).toBe('instagram');
      expect(attr.attribution_confidence).toBe('inferred');
    });

    it('derives Referral attribution from external non-search referrer', () => {
      const rawContext: TrackingContext = {
        referrer: 'https://techblog.org/article/10',
      };

      const attr = deriveAttribution(rawContext);
      expect(attr.source_type).toBe('referral');
      expect(attr.platform).toBeNull();
      expect(attr.attribution_confidence).toBe('inferred');
    });

    it('derives Direct attribution when no parameters or referrer exist', () => {
      const rawContext: TrackingContext = {};

      const attr = deriveAttribution(rawContext);
      expect(attr.source_type).toBe('direct');
      expect(attr.platform).toBeNull();
      expect(attr.attribution_confidence).toBe('unknown');
    });
  });

  // =========================================================================
  // 2. SESSION CREATION, REUSE & 3-MINUTE RULE
  // =========================================================================
  describe('Session Lifecycle (3-minute rule without heartbeats)', () => {
    it('creates a new session with server-resolved landing_version_id and frozen attribution', async () => {
      const anonymousId = randomUUID();
      const rawContext: TrackingContext = {
        utm_source: 'meta',
        utm_medium: 'cpc',
        fbclid: 'fb_123',
      };

      const res = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop', browser: 'Chrome' },
        trackingContext: rawContext,
      });

      expect(res.isReused).toBe(false);
      expect(res.session.session_id).toBeDefined();
      expect(res.session.landing_version_id).toBe('v1.2.0'); // Server-resolved from landing.published_version_id!
      expect(res.session.anonymous_id).toBe(anonymousId);
      expect(res.session.attribution.source_type).toBe('paid');
      expect(res.session.attribution.platform).toBe('meta');

      // IP is NOT persisted in Session or TrackingContext
      expect((res.session as any).ip).toBeUndefined();
      expect((res.session.tracking_context as any).ip).toBeUndefined();
    });

    it('reuses existing active session if subsequent event arrives within 3 minutes (without pings)', async () => {
      const anonymousId = randomUUID();
      const rawContext: TrackingContext = {
        utm_source: 'google',
        utm_medium: 'cpc',
        gclid: 'g_123',
      };

      // Initial session creation
      const res1 = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: rawContext,
      });

      expect(res1.isReused).toBe(false);
      const originalSessionId = res1.session.session_id;

      // Second call 30 seconds later with different query parameters in tab
      const res2 = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: { utm_source: 'direct' }, // Tab navigation
      });

      expect(res2.isReused).toBe(true);
      expect(res2.session.session_id).toBe(originalSessionId);

      // Initial tracking_context and attribution remain FROZEN!
      expect(res2.session.attribution.platform).toBe('google');
      expect(res2.session.tracking_context.gclid).toBe('g_123');
    });

    it('expires active session after 3 minutes of inactivity and creates a NEW session', async () => {
      const anonymousId = randomUUID();
      const dbDocId = randomUUID();
      const fourMinutesAgo = new Date(Date.now() - 240000).toISOString();

      // Seed an expired session document (last_activity_at 4 minutes ago)
      await db
        .collection('active_sessions')
        .doc(
          `${clientActive.client_id}_${landingActive.landing_id}_${anonymousId}`,
        )
        .set({
          session_id: dbDocId,
          client_id: clientActive.client_id,
          landing_id: landingActive.landing_id,
          anonymous_id: anonymousId,
          last_activity_at: fourMinutesAgo,
        });

      await db
        .collection('sessions')
        .doc(dbDocId)
        .set({
          session_id: dbDocId,
          client_id: clientActive.client_id,
          landing_id: landingActive.landing_id,
          landing_version_id: 'v1.2.0',
          anonymous_id: anonymousId,
          started_at: fourMinutesAgo,
          last_activity_at: fourMinutesAgo,
          device_type: 'desktop',
          browser: 'Firefox',
          browser_version: '100',
          os: 'Windows',
          os_version: '11',
          screen_width: 1920,
          screen_height: 1080,
          viewport_width: 1920,
          viewport_height: 1080,
          language: 'en',
          timezone: 'UTC',
          user_agent: 'Firefox',
          referrer: '',
          tracking_context: {},
          attribution: {
            source_type: 'direct',
            platform: null,
            source: 'direct',
            medium: 'none',
            campaign: 'none',
            content: 'none',
            term: 'none',
            attribution_confidence: 'unknown',
          },
        });

      // New request after > 3 minutes inactivity
      const res = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      expect(res.isReused).toBe(false);
      expect(res.session.session_id).not.toBe(dbDocId);
    });

    it('rejects session creation when landing published_version_id is missing', async () => {
      const landingNoPublishedVersion: Landing = {
        landing_id: 'acq_landing_no_published',
        client_id: clientActive.client_id,
        name: 'Landing Sin Version Publicada',
        slug: 'no-published',
        status: 'draft',
        monthly_fee: 100,
        operational_status: 'active',
        billing_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db
        .collection('landings')
        .doc(landingNoPublishedVersion.landing_id)
        .set(landingNoPublishedVersion);

      await expect(
        createOrReuseSessionLogic({
          clientId: clientActive.client_id,
          landingId: landingNoPublishedVersion.landing_id,
          anonymousId: randomUUID(),
          deviceInfo: { device_type: 'desktop' },
          trackingContext: {},
        }),
      ).rejects.toThrow(
        /BadRequest: Landing .* does not have an active published_version_id/,
      );
    });

    it('handles concurrent session creation requests atomically for same identity', async () => {
      const anonymousId = randomUUID();

      const [res1, res2] = await Promise.all([
        createOrReuseSessionLogic({
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          anonymousId,
          deviceInfo: { device_type: 'desktop' },
          trackingContext: {},
        }),
        createOrReuseSessionLogic({
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          anonymousId,
          deviceInfo: { device_type: 'desktop' },
          trackingContext: {},
        }),
      ]);

      expect(res1.session.session_id).toBe(res2.session.session_id);
    });

    it('rejects event ingestion on an expired session (>3m inactivity)', async () => {
      const anonymousId = randomUUID();
      const dbDocId = randomUUID();
      const fourMinutesAgo = new Date(Date.now() - 240000).toISOString();

      await db
        .collection('sessions')
        .doc(dbDocId)
        .set({
          session_id: dbDocId,
          client_id: clientActive.client_id,
          landing_id: landingActive.landing_id,
          landing_version_id: 'v1.2.0',
          anonymous_id: anonymousId,
          started_at: fourMinutesAgo,
          last_activity_at: fourMinutesAgo,
          device_type: 'desktop',
          browser: 'Firefox',
          browser_version: '100',
          os: 'Windows',
          os_version: '11',
          screen_width: 1920,
          screen_height: 1080,
          viewport_width: 1920,
          viewport_height: 1080,
          language: 'en',
          timezone: 'UTC',
          user_agent: 'Firefox',
          referrer: '',
          tracking_context: {},
          attribution: {
            source_type: 'direct',
            platform: null,
            source: 'direct',
            medium: 'none',
            campaign: 'none',
            content: 'none',
            term: 'none',
            attribution_confidence: 'unknown',
          },
        });

      await expect(
        ingestEventLogic({
          eventId: randomUUID(),
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          sessionId: dbDocId,
          eventType: 'page_view',
          occurredAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(/Forbidden: Session .* has expired due to inactivity/);
    });
  });

  // =========================================================================
  // 3. PUBLIC EVENT INGESTION, IDEMPOTENCY & VALIDATION
  // =========================================================================
  describe('Public Event Ingestion & Validations', () => {
    it('ingests valid page_view event, assigns server received_at, and updates session last_activity_at', async () => {
      const anonymousId = randomUUID();
      const sessionRes = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      const eventId = randomUUID();
      const eventRes = await ingestEventLogic({
        eventId,
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sessionRes.session.session_id,
        eventType: 'page_view',
        occurredAt: new Date().toISOString(),
        page: '/landing-promo',
      });

      expect(eventRes.isDuplicate).toBe(false);
      expect(eventRes.event.event_id).toBe(eventId);
      expect(eventRes.event.event_type).toBe('page_view');
      expect(eventRes.event.received_at).toBeDefined();

      // Verify session last_activity_at was updated
      const updatedSessionSnap = await db
        .collection('sessions')
        .doc(sessionRes.session.session_id)
        .get();
      expect(updatedSessionSnap.data()?.last_activity_at).toBe(
        eventRes.event.received_at,
      );
    });

    it('enforces idempotency on duplicate event_id and returns existing event without re-persisting', async () => {
      const anonymousId = randomUUID();
      const sessionRes = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      const eventId = randomUUID();
      const firstIngest = await ingestEventLogic({
        eventId,
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sessionRes.session.session_id,
        eventType: 'whatsapp_click',
        occurredAt: new Date().toISOString(),
      });

      expect(firstIngest.isDuplicate).toBe(false);

      // Second ingest call with same event_id
      const secondIngest = await ingestEventLogic({
        eventId,
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sessionRes.session.session_id,
        eventType: 'whatsapp_click',
        occurredAt: new Date().toISOString(),
      });

      expect(secondIngest.isDuplicate).toBe(true);
      expect(secondIngest.event.event_id).toBe(eventId);
    });

    it('rejects invalid event_type not among the 8 allowed types', async () => {
      await expect(
        ingestEventLogic({
          eventId: randomUUID(),
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          sessionId: randomUUID(),
          eventType: 'unauthorized_type' as any,
          occurredAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(/BadRequest: Invalid event_type/);
    });

    it('rejects non-UUID v4 event_id', async () => {
      await expect(
        ingestEventLogic({
          eventId: 'invalid_event_id_string',
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          sessionId: randomUUID(),
          eventType: 'page_view',
          occurredAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(/BadRequest: Invalid event_id UUID v4 format/);
    });

    it('rejects custom event_type if metadata event_name is missing', async () => {
      const anonymousId = randomUUID();
      const sessionRes = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      await expect(
        ingestEventLogic({
          eventId: randomUUID(),
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          sessionId: sessionRes.session.session_id,
          eventType: 'custom',
          occurredAt: new Date().toISOString(),
          metadata: {},
        }),
      ).rejects.toThrow(/requires a valid non-empty 'event_name' string/);
    });

    it('rejects public event metadata attempting to inject restricted fields', async () => {
      const anonymousId = randomUUID();
      const sessionRes = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      await expect(
        ingestEventLogic({
          eventId: randomUUID(),
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          sessionId: sessionRes.session.session_id,
          eventType: 'page_view',
          occurredAt: new Date().toISOString(),
          metadata: { lead_score: 100 },
        }),
      ).rejects.toThrow(/Restricted field 'lead_score' cannot be set/);
    });

    it('rejects orphan events with mismatched session/client/landing', async () => {
      const anonymousId = randomUUID();
      const sessionRes = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      // Mismatched landing_id (landingActive2 belongs to clientActive, but session was created for landingActive)
      await expect(
        ingestEventLogic({
          eventId: randomUUID(),
          clientId: clientActive.client_id,
          landingId: landingActive2.landing_id,
          sessionId: sessionRes.session.session_id,
          eventType: 'page_view',
          occurredAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(
        /Forbidden: Event client_id .* or landing_id .* does not match/,
      );
    });
  });

  // =========================================================================
  // 4. CIRCUIT BREAKER
  // =========================================================================
  describe('Circuit Breaker Enforcement', () => {
    it('rejects session creation when client status is suspended', async () => {
      await expect(
        createOrReuseSessionLogic({
          clientId: clientSuspended.client_id,
          landingId: landingOtherClient.landing_id,
          anonymousId: randomUUID(),
          deviceInfo: { device_type: 'desktop' },
          trackingContext: {},
        }),
      ).rejects.toThrow(
        /Circuit Breaker — Client 'acq_client_suspended' is suspended/,
      );
    });

    it('rejects event ingestion when landing operational_status is inactive', async () => {
      await expect(
        createOrReuseSessionLogic({
          clientId: clientActive.client_id,
          landingId: landingInactive.landing_id,
          anonymousId: randomUUID(),
          deviceInfo: { device_type: 'desktop' },
          trackingContext: {},
        }),
      ).rejects.toThrow(
        /Circuit Breaker — Landing 'acq_landing_inactive' is operational inactive/,
      );
    });
  });

  // =========================================================================
  // 5. OPTIONAL CAMPAIGN HIERARCHY
  // =========================================================================
  describe('Optional Campaign -> Adset -> Ad Hierarchy', () => {
    it('validates client_id isolation across Campaign, Adset, and Ad', async () => {
      const campaign: Campaign = {
        campaign_id: 'camp_01',
        client_id: clientActive.client_id,
        name: 'Campania Meta Spring',
        platform: 'meta',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await createCampaignLogic(campaign);

      const adset: Adset = {
        adset_id: 'adset_01',
        campaign_id: 'camp_01',
        client_id: clientActive.client_id,
        name: 'Adset Retargeting',
        platform: 'meta',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await createAdsetLogic(adset);

      const ad: Ad = {
        ad_id: 'ad_01',
        adset_id: 'adset_01',
        campaign_id: 'camp_01',
        client_id: clientActive.client_id,
        name: 'Ad Video Promo',
        platform: 'meta',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await createAdLogic(ad);

      // Verify cross-client Adset creation rejection
      const invalidAdset: Adset = {
        adset_id: 'adset_invalid',
        campaign_id: 'camp_01',
        client_id: 'other_client_id',
        name: 'Adset Mismatched',
        platform: 'meta',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await expect(createAdsetLogic(invalidAdset)).rejects.toThrow(
        /Forbidden: Adset client_id 'other_client_id' does not match parent campaign/,
      );
    });
  });
});
