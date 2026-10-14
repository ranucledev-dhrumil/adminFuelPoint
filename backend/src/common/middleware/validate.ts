import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validateRequest(schema: RequestValidationSchema) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = (await schema.query.parseAsync(req.query)) as typeof req.query;
      }
      if (schema.params) {
        req.params = (await schema.params.parseAsync(req.params)) as typeof req.params;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validate(schema: ZodTypeAny) {
  return validateRequest({ body: schema });
}
