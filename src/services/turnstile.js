const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstile(token, ip, env) {
    if (!env.TURNSTILE_SECRET_KEY) {
        return true; // Skip verification if not configured
    }

    if (!token) {
        console.log('Turnstile verification failed: No token provided');
        return false;
    }

    try {
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

        if (!result.success) {
            console.log('Turnstile verification failed:', result['error-codes']);
        }

        return result.success;
    } catch (error) {
        console.log('Turnstile verification error:', error.message);
        return false;
    }
}
