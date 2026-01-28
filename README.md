# Support Email Worker

A Cloudflare Email Worker that automatically forwards support emails to a Slack channel and team members' email addresses.

## Overview

This worker intercepts emails sent to your configured support email address and:

1. Parses the email content (subject, sender, body)
2. Sends a formatted notification to a Slack channel via webhook
3. Forwards the original email to a list of team members

## Features

- Email parsing using [postal-mime](https://www.npmjs.com/package/postal-mime)
- Rich Slack notifications with formatted blocks
- Automatic email forwarding to team members
- Configurable via environment variables
- Deployed on Cloudflare Workers

## Requirements

- Cloudflare account with Email Routing enabled
- Slack webhook URL
- Node.js and npm installed locally for development

## Environment Variables

Configure these variables in your `wrangler.jsonc` file or through Cloudflare dashboard:

| Variable             | Description                                           | Example                                                        |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `SUPPORT_EMAIL`      | The support email address to intercept                | `support@example.com`                                          |
| `SLACK_WEBHOOK_URL`  | Slack incoming webhook URL                            | `https://hooks.slack.com/services/T01T8A8RX71/B0ABJ34EKF0/xxx` |
| `FORWARD_EMAIL_LIST` | Comma-separated list of email addresses to forward to | `user1@example.com,user2@example.com`                          |

### Setting Environment Variables

#### Local Development (wrangler.jsonc)

```jsonc
{
	"vars": {
		"SUPPORT_EMAIL": "support@example.com",
		"SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/YOUR_WEBHOOK_URL",
		"FORWARD_EMAIL_LIST": "user1@example.com,user2@example.com",
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

Edit `wrangler.jsonc` and update:

- `SUPPORT_EMAIL` with your support email address
- `SLACK_WEBHOOK_URL` with your Slack webhook URL
- `FORWARD_EMAIL_LIST` with your team's email addresses (comma-separated)

### 4. Configure Cloudflare Email Routing

1. Go to Cloudflare Dashboard → Email Routing
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
│   └── worker.js          # Main email worker logic
├── package.json           # Dependencies and scripts
├── wrangler.jsonc         # Cloudflare Worker configuration
└── README.md              # This file
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
