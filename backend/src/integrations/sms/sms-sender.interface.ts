export interface ISmsSender {
  sendOtp(destination: string, code: string): Promise<void>;
}
