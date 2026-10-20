import { jsonResponse } from '../utils/cors.js';
import { validateFormData } from '../utils/validation.js';
import { resolveSiteConfig } from '../utils/domain.js';
import { verifyTurnstile } from '../services/turnstile.js';
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
 * The visitor gets a 200 as soon as
 * validation + Turnstile pass; both sends then run in parallel
 * after the response (ctx.waitUntil), so a slow mail API never holds the form.
 */
export async function handleFormSubmission(request, env, ctx) {
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

        const deliver = Promise.allSettled([
            // Forward submission to internal inbox via Cloudflare send_email binding.
            forwardSubmission(data, site, env),
            // Auto-reply to submitter via Resend.
            sendAutoReply(email, name, subject, site, env, message),
        ]).then((results) => {
            const labels = ['Forward', 'Auto-reply'];
            results.forEach((r, i) => {
                if (r.status === 'rejected') console.log(`${labels[i]} failed: ${r.reason?.message ?? r.reason}`);
            });
        });
        if (ctx?.waitUntil) ctx.waitUntil(deliver);
        else await deliver;

        return jsonResponse({ success: true, message: 'Form submitted successfully' }, 200, env, request);
    } catch (e) {
        console.log(`Form submission error: ${e.message}`);
        return jsonResponse({ error: 'Internal server error' }, 500, env, request);
    }
}
