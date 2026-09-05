import { ChevronDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import additionalNoticesUrl from '@/lib/about/additional-notices.txt?url';
import { type Credit, DATA_CREDITS, LIBRARY_CREDITS } from '@/lib/about/credits';

function CreditGroup({ title, id, credits }: { title: string; id: string; credits: Credit[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="rounded-xl border border-night-700 bg-night-950/40">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(value => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left font-medium text-gray-200 text-sm hover:bg-white/5"
      >
        {title}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <ul id={id} className="space-y-4 border-night-700 border-t p-4">
          {credits.map(credit => (
            <li key={credit.name}>
              <a
                href={credit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-sky-300 text-sm hover:underline"
              >
                {credit.name}
                <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
              </a>
              <p className="mt-1 text-gray-400 text-xs leading-relaxed">{credit.contribution}</p>
              {credit.notice && (
                <p className="mt-1 text-gray-400 text-xs">
                  {credit.noticeUrl ? (
                    <a
                      href={credit.noticeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-300/80 underline underline-offset-2"
                    >
                      {credit.notice}
                    </a>
                  ) : (
                    credit.notice
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AboutCredits() {
  return (
    <div className="space-y-3 text-left">
      <div>
        <h3 className="font-semibold text-white">Thanks to the people behind the sky</h3>
        <p className="mt-2 text-gray-400 text-sm leading-relaxed">
          NightSeek is made possible by open-source maintainers, researchers and public data
          providers. Thank you for sharing your work with everyone.
        </p>
      </div>
      <CreditGroup title="Libraries & tools" id="library-credits" credits={LIBRARY_CREDITS} />
      <CreditGroup title="Data sources" id="data-credits" credits={DATA_CREDITS} />
      <p className="text-gray-500 text-xs leading-relaxed">
        Credits do not imply endorsement. NightSeek’s observing scores and recommendations are
        derived estimates.
      </p>
      <a
        href={additionalNoticesUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block py-2 text-sky-300 text-xs underline underline-offset-2"
      >
        Astronomy &amp; sky-chart license notices
      </a>
      {import.meta.env.PROD && (
        <a
          href={`${import.meta.env.BASE_URL}THIRD_PARTY_LICENSES.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="block py-2 text-sky-300 text-xs underline underline-offset-2"
        >
          Bundled library license notices
        </a>
      )}
    </div>
  );
}
