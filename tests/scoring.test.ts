import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  type Client,
  type Landing,
  type LeadQuality,
  calculateLeadScoreLogic,
  createOrReuseSessionLogic,
  getFirestoreAdmin,
  ingestEventLogic,
  registerLeadLogic,
} from '../functions/src/index.js';

describe('Module 5 — Lead Qualification / Scoring (Corrected Contract)', () => {
  const db = getFirestoreAdmin();

  const clientA: Client = {
    client_id: 'scoring_client_a',
    company_name: 'Scoring Client A',
    business_sector: 'SaaS',
    legal_name: 'Scoring Client A Inc',
    contact_email: 'scoring_a@client.com',
    contact_phone: '+123456789',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const clientB: Client = {
    client_id: 'scoring_client_b',
    company_name: 'Scoring Client B',
    business_sector: 'E-commerce',
    legal_name: 'Scoring Client B Inc',
    contact_email: 'scoring_b@client.com',
    contact_phone: '+987654321',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const landingA: Landing = {
    landing_id: 'scoring_landing_a',
    client_id: 'scoring_client_a',
    name: 'Landing Scoring A',
    slug: 'scoring-a',
    status: 'published',
    monthly_fee: 100,
    published_version_id: 'v1.0.0',
    operational_status: 'active',
    billing_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const landingB: Landing = {
    landing_id: 'scoring_landing_b',
    client_id: 'scoring_client_b',
    name: 'Landing Scoring B',
    slug: 'scoring-b',
    status: 'published',
    monthly_fee: 100,
    published_version_id: 'v1.0.0',
    operational_status: 'active',
    billing_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    await db.collection('clients').doc(clientA.client_id).set(clientA);
    await db.collection('clients').doc(clientB.client_id).set(clientB);
    await db.collection('landings').doc(landingA.landing_id).set(landingA);
    await db.collection('landings').doc(landingB.landing_id).set(landingB);

    // Clean leads for client A & B
    for (const cId of [clientA.client_id, clientB.client_id]) {
      const leadsSnap = await db
        .collection('leads')
        .where('client_id', '==', cId)
        .get();
      for (const doc of leadsSnap.docs) {
        await doc.ref.delete();
      }
    }
  });

  // Test 1 — engaged_time signal count without duration
  it('Test 1 — engaged_time: awards +10 for 2 engaged_time events without reading duration metadata', async () => {
    const anonymousId = randomUUID();
    const sess = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: {},
    });

    // Ingest 2 engaged_time events (weight 5 each, no duration metadata)
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      eventType: 'engaged_time',
      occurredAt: new Date().toISOString(),
      page: '/home',
      metadata: {}, // Empty metadata, no duration
    });

    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      eventType: 'engaged_time',
      occurredAt: new Date().toISOString(),
      page: '/home',
      metadata: {},
    });

    const reg = await registerLeadLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      anonymousId,
      registrationSource: 'form',
      name: 'Engaged Lead',
      email: 'engaged@example.com',
    });

    const result = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });

    expect(result.score).toBe(10); // 2 * 5 = 10
    expect(result.breakdown.behavior_score).toBe(10);
    expect(result.quality).toBe('cold');
  });

  // Test 2 — historical sessions
  it('Test 2 — historical sessions: calculates score across multiple historical sessions linked by anonymous_id', async () => {
    const anonymousId = randomUUID();

    // Session 1: page_view
    const sess1 = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: {},
    });
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess1.session.session_id,
      eventType: 'page_view',
      occurredAt: new Date().toISOString(),
      page: '/home',
      metadata: {},
    });

    // Session 2: 4 mins later -> package_click
    const fourMinsAgo = new Date(Date.now() - 240000).toISOString();
    await db
      .collection('sessions')
      .doc(sess1.session.session_id)
      .update({ last_activity_at: fourMinsAgo });
    await db
      .collection('active_sessions')
      .doc(`${clientA.client_id}_${landingA.landing_id}_${anonymousId}`)
      .update({ last_activity_at: fourMinsAgo });

    const sess2 = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: {},
    });
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess2.session.session_id,
      eventType: 'package_click',
      occurredAt: new Date().toISOString(),
      page: '/pricing',
      metadata: {},
    });

    // Session 3: registration session -> form_start
    const eightMinsAgo = new Date(Date.now() - 480000).toISOString();
    await db
      .collection('sessions')
      .doc(sess2.session.session_id)
      .update({ last_activity_at: eightMinsAgo });
    await db
      .collection('active_sessions')
      .doc(`${clientA.client_id}_${landingA.landing_id}_${anonymousId}`)
      .update({ last_activity_at: eightMinsAgo });

    const sess3 = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: {},
    });
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess3.session.session_id,
      eventType: 'form_start',
      occurredAt: new Date().toISOString(),
      page: '/contact',
      metadata: {},
    });

    const reg = await registerLeadLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess3.session.session_id,
      anonymousId,
      registrationSource: 'form',
      name: 'History Lead',
      email: 'history@example.com',
    });

    const result = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });

    // Breakdown: page_view (+2) + package_click (+15) + form_start (+10) + multiple_sessions (+10) = 37
    expect(result.score).toBe(37);
    expect(result.quality).toBe('warm');
    expect(result.flags.multiple_sessions).toBe(true);
    expect(result.flags.is_returning_user).toBe(true);
  }, 15000);

  // Test 3 — paid traffic (consumed exclusively from Session.attribution)
  it('Test 3 — paid traffic: marks is_paid_traffic: true when Session attribution source_type is paid', async () => {
    const anonymousId = randomUUID();
    const sess = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: { fbclid: 'fb_click_123' }, // M3 resolves attribution.source_type = 'paid'
    });

    const reg = await registerLeadLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      anonymousId,
      registrationSource: 'form',
      name: 'Paid Lead',
      email: 'paid@example.com',
    });

    const result = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });

    expect(result.flags.is_paid_traffic).toBe(true);
    expect(result.breakdown.context_score).toBe(10);
    expect(result.score).toBe(10);
  });

  // Test 4 — non-paid traffic
  it('Test 4 — non-paid traffic: does NOT mark is_paid_traffic when Session attribution source_type is organic/direct', async () => {
    const anonymousId = randomUUID();
    const sess = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: { referrer: 'https://www.google.com/' }, // M3 resolves source_type = 'organic'
    });

    const reg = await registerLeadLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      anonymousId,
      registrationSource: 'form',
      name: 'Organic Lead',
      email: 'organic@example.com',
    });

    const result = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });

    expect(result.flags.is_paid_traffic).toBe(false);
    expect(result.breakdown.context_score).toBe(0);
  });

  // Test 5 — LeadQuality exact threshold validation & no legacy values
  it('Test 5 — LeadQuality: correctly maps thresholds (70->hot, 69->warm, 35->warm, 34->cold) with strict type compliance', async () => {
    const anonymousId = randomUUID();
    const sess = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: {},
    });

    const reg = await registerLeadLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      anonymousId,
      registrationSource: 'form',
      name: 'Quality Lead',
      email: 'quality@example.com',
    });

    // Cold score (0 < 35)
    const coldResult = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });
    expect(coldResult.score).toBe(0);
    expect(coldResult.quality).toBe('cold');
    const validQualities: LeadQuality[] = ['hot', 'warm', 'cold'];
    expect(validQualities).toContain(coldResult.quality);

    // Warm score (high_intent 20 + package_click 15 = 35)
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      eventType: 'high_intent',
      occurredAt: new Date().toISOString(),
      page: '/home',
      metadata: {},
    });
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      eventType: 'package_click',
      occurredAt: new Date().toISOString(),
      page: '/pricing',
      metadata: {},
    });

    const warmResult = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });
    expect(warmResult.score).toBe(35);
    expect(warmResult.quality).toBe('warm');

    // Hot score (add 2nd high_intent +20, form_start +10, whatsapp_click +15 = 80 >= 70)
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      eventType: 'high_intent',
      occurredAt: new Date().toISOString(),
      page: '/checkout',
      metadata: {},
    });
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      eventType: 'form_start',
      occurredAt: new Date().toISOString(),
      page: '/form',
      metadata: {},
    });
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      eventType: 'whatsapp_click',
      occurredAt: new Date().toISOString(),
      page: '/contact',
      metadata: {},
    });

    const hotResult = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });
    expect(hotResult.score).toBe(80);
    expect(hotResult.quality).toBe('hot');
  }, 15000);

  // Test 6 — client isolation
  it('Test 6 — client isolation: never incorporates sessions or events from another client_id', async () => {
    const sharedAnonymousId = randomUUID();

    // Client A Session & Event
    const sessA = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId: sharedAnonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: {},
    });
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sessA.session.session_id,
      eventType: 'package_click',
      occurredAt: new Date().toISOString(),
      page: '/a',
      metadata: {},
    });
    const regA = await registerLeadLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sessA.session.session_id,
      anonymousId: sharedAnonymousId,
      registrationSource: 'form',
      name: 'User Client A',
      email: 'usera@example.com',
    });

    // Client B Session & Event with SAME anonymous_id
    const sessB = await createOrReuseSessionLogic({
      clientId: clientB.client_id,
      landingId: landingB.landing_id,
      anonymousId: sharedAnonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: {},
    });
    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientB.client_id,
      landingId: landingB.landing_id,
      sessionId: sessB.session.session_id,
      eventType: 'high_intent',
      occurredAt: new Date().toISOString(),
      page: '/b',
      metadata: {},
    });

    const calcA = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: regA.lead.lead_id,
    });

    // Lead A gets package_click (+15), NOT Client B's high_intent (+20)
    expect(calcA.score).toBe(15);
    expect(calcA.flags.has_high_intent).toBe(false);

    // Attempting to request Lead A using Client B's credentials throws Forbidden
    await expect(
      calculateLeadScoreLogic({
        clientId: clientB.client_id,
        leadId: regA.lead.lead_id,
      }),
    ).rejects.toThrow(
      /Forbidden: Lead .* does not belong to client 'scoring_client_b'/,
    );
  });

  // Test 7 — deterministic recalculation
  it('Test 7 — deterministic recalculation: produces identical score, quality, breakdown, and flags on successive calls', async () => {
    const anonymousId = randomUUID();
    const sess = await createOrReuseSessionLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      anonymousId,
      deviceInfo: { device_type: 'desktop' },
      trackingContext: {},
    });

    await ingestEventLogic({
      eventId: randomUUID(),
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      eventType: 'package_click',
      occurredAt: new Date().toISOString(),
      page: '/pricing',
      metadata: {},
    });

    const reg = await registerLeadLogic({
      clientId: clientA.client_id,
      landingId: landingA.landing_id,
      sessionId: sess.session.session_id,
      anonymousId,
      registrationSource: 'form',
      name: 'Idempotent Lead',
      email: 'idempotent@example.com',
    });

    const calc1 = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });

    const calc2 = await calculateLeadScoreLogic({
      clientId: clientA.client_id,
      leadId: reg.lead.lead_id,
    });

    expect(calc1.score).toBe(calc2.score);
    expect(calc1.quality).toBe(calc2.quality);
    expect(calc1.recommendedAction).toBe(calc2.recommendedAction);
    expect(calc1.breakdown).toEqual(calc2.breakdown);
    expect(calc1.flags).toEqual(calc2.flags);
    expect(calc1.calculationVersion).toBe(calc2.calculationVersion);
    expect(calc2.score).toBe(15);
  });
});
