const TEST_CONTROL_EMAILS = new Set([
  'ct.lopsan@gmail.com',
]);

export const hasTestControls = (email) =>
  typeof email === 'string'
  && TEST_CONTROL_EMAILS.has(email.trim().toLowerCase());

export default hasTestControls;
