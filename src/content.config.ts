import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const briefing = z.object({
  summary: z.string().min(1).max(280),
  skills: z.array(z.string()).min(1).max(6),
  tech: z.array(z.string()).min(1),
});

export const crew = z.object({
  members: z.array(z.object({ login: z.string(), url: z.url() })),
  myRole: z.string().min(1),
  note: z.string().optional(),
});

const rank = z.number().int().min(0).max(5);

const arcade = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/arcade' }),
  schema: z.object({
    title: z.string(),
    rank,
    order: z.number(),
    briefing,
    crew: crew.optional(),
    status: z.enum(['coming-soon', 'playable']),
  }),
});

const archive = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/archive' }),
  schema: z.object({
    title: z.string(),
    rank,
    order: z.number(),
    briefing,
    crew: crew.optional(),
    longform: z.boolean().default(false),
  }),
});

const sideQuests = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/side-quests' }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    briefing,
    crew: crew.optional(),
    status: z.enum(['live', 'in-development']),
    liveUrl: z.url().optional(),
    repoUrl: z.url().optional(),
    video: z.string().optional(),
    screenshots: z.array(z.object({ src: z.string(), alt: z.string().min(1) })).max(4).default([]),
  }),
});

export const collections = { arcade, archive, sideQuests };
