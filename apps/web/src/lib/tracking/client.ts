import type { Event, Session, TrackingContext } from '@zwam/types';

export interface CreateSessionRequest {
  clientId: string;
  landingId: string;
  anonymousId: string;
  userId?: string;
  deviceInfo: Record<string, unknown>;
  trackingContext: TrackingContext;
}

export interface IngestEventRequest {
  eventId: string;
  clientId: string;
  landingId: string;
  sessionId: string;
  eventType: string;
  occurredAt: string;
  page?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Public HTTP Client for Acquisition Public Event API Endpoints.
 */
export class AcquisitionApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async createOrReuseSession(
    req: CreateSessionRequest,
  ): Promise<{ session: Session; isReused: boolean }> {
    const res = await fetch(`${this.baseUrl}/createOrReuseSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`SessionIngestionError (${res.status}): ${errText}`);
    }

    return res.json();
  }

  async ingestEvent(
    req: IngestEventRequest,
  ): Promise<{ event: Event; isDuplicate: boolean }> {
    const res = await fetch(`${this.baseUrl}/ingestEvent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`EventIngestionError (${res.status}): ${errText}`);
    }

    return res.json();
  }

  async registerLead(req: {
    clientId: string;
    landingId: string;
    sessionId: string;
    anonymousId: string;
    registrationSource: 'form' | 'whatsapp_preform';
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    city?: string;
  }): Promise<{ lead: any; isNew: boolean }> {
    const res = await fetch(`${this.baseUrl}/registerLead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LeadRegistrationError (${res.status}): ${errText}`);
    }

    return res.json();
  }
}
