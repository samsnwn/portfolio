import { useEffect, useState } from 'react';
import { applyFx, readPrefs, writePrefs, type Prefs, DEFAULT_PREFS } from '../../lib/prefs';

const links = [
  { href: '/arcade', label: 'Arcade' },
  { href: '/42-archive', label: '42 Archive' },
  { href: '/side-quests', label: 'Side Quests' },
];

export default function Hud() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readPrefs());
  }, []);

  function update(next: Prefs) {
    setPrefs(next);
    writePrefs(next);
    applyFx(next.fx);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-cyan/30 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
        <a href="/" className="font-display glow-magenta text-sm" aria-label="Samuel Castillo Glantz, home">
          SCG<span aria-hidden="true">_</span>
        </a>
        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
            {links.map((l) => (
              <li key={l.href}>
                <a className="text-text/90 underline-offset-4 hover:text-cyan hover:underline" href={l.href}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-pressed={prefs.sound}
            onClick={() => update({ ...prefs, sound: !prefs.sound })}
            className="rounded border border-muted/40 px-2.5 py-1 text-sm text-muted hover:border-cyan hover:text-cyan aria-pressed:border-cyan aria-pressed:text-cyan"
          >
            {prefs.sound ? 'Sound on' : 'Sound off'}
          </button>
          <button
            type="button"
            aria-pressed={prefs.fx}
            onClick={() => update({ ...prefs, fx: !prefs.fx })}
            className="rounded border border-muted/40 px-2.5 py-1 text-sm text-muted hover:border-magenta hover:text-magenta aria-pressed:border-magenta aria-pressed:text-magenta"
          >
            Effects
          </button>
        </div>
      </div>
    </header>
  );
}
