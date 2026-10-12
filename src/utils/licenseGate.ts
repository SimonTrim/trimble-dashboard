/**
 * Vérification licence développeur (email Trimble Connect autorisé).
 */

declare const __LICENSE_API_URL__: string;
declare const __SKIP_LICENSE__: boolean;

export type LicenseGateResult =
  | { ok: true }
  | { ok: false; error: string };

function licenseApiBase(): string {
  const fromBuild = typeof __LICENSE_API_URL__ !== 'undefined' ? __LICENSE_API_URL__ : '';
  const fromWindow = (window as { LICENSE_API_URL?: string }).LICENSE_API_URL ?? '';
  return (fromBuild || fromWindow).replace(/\/$/, '');
}

export async function verifyLicenseAccess(
  accessToken: string,
  isEmbedded: boolean
): Promise<LicenseGateResult> {
  if (!isEmbedded) {
    const skip =
      (typeof __SKIP_LICENSE__ !== 'undefined' && __SKIP_LICENSE__) ||
      (window as { SKIP_LICENSE?: boolean }).SKIP_LICENSE === true;
    if (skip) {
      return { ok: true };
    }
    return {
      ok: false,
      error: 'Mode local : définir VITE_SKIP_LICENSE=true dans .env.local',
    };
  }

  const apiBase = licenseApiBase();
  if (!apiBase) {
    return { ok: false, error: 'VITE_LICENSE_API_URL non configuré.' };
  }

  try {
    const response = await fetch(`${apiBase}/verify-license`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      error: 'Accès non autorisé pour ce compte Trimble Connect.',
    };
  } catch {
    return { ok: false, error: 'Impossible de vérifier la licence.' };
  }
}
