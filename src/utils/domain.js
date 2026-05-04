/**
 * Multi-tenant domain resolution.
 *
 * The worker can serve more than one site (rubrion.ai, rubenszinho.dev,
 * samuelrubens.com, ...). Each site needs its own outgoing "from" address
 * so the auto-reply matches the domain the user submitted from.
 *
 * Config shape (env.DOMAIN_CONFIG, JSON-encoded string):
 *   {
 *     "rubrion.ai":        { "supportEmail": "hello@rubrion.ai",        "fromName": "Rubrion" },
 *     "rubenszinho.dev":   { "supportEmail": "contact@rubenszinho.dev", "fromName": "Samuel Rubens" },
 *     "samuelrubens.com":  { "supportEmail": "contato@samuelrubens.com", "fromName": "Samuel Rubens" }
 *   }
 *
 * Keys are bare hostnames. The resolver also matches `www.<host>` against
 * the bare entry. Unknown / missing origins fall back to env.SUPPORT_EMAIL
 * + env.FROM_NAME so local dev keeps working.
 */

let cachedConfig = null;
let cachedRaw = null;

function parseConfig(env) {
    const raw = env.DOMAIN_CONFIG || '';
    if (raw === cachedRaw) return cachedConfig;
    cachedRaw = raw;
    if (!raw) {
        cachedConfig = {};
        return cachedConfig;
    }
    try {
        const parsed = JSON.parse(raw);
        cachedConfig = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        console.log(`Invalid DOMAIN_CONFIG JSON: ${e.message}`);
        cachedConfig = {};
    }
    return cachedConfig;
}

function hostnameFromOrigin(origin) {
    if (!origin) return null;
    try {
        return new URL(origin).hostname.toLowerCase();
    } catch {
        return null;
    }
}

/**
 * Resolve site config for a request based on its Origin header.
 * Returns { supportEmail, fromName, siteName } — siteName is the matched
 * hostname (or 'default' for the env fallback).
 */
export function resolveSiteConfig(request, env) {
    const origin = request?.headers?.get('Origin');
    const host = hostnameFromOrigin(origin);
    const config = parseConfig(env);

    if (host) {
        const direct = config[host];
        if (direct) return { ...direct, siteName: host };
        const stripped = host.startsWith('www.') ? host.slice(4) : null;
        if (stripped && config[stripped]) {
            return { ...config[stripped], siteName: stripped };
        }
    }

    return {
        supportEmail: env.SUPPORT_EMAIL,
        fromName: env.FROM_NAME || 'Support Team',
        siteName: host || 'default',
    };
}

/**
 * All hostnames known to the worker — used for CORS allow-listing and for
 * the inbound email handler so multiple support inboxes can be intercepted.
 */
export function listKnownSupportEmails(env) {
    const config = parseConfig(env);
    const emails = new Set();
    if (env.SUPPORT_EMAIL) emails.add(env.SUPPORT_EMAIL.toLowerCase());
    for (const key of Object.keys(config)) {
        const entry = config[key];
        if (entry && entry.supportEmail) emails.add(entry.supportEmail.toLowerCase());
    }
    return [...emails];
}

export function listKnownHostnames(env) {
    const config = parseConfig(env);
    return Object.keys(config);
}
