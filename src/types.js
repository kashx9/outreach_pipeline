/**
 * The normalized contract that flows between stages. Keeping one shape per
 * "thing" is what lets a missing field in stage 2 not blow up stage 3.
 */

/**
 * @typedef {Object} Company
 * @property {string} domain
 * @property {string} [name]
 * @property {number} [similarityScore]
 * @property {string} [size]
 * @property {string} [country]
 */

/**
 * @typedef {Object} Prospect
 * @property {string} fullName
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [title]
 * @property {string} linkedinUrl
 * @property {string} companyDomain
 * @property {string} [companyName]
 */

/**
 * @typedef {Prospect & { email: string, emailVerified: boolean }} Contact
 */

/**
 * @typedef {Object} SendResult
 * @property {Contact} contact
 * @property {'sent'|'failed'|'skipped'} status
 * @property {string} [messageId]
 * @property {string} [error]
 */

export {};
