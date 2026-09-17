import type { Client, Landing } from '@zwam/types';
import { getFirestoreAdmin } from './firebase-admin.js';

export async function checkCircuitBreaker(
  clientId: string,
  landingId: string,
): Promise<{ client: Client; landing: Landing }> {
  const db = getFirestoreAdmin();

  // 1. Fetch Client
  const clientSnap = await db.collection('clients').doc(clientId).get();
  if (!clientSnap.exists) {
    throw new Error(`NotFound: Client '${clientId}' does not exist.`);
  }

  const client = clientSnap.data() as Client;
  if (client.status === 'suspended') {
    throw new Error(
      `Forbidden: Circuit Breaker — Client '${clientId}' is suspended.`,
    );
  }
  if (client.status !== 'active') {
    throw new Error(
      `Forbidden: Client '${clientId}' is not active (status: ${client.status}).`,
    );
  }

  // 2. Fetch Landing
  const landingSnap = await db.collection('landings').doc(landingId).get();
  if (!landingSnap.exists) {
    throw new Error(`NotFound: Landing '${landingId}' does not exist.`);
  }

  const landing = landingSnap.data() as Landing;
  if (landing.client_id !== clientId) {
    throw new Error(
      `Forbidden: Landing '${landingId}' does not belong to client '${clientId}'.`,
    );
  }

  if (landing.operational_status === 'inactive') {
    throw new Error(
      `Forbidden: Circuit Breaker — Landing '${landingId}' is operational inactive.`,
    );
  }

  return { client, landing };
}
