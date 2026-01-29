import PostalMime from 'postal-mime';

// CORS headers for cross-origin requests
function corsHeaders(env) {
  const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : ['*'];
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes('*') ? '*' : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// JSON response helper
function jsonResponse(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env),
    },
  });
}

// Verify Cloudflare Turnstile token
async function verifyTurnstile(token, ip, env) {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    }),
  });
  const result = await response.json();
  return result.success;
}

// Send auto-reply email via MailChannels
async function sendAutoReply(to, name, subject, env) {
  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
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
        name: env.FROM_NAME || 'Support Team',
      },
      subject: `Re: ${subject || 'Your contact form submission'}`,
      content: [
        {
          type: 'text/plain',
          value: `Hi ${name},\n\nThank you for contacting us! We have received your message and will get back to you as soon as possible.\n\nBest regards,\n${env.FROM_NAME || 'Support Team'}`,
        },
        {
          type: 'text/html',
          value: `
            <p>Hi ${name},</p>
            <p>Thank you for contacting us! We have received your message and will get back to you as soon as possible.</p>
            <p>Best regards,<br>${env.FROM_NAME || 'Support Team'}</p>
          `,
        },
      ],
    }),
  });
  return response.ok;
}

// Send Slack notification for form submission
async function sendSlackNotification(data, env) {
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
          fields: [
            { type: 'mrkdwn', text: `*Subject:*\n${subject || '(No subject)'}` },
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
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Handle form submission
async function handleFormSubmission(request, env) {
  try {
    const data = await request.json();
    const { name, email, subject, message, turnstileToken, honeypot } = data;

    // Honeypot check - if filled, likely a bot
    if (honeypot) {
      return jsonResponse({ success: true }, 200, env); // Silently accept but don't process
    }

    // Validate required fields
    if (!name || !email || !message) {
      return jsonResponse({ error: 'Missing required fields: name, email, message' }, 400, env);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return jsonResponse({ error: 'Invalid email format' }, 400, env);
    }

    // Validate field lengths
    if (name.length > 100 || email.length > 254 || (subject && subject.length > 200) || message.length > 5000) {
      return jsonResponse({ error: 'Field exceeds maximum length' }, 400, env);
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
    const slackSent = await sendSlackNotification(data, env);
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

export default {
  // HTTP request handler for form submissions
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env),
      });
    }

    const url = new URL(request.url);

    // POST /submit - Handle form submission
    if (request.method === 'POST' && url.pathname === '/submit') {
      return handleFormSubmission(request, env);
    }

    // Health check endpoint
    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ status: 'ok' }, 200, env);
    }

    return jsonResponse({ error: 'Not found' }, 404, env);
  },

  // Email handler for support emails
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