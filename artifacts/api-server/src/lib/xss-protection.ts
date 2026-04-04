import { Request, Response, NextFunction } from "express";
import xss from "xss";

/**
 * Middleware to sanitize user-provided content to prevent XSS attacks
 * Stores sanitized version alongside original request data
 */
export function xssProtection(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    const sanitizedBody: any = {};

    for (const [key, value] of Object.entries(req.body)) {
      // Content fields that should be sanitized (removes scripts but keeps formatting)
      if (["content", "message", "post", "description", "reason", "changelog"].includes(key)) {
        if (typeof value === "string") {
          sanitizedBody[key] = xss(value, {
            whiteList: {}, // No HTML tags allowed
            stripIgnoreTag: true,
          });
        } else {
          sanitizedBody[key] = value;
        }
      } else {
        sanitizedBody[key] = value;
      }
    }

    req.body = sanitizedBody;
  }

  next();
}

/**
 * Sanitize a string to remove XSS attacks
 * Public utility function for use in route handlers
 */
export function sanitizeInput(input: string, strict = false): string {
  if (typeof input !== "string") return input;

  if (strict) {
    // Strict mode: remove all HTML tags
    return xss(input, {
      whiteList: {},
      stripIgnoreTag: true,
    });
  } else {
    // Permissive mode: allow basic formatting (you can adjust as needed)
    return xss(input, {
      whiteList: {
        b: [],
        i: [],
        u: [],
        br: [],
        p: ["style"],
        strong: [],
        em: [],
        code: [],
      },
      stripIgnoreTag: true,
    });
  }
}
