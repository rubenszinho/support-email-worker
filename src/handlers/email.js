import PostalMime from 'postal-mime';
import { sendEmailNotification } from '../services/slack.js';
import { listKnownSupportEmails } from '../utils/domain.js';

/**
 * Handle incoming support emails.
 * Accepts any address listed in DOMAIN_CONFIG (or the env.SUPPORT_EMAIL fallback)
 * so a single worker can serve all configured portals.
 */
export async function handleEmail(message, env) {
    const recipient = message.to.toLowerCase();
    const accepted = listKnownSupportEmails(env);

    if (!accepted.includes(recipient)) {
        message.setReject('Unknown address');
        return;
    }

    try {
        const parser = new PostalMime();
        const parsedEmail = await parser.parse(message.raw);

        const emailBody = parsedEmail.text || parsedEmail.html || '(No content found)';
        const subject = message.headers.get('subject') || '(No Subject)';
        const sender = message.from;

        const slackSent = await sendEmailNotification(sender, subject, emailBody, env);
        if (!slackSent) {
            console.log('Slack API Error');
        }
    } catch (e) {
        console.log(`Error parsing or sending email: ${e.message}`);
    }

    // Forward to team members (single shared list — typically your personal inbox)
    if (env.FORWARD_EMAIL_LIST) {
        const forwardList = env.FORWARD_EMAIL_LIST.split(',').map((email) => email.trim()).filter(Boolean);
        for (const email of forwardList) {
            await message.forward(email);
        }
    }
}
