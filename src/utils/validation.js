/**
 * Validate email format
 */
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate form submission data
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFormData({ name, email, subject, message }) {
    if (!name || !email || !message) {
        return { valid: false, error: 'Missing required fields: name, email, message' };
    }

    if (!isValidEmail(email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    if (name.length > 100) {
        return { valid: false, error: 'Name exceeds maximum length (100 characters)' };
    }

    if (email.length > 254) {
        return { valid: false, error: 'Email exceeds maximum length (254 characters)' };
    }

    if (subject && subject.length > 200) {
        return { valid: false, error: 'Subject exceeds maximum length (200 characters)' };
    }

    if (message.length > 5000) {
        return { valid: false, error: 'Message exceeds maximum length (5000 characters)' };
    }

    return { valid: true };
}
