'use client';

import Link from 'next/link';
import '../../styles/cisa-command-hero.css';

export type CisaCommandHeroChip = { label: string; icon?: 'sync' | 'file' | 'shield' | 'play' };

export type CisaCommandHeroHowItem = { title: string; body: string };

export type CisaCommandHeroProps = {
  topbandTitle?: string;
  topbandSub: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: { href: string; label: string; external?: boolean };
  chips: CisaCommandHeroChip[];
  howItFits: CisaCommandHeroHowItem[];
  howItFitsHeading?: string;
  assetBase?: string;
  logoSrc?: string;
  logoAlt?: string;
};

function ChipIcon({ icon }: { icon?: CisaCommandHeroChip['icon'] }) {
  switch (icon) {
    case 'sync':
      return <span aria-hidden>↻</span>;
    case 'file':
      return <span aria-hidden>▤</span>;
    case 'shield':
      return <span aria-hidden>◆</span>;
    case 'play':
      return <span aria-hidden>▶</span>;
    default:
      return null;
  }
}

/** Page-1 CISA command hero; defaults assume `basePath: /cisa-site-assessment`. */
export function CisaCommandHero({
  topbandTitle = 'Cybersecurity and Infrastructure Security Agency',
  topbandSub,
  eyebrow,
  title,
  subtitle,
  cta,
  chips,
  howItFits,
  howItFitsHeading = 'How it fits',
  assetBase = '/cisa-site-assessment',
  logoSrc,
  logoAlt = 'CISA logo',
}: CisaCommandHeroProps) {
  const prefix = assetBase.replace(/\/$/, '');
  const resolvedLogoSrc = logoSrc ?? `${prefix}/logo/cisa-logo.png`;
  const ctaClass = 'btn btn-primary psa-cmd-cta';

  const ctaInner = (
    <>
      <span aria-hidden>▶</span> {cta.label}
    </>
  );

  return (
    <div className="landing-hero landing-hero--cisa landing-hero--psa-marketing" data-psa-command-hero>
      <div className="landing-hero-topband">
        <span className="landing-hero-topband-title">{topbandTitle}</span>
        <span className="landing-hero-topband-sub">{topbandSub}</span>
      </div>
      <div className="landing-hero-main">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{eyebrow}</p>
          <h2 className="landing-title">{title}</h2>
          <p className="landing-subtitle">{subtitle}</p>
          <div className="landing-actions">
            {cta.external ? (
              <a href={cta.href} className={ctaClass} target="_blank" rel="noopener noreferrer">
                {ctaInner}
              </a>
            ) : (
              <Link href={cta.href} className={ctaClass}>
                {ctaInner}
              </Link>
            )}
          </div>
          {chips.length > 0 && (
            <div className="landing-status-row">
              {chips.map((c) => (
                <span key={c.label} className="landing-status-pill">
                  <ChipIcon icon={c.icon} />
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="landing-hero-figure">
          <div className="landing-hero-figure-bg" aria-hidden />
          <div className="landing-hero-cisa-brand">
            <img src={resolvedLogoSrc} alt={logoAlt} width={320} height={320} className="landing-hero-cisa-logo" />
          </div>
        </div>
        <div className="landing-hero-panel card">
          <div className="card-header">
            <h4 className="card-title">{howItFitsHeading}</h4>
          </div>
          <div className="card-body landing-panel-list">
            {howItFits.map((item) => (
              <div key={item.title} className="landing-panel-item">
                <h5>{item.title}</h5>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
