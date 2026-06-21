// Push sender — abstraction for mobile/web push notifications. ConsolePush logs
// the message for local dev so the notification flow is testable without an
// FCM/APNs/Expo account. A real adapter sends to each registered device token.

export interface PushMessage {
  /** Device tokens to deliver to. */
  tokens: string[];
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped. */
  url?: string;
}

export interface Push {
  readonly name: string;
  send(message: PushMessage): Promise<void>;
}

export class ConsolePush implements Push {
  readonly name = "console";

  async send(message: PushMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(
      `\n🔔 [ConsolePush] tokens=${message.tokens.length}\n   ${message.title}\n   ${message.body}\n`,
    );
  }
}

// A real implementation, e.g.:
//
// export class ExpoPush implements Push {
//   readonly name = "expo";
//   async send(message: PushMessage): Promise<void> {
//     await fetch("https://exp.host/--/api/v2/push/send", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(message.tokens.map((to) => ({
//         to, title: message.title, body: message.body, data: { url: message.url },
//       }))),
//     });
//   }
// }
