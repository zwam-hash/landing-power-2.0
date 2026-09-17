import type {
  AdStatus,
  AdsetStatus,
  AttributionConfidence,
  AttributionPlatform,
  AuditResourceType,
  CampaignStatus,
  CapiStatus,
  ClientContactStatus,
  ClientModuleStatus,
  ClientStatus,
  ContractStatus,
  CRMRecordSyncStatus,
  DataScope,
  EventType,
  IntegrationStatus,
  LandingBillingStatus,
  LandingOperationalStatus,
  LandingStatus,
  LandingVersionStatus,
  LeadQuality,
  LeadStatus,
  MembershipStatus,
  ModuleStatus,
  OpportunityStatus,
  Permission,
  RecommendedAction,
  Role,
  SaleStatus,
  SourceType,
  SubscriptionStatus,
  UserStatus,
} from './enums.js';

// ==========================================
// CORE DOMAIN
// ==========================================

export interface Client {
  client_id: string;
  company_name: string;
  business_sector: string;
  legal_name: string;
  contact_email: string;
  contact_phone: string;
  status: ClientStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ClientContact {
  contact_id: string;
  client_id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: ClientContactStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface User {
  user_id: string;
  email: string;
  display_name: string;
  status: UserStatus;
  is_global_admin?: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Membership {
  membership_id: string;
  user_id: string;
  client_id: string;
  role: Role;
  data_scope: DataScope;
  permissions: string[] | Permission[];
  status: MembershipStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Contract {
  contract_id: string;
  client_id: string;
  status: ContractStatus;
  start_date: Date | string;
  end_date?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Subscription {
  subscription_id: string;
  client_id: string;
  plan: string;
  status: SubscriptionStatus;
  monthly_fee: number;
  currency: string;
  start_date: Date | string;
  end_date?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Module {
  module_id: string;
  key: string;
  name: string;
  description: string;
  status: ModuleStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ClientModule {
  client_module_id: string;
  client_id: string;
  module_id: string;
  status: ClientModuleStatus;
  configuration: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}

// ==========================================
// ACQUISITION DOMAIN
// ==========================================

export interface Landing {
  landing_id: string;
  client_id: string;
  name: string;
  slug: string;
  status: LandingStatus;
  monthly_fee: number;
  draft_version_id?: string;
  published_version_id?: string;
  operational_status: LandingOperationalStatus;
  billing_status: LandingBillingStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface LandingVersion {
  landing_version_id: string;
  landing_id: string;
  client_id: string;
  version: number;
  status: LandingVersionStatus;
  configuration: Record<string, unknown>;
  content: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
  published_at?: Date | string;
}

export interface Campaign {
  campaign_id: string;
  client_id: string;
  landing_id?: string;
  external_id?: string;
  name: string;
  platform: AttributionPlatform | string;
  status: CampaignStatus;
  budget?: number;
  start_date?: Date | string;
  end_date?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Adset {
  adset_id: string;
  campaign_id: string;
  client_id: string;
  external_id?: string;
  name: string;
  platform?: AttributionPlatform | string;
  status: AdsetStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Ad {
  ad_id: string;
  adset_id: string;
  campaign_id: string;
  client_id: string;
  external_id?: string;
  name: string;
  platform?: AttributionPlatform | string;
  status: AdStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TrackingContext {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;

  fbclid?: string;
  fbp?: string;
  fbc?: string;

  gclid?: string;
  wbraid?: string;
  gbraid?: string;

  ttclid?: string;

  referrer?: string;
  landing_url?: string;
}

export interface Attribution {
  source_type: SourceType;
  platform: AttributionPlatform | null;

  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;

  attribution_confidence: AttributionConfidence;

  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
}

export interface Session {
  session_id: string;
  client_id: string;
  landing_id: string;
  landing_version_id: string;
  anonymous_id: string;
  user_id?: string;

  started_at: Date | string;
  last_activity_at: Date | string;

  device_type: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;

  screen_width: number;
  screen_height: number;
  viewport_width: number;
  viewport_height: number;

  language: string;
  timezone: string;

  user_agent: string;
  referrer: string;

  tracking_context: TrackingContext;
  attribution: Attribution;
}

export interface Event {
  event_id: string;
  client_id: string;
  landing_id: string;
  session_id: string;

  event_type: EventType;

  occurred_at: Date | string;
  received_at: Date | string;

  page: string;
  metadata: Record<string, unknown>;
}

// ==========================================
// LEADS DOMAIN
// ==========================================

export interface ScoreBreakdown {
  behavior_score: number;
  intent_score: number;
  context_score: number;
}

export interface ScoreFlags {
  is_paid_traffic: boolean;
  is_returning_user: boolean;
  has_high_intent: boolean;
}

export interface LeadAttribution extends Attribution {
  landing_id?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
}

export interface Lead {
  lead_id: string;
  client_id: string;
  landing_id: string;
  session_id: string;

  name: string;
  email: string;
  phone: string;

  attribution: LeadAttribution;

  lead_score: number;
  lead_quality: LeadQuality;
  recommended_action: RecommendedAction;
  score_breakdown: ScoreBreakdown;
  score_flags: ScoreFlags;
  scoring_configuration_version: string;

  status: LeadStatus;
  capi_status: CapiStatus;

  created_at: Date | string;
  updated_at: Date | string;
}

// Alias interfaces for consistency
export interface LeadScore {
  score: number;
  quality: LeadQuality;
  recommended_action: RecommendedAction;
  breakdown: ScoreBreakdown;
  flags: ScoreFlags;
}

// ==========================================
// COMMERCIAL DOMAIN
// ==========================================

export interface Opportunity {
  opportunity_id: string;
  client_id: string;
  lead_id: string;
  status: OpportunityStatus;
  value: number;
  currency: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Sale {
  sale_id: string;
  client_id: string;
  lead_id: string;
  opportunity_id?: string;
  value: number;
  currency: string;
  status: SaleStatus;
  sold_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Revenue {
  client_id: string;
  period: string;
  total_revenue: number;
  currency: string;
  sales_count: number;
  created_at: Date | string;
  updated_at: Date | string;
}

// ==========================================
// INTEGRATIONS DOMAIN
// ==========================================

export interface Integration {
  integration_id: string;
  client_id: string;
  type: string;
  status: IntegrationStatus;
  configuration_ref: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CRMRecord {
  crm_record_id: string;
  client_id: string;
  lead_id: string;
  external_id: string;
  system: string;
  status: CRMRecordSyncStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CapiLog {
  capi_log_id: string;
  client_id: string;
  lead_id: string;
  event_name: string;
  status: CapiStatus;
  response_code?: number;
  error_message?: string;
  created_at: Date | string;
}

// ==========================================
// OPERATIONS DOMAIN
// ==========================================

export interface AuditLog {
  audit_log_id: string;
  client_id: string;
  actor_user_id: string;
  action: string;
  resource_type: AuditResourceType;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: Date | string;
}

export interface Usage {
  usage_id: string;
  client_id: string;
  metric: string;
  value: number;
  period: string;
  created_at: Date | string;
  updated_at: Date | string;
}
