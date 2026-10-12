import { ConsoleSmsSender } from "./console-sms-sender.js";

export * from "./sms-sender.interface.js";
export * from "./console-sms-sender.js";

export const smsSender = new ConsoleSmsSender();
