# Support Email Worker

Cloudflare Worker for handling support emails and contact form submissions with Slack notifications.

## Features

- **Email Routing**: Forward support emails to Slack and team members
- **Contact Form API**: HTTP endpoint for form submissions
- **Spam Protection**: Cloudflare Turnstile + honeypot field
- **Auto-Reply**: Automatic confirmation emails via MailChannels
- **Multi-tenant**: One worker can serve multiple domains (rubrion.ai, rubenszinho.dev, samuelrubens.com, ...) — each with its own from-address — via the `DOMAIN_CONFIG` env var.

## Quick Start

```bash
npm install
npm run dev      # Local development
npm run deploy   # Deploy to Cloudflare
```

## Environment Variables

| Variable               | Required                  | Description                                                                                                              |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SUPPORT_EMAIL`        | Fallback                  | Default support inbox; used when an Origin doesn't match `DOMAIN_CONFIG`                                                 |
| `FROM_NAME`            | Fallback                  | Default auto-reply display name                                                                                          |
| `SLACK_WEBHOOK_URL`    | No                        | Slack incoming webhook URL — leave empty to skip Slack notifications entirely                                            |
| `FORWARD_EMAIL_LIST`   | No                        | Comma-separated recipients for forwarded support emails (only used by inbound email handler)                             |
| `ALLOWED_ORIGINS`      | No                        | Extra CORS origins; `DOMAIN_CONFIG` hosts are auto-added (apex + www)                                                    |
| `TURNSTILE_SECRET_KEY` | No                        | Turnstile secret for spam protection                                                                                     |
| `DOMAIN_CONFIG`        | For multi-tenant          | JSON-encoded `{ "<host>": { "supportEmail": "...", "fromName": "..." } }`. Resolves per-domain from-address by `Origin`. |

### Configuration

**wrangler.jsonc:**

```jsonc
{
	"vars": {
		"SUPPORT_EMAIL": "support@example.com",
		"FROM_NAME": "Support Team",
		"SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/XXX/YYY/ZZZ",
		"FORWARD_EMAIL_LIST": "samuelrubenscontato@gmail.com",
		"ALLOWED_ORIGINS": "",
		"TURNSTILE_SECRET_KEY": "",
		"DOMAIN_CONFIG": "{\"rubrion.ai\":{\"supportEmail\":\"hello@rubrion.ai\",\"fromName\":\"Rubrion\"},\"rubenszinho.dev\":{\"supportEmail\":\"contact@rubenszinho.dev\",\"fromName\":\"Samuel Rubens\"},\"samuelrubens.com\":{\"supportEmail\":\"contato@samuelrubens.com\",\"fromName\":\"Samuel Rubens\"}}",
	},
}
```

### Multi-tenant routing

The worker reads the request's `Origin` header, extracts the hostname, and looks it up in `DOMAIN_CONFIG`:

- `https://rubrion.ai` → uses `hello@rubrion.ai` as the auto-reply from-address
- `https://www.rubenszinho.dev` → matched against `rubenszinho.dev`, uses `contact@rubenszinho.dev`
- `https://samuelrubens.com` → uses `contato@samuelrubens.com`
- Anything else (curl, localhost, unknown referrer) → falls back to `SUPPORT_EMAIL` / `FROM_NAME`

`FORWARD_EMAIL_LIST` is shared across all domains — typically your single personal Gmail. Slack notifications include the resolved site name so you can tell which portal the submission came from.

For each domain you configure, you must:
1. Set up Cloudflare Email Routing so `<supportEmail>` lands in this worker.
2. Add `_mailchannels.<domain> TXT "v=mc1 cfid=<your-worker>.workers.dev"` so MailChannels accepts the from-address.
3. Add the domain to the Turnstile site-key allow-list (one site key can cover all your domains).

**Or via CLI (secrets):**

```bash
wrangler secret put SLACK_WEBHOOK_URL
```

## Setup

### 1. Slack Webhook

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create app → Enable Incoming Webhooks → Add to channel
3. Copy webhook URL to `SLACK_WEBHOOK_URL`

### 2. Email Routing

1. Cloudflare Dashboard → Email Routing
2. Create rule: `support@yourdomain.com` → Send to Worker → `support-email-worker`

### 3. Turnstile (Optional)

1. [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) → Create site
2. Copy **Secret Key** to `TURNSTILE_SECRET_KEY`
3. Use **Site Key** in your frontend

### 4. MailChannels Auto-Reply (Optional)

Add DNS TXT record:

```
_mailchannels.yourdomain.com TXT "v=mc1 cfid=your-worker.workers.dev"
```

## API

### POST /submit

Submit contact form.

**Request:**

```json
{
	"name": "John Doe",
	"email": "john@example.com",
	"subject": "Hello",
	"message": "Your message here",
	"turnstileToken": "xxx",
	"honeypot": ""
}
```

| Field            | Required         | Max Length |
| ---------------- | ---------------- | ---------- |
| `name`           | Yes              | 100        |
| `email`          | Yes              | 254        |
| `subject`        | No               | 200        |
| `message`        | Yes              | 5000       |
| `turnstileToken` | If configured    | -          |
| `honeypot`       | No (leave empty) | -          |

**Response:**

```json
{ "success": true, "message": "Form submitted successfully" }
```

**Errors:**

- `400` - Missing/invalid fields
- `403` - Invalid captcha
- `500` - Server error

### GET /health

Health check. Returns `{ "status": "ok" }`.

## Frontend Example

```html
<form id="contact-form">
	<input name="name" required />
	<input name="email" type="email" required />
	<input name="subject" />
	<textarea name="message" required></textarea>
	<input name="honeypot" style="display:none" />
	<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>
	<button type="submit">Send</button>
</form>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
	document.getElementById('contact-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const fd = new FormData(e.target);

		const res = await fetch('https://your-worker.workers.dev/submit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: fd.get('name'),
				email: fd.get('email'),
				subject: fd.get('subject'),
				message: fd.get('message'),
				turnstileToken: fd.get('cf-turnstile-response'),
				honeypot: fd.get('honeypot'),
			}),
		});

		const data = await res.json();
		alert(data.success ? 'Sent!' : data.error);
	});
</script>
```

## Project Structure

```
src/
├── worker.js           # Entry point, routes requests
├── handlers/
│   ├── form.js         # Contact form handler
│   └── email.js        # Email routing handler
├── services/
│   ├── slack.js        # Slack notifications
│   ├── turnstile.js    # Captcha verification
│   └── mailchannels.js # Auto-reply emails
└── utils/
    ├── cors.js         # CORS utilities
    └── validation.js   # Input validation
```

## Troubleshooting

| Issue                  | Solution                                |
| ---------------------- | --------------------------------------- |
| Emails not forwarding  | Check Email Routing rules in Cloudflare |
| Slack not working      | Verify webhook URL, test with `curl`    |
| CORS errors            | Add domain to `ALLOWED_ORIGINS`         |
| Turnstile failing      | Check secret key matches site key       |
| Auto-reply not sending | Verify MailChannels DNS record          |
