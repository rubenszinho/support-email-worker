/**
 * Send Slack notification for form submission
 */
export async function sendFormNotification(data, env) {
    const { name, email, subject, message } = data;

    const response = await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: 'New Contact Form Submission',
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
                    fields: [{ type: 'mrkdwn', text: `*Subject:*\n${subject || '(No subject)'}` }],
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
}

/**
 * Send Slack notification for email
 */
export async function sendEmailNotification(sender, subject, body, env) {
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
}
