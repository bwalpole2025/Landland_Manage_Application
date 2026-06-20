// SMS sender — abstraction for transactional text messages (mobile-number
// verification codes). ConsoleSms logs the message for local dev so the mobile
// verification flow is testable without a Twilio/SNS account.

export interface SmsMessage {
  to: string;
  text: string;
}

export interface Sms {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}

export class ConsoleSms implements Sms {
  readonly name = "console";

  async send(message: SmsMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`\n📱 [ConsoleSms] to=${message.to}\n   ${message.text}\n`);
  }
}
