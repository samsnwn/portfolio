import type { z } from 'astro/zod';
import type { briefing, crew } from '../../content.config';

export type Briefing = z.infer<typeof briefing>;
export type Crew = z.infer<typeof crew>;
export type Status = 'coming-soon' | 'in-development' | 'live' | 'playable';
