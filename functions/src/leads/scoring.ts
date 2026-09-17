import type {
  Event,
  Lead,
  LeadQuality,
  RecommendedAction,
  ScoreBreakdown,
  ScoreFlags,
  ScoringRule,
  Session,
} from '@zwam/types';
import { getFirestoreAdmin } from '../lib/firebase-admin.js';

export interface CalculateLeadScoreParams {
  clientId: string;
  leadId: string;
  rulesConfig?: ScoringRule[];
}

export interface CalculateLeadScoreResult {
  lead: Lead;
  score: number;
  quality: LeadQuality;
  recommendedAction: RecommendedAction;
  breakdown: ScoreBreakdown;
  flags: ScoreFlags;
  calculationVersion: string;
  lastCalculatedAt: string;
}

export const DEFAULT_V1_SCORING_RULES: ScoringRule[] = [
  { signal: 'page_view', weight: 2, cap: 10, active: true },
  { signal: 'engaged_time', weight: 5, cap: 15, active: true },
  { signal: 'high_intent', weight: 20, cap: 40, active: true },
  { signal: 'package_click', weight: 15, cap: 30, active: true },
  { signal: 'form_start', weight: 10, cap: 20, active: true },
  { signal: 'whatsapp_click', weight: 15, cap: 30, active: true },
  { signal: 'multiple_sessions', weight: 10, cap: 10, active: true },
  { signal: 'is_paid_traffic', weight: 10, cap: 10, active: true },
];

export async function calculateLeadScoreLogic(
  params: CalculateLeadScoreParams,
): Promise<CalculateLeadScoreResult> {
  const { clientId, leadId, rulesConfig } = params;

  const db = getFirestoreAdmin();

  // 1. Fetch Lead & verify existence and client isolation
  const leadSnap = await db.collection('leads').doc(leadId).get();
  if (!leadSnap.exists) {
    throw new Error(`NotFound: Lead '${leadId}' not found.`);
  }

  const existingLead = leadSnap.data() as Lead;
  if (existingLead.client_id !== clientId) {
    throw new Error(
      `Forbidden: Lead '${leadId}' does not belong to client '${clientId}'.`,
    );
  }

  // 2. Fetch historical sessions for anonymous_id and client_id
  const sessionsSnap = await db
    .collection('sessions')
    .where('client_id', '==', clientId)
    .where('anonymous_id', '==', existingLead.anonymous_id)
    .get();

  const sessions: Session[] = sessionsSnap.docs.map(
    (doc) => doc.data() as Session,
  );

  // 3. Fetch events belonging to these sessions
  const sessionIds = sessions.map((s) => s.session_id);
  let events: Event[] = [];

  if (sessionIds.length > 0) {
    // Firestore `in` queries allow max 30 elements per array
    const chunkSize = 30;
    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const chunk = sessionIds.slice(i, i + chunkSize);
      const eventsSnap = await db
        .collection('events')
        .where('client_id', '==', clientId)
        .where('session_id', 'in', chunk)
        .get();

      const chunkEvents = eventsSnap.docs.map((doc) => doc.data() as Event);
      events = events.concat(chunkEvents);
    }
  }

  // 4. Count events by type
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    const type = event.event_type;
    eventCounts[type] = (eventCounts[type] || 0) + 1;
  }

  // Derived signals
  const sessionCount = sessions.length;
  const isMultipleSessions = sessionCount > 1;
  const isPaidTraffic = sessions.some(
    (s) => s.attribution && s.attribution.source_type === 'paid',
  );

  const activeRules = rulesConfig || DEFAULT_V1_SCORING_RULES;

  // Signal breakdown scores
  let behaviorScore = 0;
  let intentScore = 0;
  let contextScore = 0;

  const BEHAVIOR_SIGNALS = ['page_view', 'engaged_time', 'multiple_sessions'];
  const INTENT_SIGNALS = [
    'high_intent',
    'package_click',
    'form_start',
    'whatsapp_click',
  ];
  const CONTEXT_SIGNALS = ['is_paid_traffic'];

  for (const rule of activeRules) {
    if (!rule.active) continue;

    let points = 0;
    if (rule.signal === 'multiple_sessions') {
      if (isMultipleSessions) {
        points = rule.weight;
      }
    } else if (rule.signal === 'is_paid_traffic') {
      if (isPaidTraffic) {
        points = rule.weight;
      }
    } else {
      const count = eventCounts[rule.signal] || 0;
      points = count * rule.weight;
    }

    if (rule.cap !== undefined) {
      points = Math.min(points, rule.cap);
    }

    if (BEHAVIOR_SIGNALS.includes(rule.signal)) {
      behaviorScore += points;
    } else if (INTENT_SIGNALS.includes(rule.signal)) {
      intentScore += points;
    } else if (CONTEXT_SIGNALS.includes(rule.signal)) {
      contextScore += points;
    }
  }

  const rawTotalScore = behaviorScore + intentScore + contextScore;
  const score = Math.min(100, Math.max(0, rawTotalScore));

  const breakdown: ScoreBreakdown = {
    behavior_score: behaviorScore,
    intent_score: intentScore,
    context_score: contextScore,
  };

  // 5. Determine Quality & Recommended Action
  let quality: LeadQuality;
  let recommendedAction: RecommendedAction;

  if (score >= 70) {
    quality = 'hot';
    recommendedAction = 'immediate_priority';
  } else if (score >= 35) {
    quality = 'warm';
    recommendedAction = 'follow_up';
  } else {
    quality = 'cold';
    recommendedAction = 'nurturing';
  }

  // 6. Generate Flags
  const flags: ScoreFlags = {
    is_paid_traffic: isPaidTraffic,
    is_returning_user: isMultipleSessions,
    has_high_intent: (eventCounts['high_intent'] || 0) > 0,
    whatsapp_interest: (eventCounts['whatsapp_click'] || 0) > 0,
    package_interest: (eventCounts['package_click'] || 0) > 0,
    multiple_sessions: isMultipleSessions,
  };

  const calculationVersion = 'v1';
  const lastCalculatedAt = new Date().toISOString();

  // 7. Persist updated lead
  const updatedLead: Lead = {
    ...existingLead,
    lead_score: score,
    lead_quality: quality,
    recommended_action: recommendedAction,
    score_breakdown: breakdown,
    score_flags: flags,
    calculation_version: calculationVersion,
    last_calculated_at: lastCalculatedAt,
    updated_at: lastCalculatedAt,
  };

  await db.collection('leads').doc(leadId).set(updatedLead);

  return {
    lead: updatedLead,
    score,
    quality,
    recommendedAction,
    breakdown,
    flags,
    calculationVersion,
    lastCalculatedAt,
  };
}
