export interface IEmailSender {
  sendPasswordResetEmail(to: string, name: string, token: string): Promise<void>;
}
