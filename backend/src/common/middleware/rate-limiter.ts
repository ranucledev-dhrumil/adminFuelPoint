import rateLimit from "express-rate-limit";

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // max 100 requests per minute per IP
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests from this IP. Please try again later.",
        details: null,
      },
    });
  },
});

export const workerScanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // max 30 scans per minute per authenticated worker
  keyGenerator: (req) => {
    return req.actor?.sub || req.ip || "unknown";
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Scan rate limit exceeded. Maximum 30 scans per minute allowed.",
        details: null,
      },
    });
  },
});
