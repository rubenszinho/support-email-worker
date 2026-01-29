import { jsonResponse } from '../utils/cors.js';
import { validateFormData } from '../utils/validation.js';
import { verifyTurnstile } from '../services/turnstile.js';
import { sendFormNotification } from '../services/slack.js';
import { sendAutoReply } from '../services/mailchannels.js';

/**
 * Handle contact form submission
 */
export async function handleFormSubmission(request, env) {
    try {
        const data = await request.json();
        const { name, email, subject, message, turnstileToken, honeypot } = data;

        // Honeypot check - if filled, likely a bot
        if (honeypot) {
            return jsonResponse({ success: true }, 200, env); // Silently accept but don't process
        }

        // Validate form data
        const validation = validateFormData({ name, email, subject, message });
        if (!validation.valid) {
            return jsonResponse({ error: validation.error }, 400, env);
        }

        // Verify Turnstile token
        if (env.TURNSTILE_SECRET_KEY) {
            const ip = request.headers.get('CF-Connecting-IP') || '';
            const isValid = await verifyTurnstile(turnstileToken, ip, env);
            if (!isValid) {
                return jsonResponse({ error: 'Invalid captcha verification' }, 403, env);
            }
        }

        // Send Slack notification
        const slackSent = await sendFormNotification(data, env);
        if (!slackSent) {
            console.log('Failed to send Slack notification');
        }

        // Send auto-reply email
        try {
            await sendAutoReply(email, name, subject, env);
        } catch (e) {
            console.log(`Failed to send auto-reply: ${e.message}`);
        }

        return jsonResponse({ success: true, message: 'Form submitted successfully' }, 200, env);
    } catch (e) {
        console.log(`Form submission error: ${e.message}`);
        return jsonResponse({ error: 'Internal server error' }, 500, env);
    }
}
