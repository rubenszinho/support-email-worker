import { corsHeaders, jsonResponse } from './utils/cors.js';
import { handleFormSubmission } from './handlers/form.js';
import { handleEmail } from './handlers/email.js';

export default {
  /**
   * HTTP request handler for form submissions
   */
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

  /**
   * Email handler for support emails
   */
  async email(message, env, ctx) {
    return handleEmail(message, env);
  },
};