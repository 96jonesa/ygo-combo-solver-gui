/**
 * Best-effort update check (YGO-18). Queries the GitHub Releases API for the
 * latest published tag and compares it to the running version. Never throws:
 * offline, rate-limited, or malformed responses just yield null. There is no
 * auto-download — the result feeds a dismissible "new version" banner; the
 * user upgrades manually (see docs/INSTALL.md).
 */

const RELEASES_API = 'https://api.github.com/repos/96jonesa/ygo-combo-solver-gui/releases/latest';
const RELEASES_PAGE = 'https://github.com/96jonesa/ygo-combo-solver-gui/releases/latest';

export interface UpdateInfo {
  latest: string;
  url: string;
}

/** Parse "v1.2.3" / "1.2.3" into numeric parts; null if not a plain semver. */
function parseVersion(tag: string): number[] | null {
  const m = tag.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True when `latest` is a strictly higher version than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (a === null || b === null) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return false;
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(RELEASES_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ygo-combo-solver-gui',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const body = (await res.json()) as { tag_name?: string; html_url?: string };
    const tag = body.tag_name;
    if (typeof tag !== 'string' || !isNewer(tag, currentVersion)) return null;
    return { latest: tag.replace(/^v/, ''), url: body.html_url ?? RELEASES_PAGE };
  } catch {
    return null;
  }
}
