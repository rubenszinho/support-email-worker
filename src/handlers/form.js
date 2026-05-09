import { jsonResponse } from '../utils/cors.js';
import { validateFormData } from '../utils/validation.js';
import { resolveSiteConfig } from '../utils/domain.js';
import { verifyTurnstile } from '../services/turnstile.js';
import { sendFormNotification } from '../services/slack.js';
import { forwardSubmission } from '../services/forward.js';
import { sendAutoReply } from '../services/resend.js';

/**
 * Handle contact form submission.
 *
 * Email pipeline (two independent transports — one can fail without breaking the other):
 *   1. forwardSubmission(): Cloudflare `send_email` binding → internal inbox(es)
 *      listed in env.FORWARD_EMAIL_LIST. Free, but recipients must be verified
 *      Email Routing destinations.
 *   2. sendAutoReply(): Resend HTTP API → form submitter. Uses a single
 *      verified sender domain (env.RESEND_FROM_EMAIL) since the free plan
 *      restricts to one domain.
 *
 * Slack notification stays optional. All three side-effects are wrapped so the
 * caller always gets a 200 once validation + Turnstile pass.
 */
export async function handleFormSubmission(request, env) {
    try {
        const data = await request.json();
        const { name, email, subject, message, turnstileToken, honeypot } = data;

        if (honeypot) {
            return jsonResponse({ success: true }, 200, env, request); // Silently accept but don't process
        }

        const validation = validateFormData({ name, email, subject, message });
        if (!validation.valid) {
            return jsonResponse({ error: validation.error }, 400, env, request);
        }

        if (env.TURNSTILE_SECRET_KEY) {
            const ip = request.headers.get('CF-Connecting-IP') || '';
            const isValid = await verifyTurnstile(turnstileToken, ip, env);
            if (!isValid) {
                return jsonResponse({ error: 'Invalid captcha verification' }, 403, env, request);
            }
        }

        const site = resolveSiteConfig(request, env);

        // Slack ping (no-ops if SLACK_WEBHOOK_URL is unset).
        await sendFormNotification(data, site, env);

        // Forward submission to internal inbox via Cloudflare send_email binding.
        try {
            await forwardSubmission(data, site, env);
        } catch (e) {
            console.log(`Forward failed: ${e.message}`);
        }

        // Auto-reply to submitter via Resend.
        try {
            await sendAutoReply(email, name, subject, site, env);
        } catch (e) {
            console.log(`Auto-reply failed: ${e.message}`);
        }

        return jsonResponse({ success: true, message: 'Form submitted successfully' }, 200, env, request);
    } catch (e) {
        console.log(`Form submission error: ${e.message}`);
        return jsonResponse({ error: 'Internal server error' }, 500, env, request);
    }
}
