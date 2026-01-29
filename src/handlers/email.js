import PostalMime from 'postal-mime';
import { sendEmailNotification } from '../services/slack.js';

/**
 * Handle incoming support emails
 */
export async function handleEmail(message, env) {
    const recipient = message.to.toLowerCase();

    if (recipient !== env.SUPPORT_EMAIL) {
        message.setReject('Unknown address');
        return;
    }

    // Parse and notify
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

    // Forward to team members
    const forwardList = env.FORWARD_EMAIL_LIST.split(',').map((email) => email.trim());
    for (const email of forwardList) {
        await message.forward(email);
    }
}
