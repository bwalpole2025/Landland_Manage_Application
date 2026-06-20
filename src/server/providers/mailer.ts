// Mailer — abstraction for transactional email (verification, password reset).
// ConsoleMailer logs messages for local dev so the auth flows are testable
// without an SMTP/SES account.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  readonly name = "console";

  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(
      `\n📧 [ConsoleMailer] to=${message.to}\n   subject: ${message.subject}\n   ${message.text}\n`,
    );
  }
}
