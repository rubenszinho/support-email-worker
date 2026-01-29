const MAILCHANNELS_API_URL = 'https://api.mailchannels.net/tx/v1/send';

/**
 * Send auto-reply email via MailChannels
 */
export async function sendAutoReply(to, name, subject, env) {
    const fromName = env.FROM_NAME || 'Support Team';
    const replySubject = `Re: ${subject || 'Your contact form submission'}`;

    const response = await fetch(MAILCHANNELS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            personalizations: [
                {
                    to: [{ email: to, name: name }],
                },
            ],
            from: {
                email: env.SUPPORT_EMAIL,
                name: fromName,
            },
            subject: replySubject,
            content: [
                {
                    type: 'text/plain',
                    value: getPlainTextContent(name, fromName),
                },
                {
                    type: 'text/html',
                    value: getHtmlContent(name, fromName),
                },
            ],
        }),
    });

    return response.ok;
}

function getPlainTextContent(name, fromName) {
    return `Hi ${name},

Thank you for contacting us! We have received your message and will get back to you as soon as possible.

Best regards,
${fromName}`;
}

function getHtmlContent(name, fromName) {
    return `
    <p>Hi ${name},</p>
    <p>Thank you for contacting us! We have received your message and will get back to you as soon as possible.</p>
    <p>Best regards,<br>${fromName}</p>
  `;
}
