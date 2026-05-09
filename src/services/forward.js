import { EmailMessage } from 'cloudflare:email';

/**
 * Forward a contact-form submission to the internal inbox(es) listed in
 * env.FORWARD_EMAIL_LIST, using the Cloudflare `send_email` Workers binding
 * (`env.FORWARD_EMAIL`). The binding is free, but each destination address must
 * be a verified destination in Cloudflare → Email → Email Routing → Destination
 * addresses. Configure the binding in wrangler.jsonc under `send_email`.
 *
 * Auto-reply to the form submitter is NOT handled here — that lives in
 * services/resend.js. Keeping the two paths separate so each can fail
 * independently (and so we don't accidentally outbound-send via the binding,
 * which doesn't allow arbitrary destinations).
 */
export async function forwardSubmission(formData, site, env) {
    const recipients = (env.FORWARD_EMAIL_LIST || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    if (recipients.length === 0) {
        console.log('Forward skipped: FORWARD_EMAIL_LIST is empty.');
        return false;
    }
    if (!env.FORWARD_EMAIL || typeof env.FORWARD_EMAIL.send !== 'function') {
        console.log('Forward skipped: FORWARD_EMAIL binding not configured.');
        return false;
    }

    const fromEmail = site?.supportEmail || env.SUPPORT_EMAIL;
    if (!fromEmail) {
        console.log('Forward skipped: no from-address resolved.');
        return false;
    }
    const fromName = site?.fromName || env.FROM_NAME || 'Support';
    const siteName = site?.siteName || site?.host || 'Contact form';

    const subject = `[${siteName}] ${formData.subject || 'New contact form submission'}`;
    const body = [
        `New submission from ${siteName}`,
        '',
        `Name:    ${formData.name}`,
        `Email:   ${formData.email}`,
        `Subject: ${formData.subject || '(none)'}`,
        '',
        'Message:',
        formData.message,
    ].join('\r\n');

    let allOk = true;
    for (const to of recipients) {
        try {
            const raw = buildRfc822({
                fromEmail,
                fromName,
                to,
                replyTo: formData.email,
                subject,
                text: body,
            });
            const message = new EmailMessage(fromEmail, to, raw);
            await env.FORWARD_EMAIL.send(message);
        } catch (e) {
            console.log(`Forward to ${to} failed: ${e.message}`);
            allOk = false;
        }
    }
    return allOk;
}

/**
 * Build a minimal RFC 822 / 5322 message. Subject is encoded RFC 2047 to
 * preserve non-ASCII (e.g. PT-BR characters); body is base64'd as UTF-8 so
 * MTAs that strip 8-bit characters don't mangle accents.
 */
function buildRfc822({ fromEmail, fromName, to, replyTo, subject, text }) {
    const fromHeader = fromName
        ? `${encodeMimeWord(fromName)} <${fromEmail}>`
        : fromEmail;
    const messageId = `<${cryptoRandomId()}@${fromEmail.split('@')[1] || 'rubrion.ai'}>`;
    const date = new Date().toUTCString();

    const headers = [
        `From: ${fromHeader}`,
        `To: ${to}`,
        `Reply-To: ${replyTo}`,
        `Subject: ${encodeMimeWord(subject)}`,
        `Date: ${date}`,
        `Message-ID: ${messageId}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="utf-8"',
        'Content-Transfer-Encoding: base64',
    ].join('\r\n');

    const encoded = base64Utf8(text);
    const wrapped = encoded.match(/.{1,76}/g)?.join('\r\n') ?? encoded;

    return `${headers}\r\n\r\n${wrapped}\r\n`;
}

function encodeMimeWord(s) {
    if (!s) return '';
    if (/^[\x20-\x7e]*$/.test(s)) return sanitizeHeader(s);
    return `=?UTF-8?B?${base64Utf8(s)}?=`;
}

function sanitizeHeader(s) {
    return s.replace(/[\r\n]/g, ' ');
}

function base64Utf8(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function cryptoRandomId() {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
