import type { VercelRequest, VercelResponse } from '@vercel/node';

const TC_REGION_HOSTS = [
  'https://app.connect.trimble.com', // US
  'https://app21.connect.trimble.com', // EU
  'https://app22.connect.trimble.com', // AP
  'https://app23.connect.trimble.com', // AU
];

function allowedEmails(): string[] {
  return (process.env.LICENSE_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

async function fetchTrimbleUser(token: string): Promise<{ email?: string } | null> {
  for (const host of TC_REGION_HOSTS) {
    try {
      const response = await fetch(`${host}/tc/api/2.0/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        return (await response.json()) as { email?: string };
      }
    } catch {
      // Essayer la région suivante
    }
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ authorized: false, error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ authorized: false });
  }

  const token = authHeader.slice('Bearer '.length);
  const allowlist = allowedEmails();

  if (!allowlist.length) {
    return res.status(503).json({
      authorized: false,
      error: 'LICENSE_ALLOWED_EMAILS non configuré sur Vercel',
    });
  }

  try {
    const user = await fetchTrimbleUser(token);

    if (!user) {
      return res.status(403).json({ authorized: false });
    }

    const email = user.email?.trim().toLowerCase() ?? '';

    if (!email || !allowlist.includes(email)) {
      return res.status(403).json({ authorized: false });
    }

    return res.status(200).json({ authorized: true, email });
  } catch {
    return res.status(500).json({ authorized: false });
  }
}
