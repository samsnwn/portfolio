import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import MissionBriefing from '../../src/components/project/MissionBriefing.astro';
import StatusTag from '../../src/components/project/StatusTag.astro';
import CrewLine from '../../src/components/project/CrewLine.astro';
import ProjectLinks from '../../src/components/project/ProjectLinks.astro';
import CvButton from '../../src/components/project/CvButton.astro';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const briefing = {
  summary: 'A shell that runs pipes and redirects.',
  skills: ['Process control', 'Parsing'],
  tech: ['C', 'readline'],
};

describe('MissionBriefing', () => {
  it('shows the heading, summary, skills and tech', async () => {
    const html = await container.renderToString(MissionBriefing, { props: { briefing } });
    expect(html).toContain('Mission Briefing');
    expect(html).toContain(briefing.summary);
    for (const s of [...briefing.skills, ...briefing.tech]) expect(html).toContain(s);
  });
});

describe('StatusTag', () => {
  it('labels in-development and coming-soon', async () => {
    expect(await container.renderToString(StatusTag, { props: { status: 'in-development' } })).toContain('IN DEVELOPMENT');
    expect(await container.renderToString(StatusTag, { props: { status: 'coming-soon' } })).toContain('COMING SOON');
  });
  it('renders nothing for live and playable', async () => {
    expect((await container.renderToString(StatusTag, { props: { status: 'live' } })).trim()).toBe('');
    expect((await container.renderToString(StatusTag, { props: { status: 'playable' } })).trim()).toBe('');
  });
});

describe('CrewLine', () => {
  it('renders nothing without crew', async () => {
    expect((await container.renderToString(CrewLine, { props: {} })).trim()).toBe('');
  });
  it('links each login and shows my role and note', async () => {
    const crew = {
      members: [{ login: 'pschneid', url: 'https://profile.intra.42.fr/users/pschneid' }],
      myRole: 'Built the executor.',
      note: 'built at 42 · team of 5',
    };
    const html = await container.renderToString(CrewLine, { props: { crew } });
    expect(html).toContain('href="https://profile.intra.42.fr/users/pschneid"');
    expect(html).toContain('>pschneid<');
    expect(html).toContain('Built the executor.');
    expect(html).toContain('built at 42 · team of 5');
  });
});

describe('ProjectLinks', () => {
  it('renders no links when none are set or they are empty', async () => {
    for (const props of [{}, { repoUrl: '' }]) {
      const html = await container.renderToString(ProjectLinks, { props });
      expect(html).not.toContain('<a');
    }
  });
  it('never renders placeholder hrefs', async () => {
    const html = await container.renderToString(ProjectLinks, { props: { liveUrl: 'https://x.dev' } });
    expect(html).toContain('href="https://x.dev"');
    expect(html).not.toMatch(/href="(#)?"/);
  });
});

describe('CvButton', () => {
  it('links both CV PDFs', async () => {
    const html = await container.renderToString(CvButton);
    expect(html).toContain('/cv/SamuelCastilloCV_eng.pdf');
    expect(html).toContain('/cv/SamuelCastilloCV_de.pdf');
  });
});
