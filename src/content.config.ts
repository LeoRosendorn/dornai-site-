import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** Un servicio de la agencia: cada archivo de src/content/servicios genera /servicios/<archivo>/. */
const servicios = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/servicios" }),
  schema: z.object({
    order: z.number().int(),
    title: z.string(),
    short: z.string().max(160),
    seoTitle: z.string(),
    seoDescription: z.string().max(170),
    icon: z.enum(["chat", "voice", "brain", "flow", "compass", "pulse"]),
    problem: z.string(),
    includes: z.array(z.string()).min(3),
    steps: z.array(z.object({ title: z.string(), body: z.string() })).length(3),
    integrations: z.array(z.string()),
    deliverables: z.array(z.string()).min(3),
    timeline: z.string(),
    ideal: z.array(z.string()).min(2),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).min(2),
  }),
});

export const collections = { servicios };
