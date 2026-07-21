import { Platform, Share } from 'react-native';
import { apiClient } from '../api/client';

const APP_STORE_URL = 'https://apps.apple.com/app/id<YOUR_APP_ID>';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mmdevteam.communityapp';
const WEB_APP_URL = 'https://community-api.metromindz.com';
const APK_DOWNLOAD_URL = 'https://drive.google.com/your-apk-link-here'; // 👈 replace with your Drive/EAS link

export function getAppDownloadLink(referrerId?: string): string {
  // Until published on stores, always use the direct APK download link
  const base = APK_DOWNLOAD_URL || (Platform.OS === 'ios' ? APP_STORE_URL
    : Platform.OS === 'android' ? PLAY_STORE_URL
    : WEB_APP_URL);
  return referrerId ? `${base}${base.includes('?') ? '&' : '?'}ref=${referrerId}` : base;
}

export async function trackShare(sharerId: string, sharedWith?: string, sharedEmail?: string) {
  try {
    await apiClient.post('/referral/share', { sharedWith, sharedEmail });
  } catch { /* non-blocking */ }
}

export async function shareAppLink(displayName: string, referrerId?: string): Promise<boolean> {
  const link = getAppDownloadLink(referrerId);
  const message = `Hey! ${displayName} has invited you to join the GowdaCommunity app. Connect with family and community members, stay updated on events, and more!\n\nDownload here: ${link}`;

  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message, url: link });
      if (referrerId) trackShare(referrerId);
      return true;
    } catch {
      return false;
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: 'Join GowdaCommunity', text: message, url: link });
      if (referrerId) trackShare(referrerId);
      return true;
    }
  } catch { /* dismissed */ }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      if (referrerId) trackShare(referrerId);
      return true;
    }
  } catch { /* unavailable on HTTP */ }

  // execCommand fallback — works on plain HTTP
  try {
    const el = document.createElement('textarea');
    el.value = link;
    el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (ok && referrerId) trackShare(referrerId);
    return ok;
  } catch {
    return false;
  }
}

// Keep old shareUrl for backward compatibility
export async function shareUrl(message: string, url?: string, sharerId?: string): Promise<boolean> {
  return shareAppLink(message, sharerId);
}
