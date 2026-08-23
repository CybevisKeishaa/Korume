/** Thrown when no email provider is configured (`EMAIL_PROVIDER=none`). */
export class EmailNotConfiguredError extends Error {
  constructor(message = "Email sending is disabled for this deployment (EMAIL_PROVIDER=none).") {
    super(message);
    this.name = "EmailNotConfiguredError";
  }
}
