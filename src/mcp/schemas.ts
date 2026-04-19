import { z } from "zod";

/* Trim + drop empty + dedupe. Applied to all tag + linear_issue arrays so
   tools see a canonical shape regardless of how an agent formats inputs. */
export const TagsSchema = z
  .array(z.string())
  .default([])
  .transform((arr) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))));

export const LinearIssuesSchema = TagsSchema;

export const StatusSchema = z.enum([
  "proposed",
  "committed",
  "amended",
  "superseded",
]);

/* ISO 8601 date string → Date. Rejects unparseable input. Used by
   query_decisions from/to filters. */
export const IsoDateSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "Expected ISO 8601 date string",
  })
  .transform((s) => new Date(s));

export const LimitSchema = z.number().int().min(1).max(100).default(20);

export const ProjectSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/i, {
    message: "Project slug must be alphanumeric with dashes",
  });

export const UuidSchema = z.string().uuid();

export const TitleSchema = z.string().min(1).max(120);
