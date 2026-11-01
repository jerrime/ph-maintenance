// Turns a stored email/phone into a click-to-contact href. Phone numbers are free-typed (contact
// form, calculator, chat, admin) with no fixed format, so we don't guess a country code — just
// strip everything but digits and a leading "+", which every dialer accepts.
export const mailHref = (email) => `mailto:${email}`
export const telHref = (phone) => `tel:${phone.replace(/[^0-9+]/g, '')}`
