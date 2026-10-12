import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";
import { authService } from "./auth.service.js";

export class AuthController {
  private setRefreshCookie(res: Response, token: string): void {
    res.cookie("fuelpoint_refresh_token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: env.ADMIN_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie("fuelpoint_refresh_token", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
    });
  }

  loginAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await authService.loginAdmin({
        email,
        password,
        ip,
        userAgent,
      });

      this.setRefreshCookie(res, result.refreshToken);

      res.status(200).json({
        accessToken: result.accessToken,
        admin: result.admin,
      });
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken = req.cookies?.fuelpoint_refresh_token || req.body?.refreshToken;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await authService.refreshToken(rawToken, ip, userAgent);

      this.setRefreshCookie(res, result.refreshToken);

      res.status(200).json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (err) {
      this.clearRefreshCookie(res);
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken = req.cookies?.fuelpoint_refresh_token || req.body?.refreshToken;
      const allDevices = req.body?.allDevices === true;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await authService.logout({
        actor: req.actor,
        rawToken,
        allDevices,
        ip,
        userAgent,
      });

      this.clearRefreshCookie(res);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await authService.resetPassword({
        token,
        newPassword,
        ip,
        userAgent,
      });

      this.clearRefreshCookie(res);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const authController = new AuthController();
