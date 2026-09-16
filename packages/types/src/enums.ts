export type ClientStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type ClientContactStatus = 'active' | 'inactive';

export type UserStatus = 'active' | 'disabled' | 'pending';

export type MembershipStatus = 'active' | 'invited' | 'disabled';

export type ContractStatus = 'active' | 'expired' | 'terminated' | 'draft';

export type SubscriptionStatus =
  'active' | 'past_due' | 'cancelled' | 'trialing';

export type ModuleStatus = 'active' | 'beta' | 'deprecated' | 'disabled';

export type ClientModuleStatus = 'active' | 'inactive' | 'configured';

export type LandingStatus = 'draft' | 'published' | 'archived';

export type LandingOperationalStatus = 'active' | 'inactive' | 'maintenance';

export type LandingBillingStatus = 'active' | 'past_due' | 'cancelled';

export type LandingVersionStatus = 'draft' | 'published' | 'archived';

export type CampaignStatus = 'active' | 'paused' | 'archived';

export type AdsetStatus = 'active' | 'paused' | 'archived';

export type AdStatus = 'active' | 'paused' | 'archived';

export type EventType =
  | 'page_view'
  | 'scroll'
  | 'engaged_time'
  | 'high_intent'
  | 'package_click'
  | 'form_start'
  | 'whatsapp_click'
  | 'custom';

export type LeadQuality = 'priority' | 'high' | 'medium' | 'low' | 'cold';

export type RecommendedAction =
  | 'immediate_priority'
  | 'fast_contact'
  | 'follow_up'
  | 'nurturing'
  | 'remarketing';

export type LeadStatus =
  'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'cancelled';

export type SaleStatus = 'closed' | 'refunded' | 'disputed';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export type CRMRecordSyncStatus = 'synced' | 'pending' | 'failed';

export type CapiStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type AuditResourceType =
  | 'client'
  | 'user'
  | 'landing'
  | 'lead'
  | 'opportunity'
  | 'sale'
  | 'integration';
