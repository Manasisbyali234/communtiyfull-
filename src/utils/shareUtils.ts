import { Platform, Share } from 'react-native';
import { apiClient } from '../api/client';

export async function trackShare(sharerId: string, sharedWith?: string, sharedEmail?: string) {
  try {
    await apiClient.post('/referral/share', { sharedWith, sharedEmail });
  } catch { /* non-blocking */ }
}

export async function shareUrl(message: string, url?: string, sharerId?: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message });
      if (sharerId) trackShare(sharerId);
      return true;
    } catch {
      return false;
    }
  }

  const shareTarget = url ?? (typeof window !== 'undefined' ? window.location.href : '');

  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: 'GowdaCommunity', text: message, url: shareTarget });
      if (sharerId) trackShare(sharerId);
      return true;
    }
  } catch { /* dismissed */ }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareTarget);
      if (sharerId) trackShare(sharerId);
      return true;
    }
  } catch { /* unavailable on HTTP */ }

  // execCommand fallback — works on plain HTTP (local IP dev servers)
  try {
    const el = document.createElement('textarea');
    el.value = shareTarget;
    el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (ok && sharerId) trackShare(sharerId);
    return ok;
  } catch {
    return false;
  }
}
