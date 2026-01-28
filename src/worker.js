import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const recipient = message.to.toLowerCase();

    switch (recipient) {
      case env.SUPPORT_EMAIL:
        try {
          const parser = new PostalMime();
          const parsedEmail = await parser.parse(message.raw);

          const emailBody = parsedEmail.text || parsedEmail.html || "(No content found)";
          const subject = message.headers.get('subject') || "(No Subject)";
          const sender = message.from;

          const slackResponse = await fetch(env.SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: "New Support Email",
                    emoji: true
                  }
                },
                {
                  type: "section",
                  fields: [
                    {
                      type: "mrkdwn",
                      text: `*From:*\n${sender}`
                    },
                    {
                      type: "mrkdwn",
                      text: `*Subject:*\n${subject}`
                    }
                  ]
                },
                {
                  type: "divider"
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `> ${emailBody.replace(/\n/g, "\n> ")}`
                  }
                }
              ]
            }),
          });

          if (!slackResponse.ok) {
            console.log(`Slack API Error: ${await slackResponse.text()}`);
          }

        } catch (e) {
          console.log(`Error parsing or sending email: ${e.message}`);
        }

        const forwardList = env.FORWARD_EMAIL_LIST.split(',').map(email => email.trim());
        for (const email of forwardList) {
          await message.forward(email);
        }
        break;

      default:
        message.setReject("Unknown address");
    }
  }
}