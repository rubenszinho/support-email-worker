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
export async function sendAutoReply(toEmail, toName, subject, site, env, message = '') {
    if (!env.RESEND_API_KEY) {
        console.log('Auto-reply skipped: RESEND_API_KEY not set.');
        return false;
    }
    // A site can reply from a real mailbox (`replyFrom` in DOMAIN_CONFIG) so
    // Gmail can show that Google account's photo; it must be on the Resend
    // verified domain.
    const fromEmail = site?.replyFrom || env.RESEND_FROM_EMAIL;
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
                text: getPlainTextContent(toName, fromName, site, message),
                html: getHtmlContent(toName, fromName, site, message),
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
    console.log(`Auto-reply sent to submitter via Resend.`);
    return true;
}

async function safeBody(response) {
    try {
        return await response.text();
    } catch {
        return '<unreadable>';
    }
}

// Auto-reply copy per language. A site picks one with `lang` in DOMAIN_CONFIG.
const COPY = {
    en: {
        hi: (n) => `Hi ${n},`,
        body: 'Thanks for writing. Your message reached us and a person will reply within 24 hours, usually sooner.',
        yours: 'Your message',
        sign: 'Best regards,',
        auto: 'This is an automatic confirmation. Just reply to this email to add anything.',
    },
    pt: {
        hi: (n) => `Olá, ${n},`,
        body: 'Obrigado pelo contato. Sua mensagem chegou até nós e uma pessoa vai responder em até 24 horas, normalmente antes.',
        yours: 'Sua mensagem',
        sign: 'Abraços,',
        auto: 'Esta é uma confirmação automática. Para acrescentar algo, é só responder este e-mail.',
    },
};

function copyFor(site) {
    return COPY[site?.lang] || COPY.en;
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function getPlainTextContent(name, fromName, site, message) {
    const t = copyFor(site);
    return [
        t.hi(name),
        '',
        t.body,
        ...(message ? ['', `${t.yours}:`, message] : []),
        '',
        t.sign,
        fromName,
        ...(site?.url ? [site.url] : []),
        '',
        t.auto,
    ].join('\n');
}

/**
 * Branded, table-based HTML (what email clients reliably render): the site's
 * logo and name when `logo` is set in DOMAIN_CONFIG, the note, a quote of
 * what they sent, and the sign-off.
 */
function getHtmlContent(name, fromName, site, message) {
    const t = copyFor(site);
    const accent = site?.accent || '#c8303f';
    const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    const brand = escapeHtml(fromName);
    const header = site?.logo
        ? `<img src="${escapeHtml(site.logo)}" width="40" height="40" alt="" style="display:block;border:0;width:40px;height:40px;">`
        : '';
    const link = site?.url
        ? `<a href="${escapeHtml(site.url)}" style="color:${accent};text-decoration:none;">${escapeHtml(site.url.replace(/^https?:\/\//, ''))}</a>`
        : '';
    const quote = message
        ? `<tr><td style="padding:0 40px 8px;">
            <p style="margin:0 0 8px;font:700 11px/1.4 ${font};letter-spacing:.14em;text-transform:uppercase;color:#8a8984;">${t.yours}</p>
            <div style="border-left:2px solid ${accent};padding:4px 0 4px 16px;font:15px/1.6 ${font};color:#57564f;white-space:pre-wrap;">${escapeHtml(message)}</div>
          </td></tr>`
        : '';
    return `<!doctype html>
<html lang="${site?.lang === 'pt' ? 'pt-BR' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f3f2ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f2ee;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e1da;border-radius:12px;">
      <tr><td style="padding:32px 40px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          ${header ? `<td style="padding-right:12px;vertical-align:middle;">${header}</td>` : ''}
          <td style="vertical-align:middle;font:700 18px/1.2 ${font};letter-spacing:-.02em;color:#141413;">${brand}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:16px 40px 0;"><div style="height:1px;background:${accent};width:48px;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:24px 40px 24px;font:16px/1.65 ${font};color:#141413;">
        <p style="margin:0 0 16px;">${escapeHtml(t.hi(name))}</p>
        <p style="margin:0;">${t.body}</p>
      </td></tr>
      ${quote}
      <tr><td style="padding:24px 40px 32px;font:16px/1.65 ${font};color:#141413;">
        <p style="margin:0;">${t.sign}<br><strong>${brand}</strong>${link ? `<br>${link}` : ''}</p>
      </td></tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0;font:12px/1.5 ${font};color:#8a8984;">${t.auto}</p>
  </td></tr>
</table>
</body></html>`;
}

/**
 * Internal copy of a submission via Resend. Resend reports failures, while
 * the `send_email` binding can accept a message and still drop it when the
 * site's domain has Email Routing off (rubrion.ai mail is on Google
 * Workspace). Returns the Resend email id.
 */
export async function sendInternalCopy({ to, subject, text, replyTo, fromName, fromEmail }, env) {
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
        throw new Error('Resend not configured');
    }
    const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `${fromName} <${fromEmail || env.RESEND_FROM_EMAIL}>`,
            to: [to],
            reply_to: replyTo,
            subject,
            text,
        }),
    });
    if (!response.ok) {
        throw new Error(`Resend ${response.status}: ${await safeBody(response)}`);
    }
    const { id } = await response.json().catch(() => ({}));
    return id;
}
