# Support Email Worker

A Cloudflare Worker that handles support emails and contact form submissions, forwarding them to Slack and team members.

## Overview

This worker provides two main features:

### 1. Email Routing

Intercepts emails sent to your configured support email address and:

- Parses the email content (subject, sender, body)
- Sends a formatted notification to a Slack channel via webhook
- Forwards the original email to a list of team members

### 2. Contact Form API

Provides an HTTP endpoint for contact form submissions that:

- Validates and processes form data
- Verifies Cloudflare Turnstile captcha (spam protection)
- Sends a formatted notification to Slack
- Sends an auto-reply confirmation email to the user

## Features

- Email parsing using [postal-mime](https://www.npmjs.com/package/postal-mime)
- Rich Slack notifications with formatted blocks
- (Optional) Cloudflare Turnstile site for spam protection
- (Optional) MailChannels DNS configuration for auto-reply emails

## Environment Variables

Configure these variables in your `wrangler.jsonc` file or through Cloudflare dashboard:

| Variable               | Description                                           | Required | Example                                                        |
| ---------------------- | ----------------------------------------------------- | -------- | -------------------------------------------------------------- |
| `SUPPORT_EMAIL`        | The support email address to intercept                | Yes      | `support@example.com`                                          |
| `SLACK_WEBHOOK_URL`    | Slack incoming webhook URL                            | Yes      | `https://hooks.slack.com/services/T01T8A8RX71/B0ABJ34EKF0/xxx` |
| `FORWARD_EMAIL_LIST`   | Comma-separated list of email addresses to forward to | Yes      | `user1@example.com,user2@example.com`                          |
| `ALLOWED_ORIGINS`      | Comma-separated list of allowed CORS origins          | No       | `https://example.com,https://www.example.com`                  |
| `FROM_NAME`            | Display name for auto-reply emails                    | No       | `Support Team`                                                 |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key for spam protection   | No       | `0x4AAAAAAxxxxxxxxxxxxxxxxxxxxxxx`                             |

### Setting Environment Variables

#### Local Development (wrangler.jsonc)

```jsonc
{
	"vars": {
		"SUPPORT_EMAIL": "support@example.com",
		"SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/YOUR_WEBHOOK_URL",
		"FORWARD_EMAIL_LIST": "user1@example.com,user2@example.com",
		"ALLOWED_ORIGINS": "https://example.com",
		"FROM_NAME": "Support Team",
		"TURNSTILE_SECRET_KEY": "",
	},
}
```

#### Production (Cloudflare Dashboard)

1. Go to Workers & Pages → Your Worker → Settings → Variables
2. Add environment variables:
   - `SUPPORT_EMAIL`: Your support email address
   - `SLACK_WEBHOOK_URL`: Your Slack webhook URL
   - `FORWARD_EMAIL_LIST`: Comma-separated email list

#### Production (CLI)

```bash
wrangler secret put SUPPORT_EMAIL
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put FORWARD_EMAIL_LIST
```

## Setup

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Slack Webhook

1. Go to your Slack workspace
2. Navigate to [Slack API Apps](https://api.slack.com/apps)
3. Create a new app or select existing one
4. Enable Incoming Webhooks
5. Add a new webhook to your desired channel
6. Copy the webhook URL

### 3. Configure Environment Variables

- `ALLOWED_ORIGINS` with your website domains (for CORS)

### 4. Configure Cloudflare Turnstile (Optional)

1. Go to [Cloudflare Dashboard -> Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a new site
3. Copy the **Site Key** (for your frontend) and **Secret Key**
4. Add `TURNSTILE_SECRET_KEY` to your environment variables

### 5. Configure MailChannels for Auto-Reply (Required for auto-reply)

Add the following DNS TXT record to your domain:

```
_mailchannels.yourdomain.com TXT "v=mc1 cfid=your-worker-subdomain.workers.dev"
```

Replace `your-worker-subdomain` with your actual Cloudflare Workers subdomain.

### 6

- `SUPPORT_EMAIL` with your support email address
- `SLACK_WEBHOOK_URL` with your Slack webhook URL
- `FORWARD_EMAIL_LIST` with your team's email addresses (comma-separated)

### 4. Configure Cloudflare Email Routing

1. API Reference

### Email Routing

1. **Email Reception**: Cloudflare Email Routing intercepts emails sent to your configured support email
2. **Email Parsing**: The worker parses the email using postal-mime to extract:
   - Sender address
   - Subject line
   - Email body (text or HTML)
3. **Slack Notification**: Sends a formatted message to Slack with:
   - Email header section
   - Sender and subject fields
   - Quoted email body
4. **Email Forwarding**: Forwards the original email to all addresses in `FORWARD_EMAIL_LIST`

### Contact Form

1. **Form Submission**: Receives POST request at `/submit` with form data
2. **Validation**: Validates required fields, email format, and field lengths
3. **Spam Protection**:
   - Checks honeypot field (rejects if filled)
   - Verifies Turnstile token (if configured)
4. **Slack Notification**: Sends formatted message to Slack channel
5. **Auto-Reply**: Sends confirmation email to the user via MailChannels
   "subject": "Question about your service",
   "message": "Hello, I have a question...",
   "turnstileToken": "XXXX.YYYY.ZZZZ",
   "honeypot": ""
   }

````

| Field           | Type   | Required | Description                                    |
| --------------- | ------ | -----worker logic (email + HTTP handlers)---------------------------------- |
| `name`          | string | Yes      | Sender's name (max 100 chars)                  |
| `email`         | string | Yes      | Sender's email (max 254 chars)                 |
| `subject`       | string | No       | Message subject (max 200 chars)                |
| `message`       | string | Yes      | Message content (max 5000 chars)               |
| `turnstileToken`| string | No*      | Turnstile verification token (*if configured)  |
| `honeypot`      | string | No       | Honeypot field - leave empty (spam protection) |

**Success Response:**

```json
{
  "success": true,
  "message": "Form submitted successfully"
}
````

**Error Responses:**

| Status | Response                                                     |
| ------ | ------------------------------------------------------------ |
| 400    | `{"error": "Missing required fields: name, email, message"}` |
| 400    | `{"error": "Invalid email format"}`                          |
| 400    | `{"error": "Field exceeds maximum length"}`                  |
| 403    | `{"error": "Invalid captcha verification"}`                  |
| 500    | `{"error": "Internal server error"}`                         |

### GET /health

Health check endpoint.

**Response:**

```json

### Auto-reply emails not sending

- Verify MailChannels DNS record is properly configured
- Check that `SUPPORT_EMAIL` domain matches the DNS record
- Check worker logs for MailChannels API errors

### Turnstile verification failing

- Verify `TURNSTILE_SECRET_KEY` is correct
- Ensure the site key in your frontend matches the secret key
- Check that the Turnstile widget is loading properly

### CORS errors

- Add your frontend domain to `ALLOWED_ORIGINS`
- Use `*` for development (not recommended for production)
{
  "status": "ok"
}
```

## Frontend Integration Example

### HTML Form with Turnstile

```html
<form id="contact-form">
	<input type="text" name="name" required placeholder="Your Name" />
	<input type="email" name="email" required placeholder="Your Email" />
	<input type="text" name="subject" placeholder="Subject" />
	<textarea name="message" required placeholder="Your Message"></textarea>

	<!-- Honeypot field (hidden) -->
	<input type="text" name="honeypot" style="display: none;" />

	<!-- Turnstile widget -->
	<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>

	<button type="submit">Send Message</button>
</form>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
	document.getElementById('contact-form').addEventListener('submit', async (e) => {
		e.preventDefault();

		const formData = new FormData(e.target);
		const turnstileToken = formData.get('cf-turnstile-response');

		const response = await fetch('https://your-worker.workers.dev/submit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: formData.get('name'),
				email: formData.get('email'),
				subject: formData.get('subject'),
				message: formData.get('message'),
				turnstileToken: turnstileToken,
				honeypot: formData.get('honeypot'),
			}),
		});

		const result = await response.json();
		if (result.success) {
			alert('Message sent successfully!');
		} else {
			alert('Error: ' + result.error);
		}
	});
</script>
```

## Go to Cloudflare Dashboard → Email Routing

2. Add your domain
3. Create an email routing rule:
   - **Match**: Your support email address (e.g., `support@yourdomain.com`)
   - **Action**: Send to Worker
   - **Worker**: `support-email-worker`

## Development

Run the worker locally:

```bash
npm run dev
```

## Deployment

Deploy to Cloudflare:

```bash
npm run deploy
```

## How It Works

1. **Email Reception**: Cloudflare Email Routing intercepts emails sent to your configured support email
2. **Email Parsing**: The worker parses the email using postal-mime to extract:
   - Sender address
   - Subject line
   - Email body (text or HTML)
3. **Slack Notification**: Sends a formatted message to Slack with:
   - Email header section
   - Sender and subject fields
   - Quoted email body
4. **Email Forwarding**: Forwards the original email to all addresses in `FORWARD_EMAIL_LIST`

## Slack Message Format

The Slack notification includes:

- Header: "New Support Email"
- **From**: Sender's email address
- **Subject**: Email subject line
- **Body**: Email content (quoted format)

## Project Structure

```
support-email-worker/
├── src/
│   ├── worker.js              # Main entry point, routes requests
│   ├── handlers/
│   │   ├── form.js            # Contact form submission handler
│   │   └── email.js           # Email routing handler
│   ├── services/
│   │   ├── slack.js           # Slack notifications
│   │   ├── turnstile.js       # Cloudflare Turnstile verification
│   │   └── mailchannels.js    # Auto-reply emails via MailChannels
│   └── utils/
│       ├── cors.js            # CORS headers and JSON response helper
│       └── validation.js      # Input validation utilities
├── package.json               # Dependencies and scripts
├── wrangler.jsonc             # Cloudflare Worker configuration
└── README.md                  # This file
```

## Error Handling

The worker includes error handling for:

- Email parsing failures
- Slack API errors
- Network issues

Errors are logged to Cloudflare Workers logs but don't prevent email forwarding.

## Troubleshooting

### Emails not being forwarded

- Check Cloudflare Email Routing rules
- Verify the worker is deployed and active
- Check worker logs in Cloudflare dashboard

### Slack notifications not working

- Verify `SLACK_WEBHOOK_URL` is correct
- Test the webhook URL manually with curl
- Check worker logs for Slack API errors

### Environment variables not working

- Ensure variables are set in wrangler.jsonc or Cloudflare dashboard
- Redeploy after changing environment variables
