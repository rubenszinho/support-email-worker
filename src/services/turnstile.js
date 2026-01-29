const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstile(token, ip, env) {
    if (!env.TURNSTILE_SECRET_KEY) {
        return true; // Skip verification if not configured
    }

    if (!token) {
        return false;
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            secret: env.TURNSTILE_SECRET_KEY,
            response: token,
            remoteip: ip,
        }),
    });

    const result = await response.json();
    return result.success;
}
