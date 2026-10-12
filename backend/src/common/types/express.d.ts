import { AccessTokenClaims } from "./common.js";

declare global {
  namespace Express {
    interface Request {
      actor?: AccessTokenClaims;
    }
  }
}

export {};
