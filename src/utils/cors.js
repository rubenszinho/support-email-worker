import { listKnownHostnames } from './domain.js';

/**
 * Build the list of allowed origins. Combines:
 *   - env.ALLOWED_ORIGINS (comma-separated absolute URLs)
 *   - hostnames from env.DOMAIN_CONFIG (auto-promoted to https://host + https://www.host)
 * Falls back to '*' if neither is configured.
 */
function buildAllowedOrigins(env) {
    const explicit = env.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : [];

    const fromDomainConfig = listKnownHostnames(env).flatMap((host) => [
        `https://${host}`,
        `https://www.${host}`,
    ]);

    const merged = [...new Set([...explicit, ...fromDomainConfig])];
    if (merged.length === 0) return ['*'];
    return merged;
}

/**
 * CORS headers for cross-origin requests
 */
export function corsHeaders(env, request) {
    const allowedOrigins = buildAllowedOrigins(env);
    const origin = request?.headers.get('Origin');

    if (allowedOrigins.includes('*')) {
        return {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        };
    }

    const allowedOrigin =
        origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
}

/**
 * JSON response helper with CORS headers
 */
export function jsonResponse(data, status, env, request) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(env, request),
        },
    });
}
