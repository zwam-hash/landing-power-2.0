import type { Ad, Adset, Campaign } from '@zwam/types';
import { getFirestoreAdmin } from '../lib/firebase-admin.js';

export async function createCampaignLogic(
  campaign: Campaign,
): Promise<Campaign> {
  const db = getFirestoreAdmin();
  await db.collection('campaigns').doc(campaign.campaign_id).set(campaign);
  return campaign;
}

export async function createAdsetLogic(adset: Adset): Promise<Adset> {
  const db = getFirestoreAdmin();
  const campaignSnap = await db
    .collection('campaigns')
    .doc(adset.campaign_id)
    .get();

  if (!campaignSnap.exists) {
    throw new Error(
      `NotFound: Parent Campaign '${adset.campaign_id}' does not exist.`,
    );
  }

  const campaign = campaignSnap.data() as Campaign;
  if (campaign.client_id !== adset.client_id) {
    throw new Error(
      `Forbidden: Adset client_id '${adset.client_id}' does not match parent campaign client_id '${campaign.client_id}'.`,
    );
  }

  await db.collection('adsets').doc(adset.adset_id).set(adset);
  return adset;
}

export async function createAdLogic(ad: Ad): Promise<Ad> {
  const db = getFirestoreAdmin();
  const adsetSnap = await db.collection('adsets').doc(ad.adset_id).get();

  if (!adsetSnap.exists) {
    throw new Error(`NotFound: Parent Adset '${ad.adset_id}' does not exist.`);
  }

  const adset = adsetSnap.data() as Adset;
  if (
    adset.client_id !== ad.client_id ||
    adset.campaign_id !== ad.campaign_id
  ) {
    throw new Error(
      `Forbidden: Ad client_id/campaign_id mismatch with parent Adset.`,
    );
  }

  await db.collection('ads').doc(ad.ad_id).set(ad);
  return ad;
}
