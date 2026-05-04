/**
 * Send Slack notification for form submission. No-op when SLACK_WEBHOOK_URL
 * is not configured — Slack is optional, so callers should treat a `false`
 * return as "skipped/failed" rather than a hard error.
 */
export async function sendFormNotification(data, site, env) {
    if (!env.SLACK_WEBHOOK_URL) return false;

    const { name, email, subject, message } = data;
    const siteLabel = site?.siteName ? ` — ${site.siteName}` : '';

    try {
        const response = await fetch(env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: `New Contact Form Submission${siteLabel}`,
                            emoji: true,
                        },
                    },
                    {
                        type: 'section',
                        fields: [
                            { type: 'mrkdwn', text: `*Name:*\n${name}` },
                            { type: 'mrkdwn', text: `*Email:*\n${email}` },
                        ],
                    },
                    {
                        type: 'section',
                        fields: [
                            { type: 'mrkdwn', text: `*Subject:*\n${subject || '(No subject)'}` },
                            { type: 'mrkdwn', text: `*Site:*\n${site?.siteName || '(unknown)'}` },
                        ],
                    },
                    { type: 'divider' },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Message:*\n> ${message.replace(/\n/g, '\n> ')}`,
                        },
                    },
                ],
            }),
        });

        return response.ok;
    } catch (e) {
        console.log(`Slack form notification error: ${e.message}`);
        return false;
    }
}

/**
 * Send Slack notification for email. Same opt-in semantics as sendFormNotification.
 */
export async function sendEmailNotification(sender, subject, body, env) {
    if (!env.SLACK_WEBHOOK_URL) return false;

    try {
        const response = await fetch(env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: 'New Support Email',
                            emoji: true,
                        },
                    },
                    {
                        type: 'section',
                        fields: [
                            { type: 'mrkdwn', text: `*From:*\n${sender}` },
                            { type: 'mrkdwn', text: `*Subject:*\n${subject}` },
                        ],
                    },
                    { type: 'divider' },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `> ${body.replace(/\n/g, '\n> ')}`,
                        },
                    },
                ],
            }),
        });

        return response.ok;
    } catch (e) {
        console.log(`Slack email notification error: ${e.message}`);
        return false;
    }
}
