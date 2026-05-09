const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Send a courtesy auto-reply to the form submitter via Resend
 * (https://resend.com). Uses a single verified sender domain — the free plan
 * allows only one verified domain, so all four portals (rubrion.ai,
 * rubrion.com.br, rubenszinho.dev, samuelrubens.com) outbound-reply from the
 * SAME `RESEND_FROM_EMAIL` address regardless of which site the form was
 * submitted on. The displayed `fromName` still varies per site.
 *
 * Configure:
 *   - `wrangler secret put RESEND_API_KEY`           (mandatory)
 *   - `RESEND_FROM_EMAIL`  in wrangler.jsonc vars    (verified sender)
 *
 * If either is missing the call no-ops with a log line and returns false; the
 * form submission still succeeds for the user.
 */
export async function sendAutoReply(toEmail, toName, subject, site, env) {
    if (!env.RESEND_API_KEY) {
        console.log('Auto-reply skipped: RESEND_API_KEY not set.');
        return false;
    }
    const fromEmail = env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
        console.log('Auto-reply skipped: RESEND_FROM_EMAIL not set.');
        return false;
    }
    const fromName = site?.fromName || env.FROM_NAME || 'Support';
    const replySubject = `Re: ${subject || 'Your contact form submission'}`;

    let response;
    try {
        response = await fetch(RESEND_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: [toEmail],
                subject: replySubject,
                text: getPlainTextContent(toName, fromName),
                html: getHtmlContent(toName, fromName),
            }),
        });
    } catch (e) {
        console.log(`Resend auto-reply network error: ${e.message}`);
        return false;
    }

    if (!response.ok) {
        const detail = await safeBody(response);
        console.log(`Resend auto-reply failed (${response.status}): ${detail}`);
        return false;
    }
    return true;
}

async function safeBody(response) {
    try {
        return await response.text();
    } catch {
        return '<unreadable>';
    }
}

function getPlainTextContent(name, fromName) {
    return `Hi ${name},

Thank you for contacting us. We have received your message and will get back to you as soon as possible.

Best regards,
${fromName}`;
}

function getHtmlContent(name, fromName) {
    return `
    <p>Hi ${name},</p>
    <p>Thank you for contacting us. We have received your message and will get back to you as soon as possible.</p>
    <p>Best regards,<br>${fromName}</p>
  `;
}
