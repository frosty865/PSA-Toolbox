'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { isFieldStaticMode } from '@/lib/field/isFieldStaticMode';
import { hrefFieldFile, shouldUseFieldFileNavigation } from '@/lib/field/fileProtocolNav';

type NextLinkProps = ComponentProps<typeof NextLink>;

/** Drop-in replacement for next/link that uses relative hrefs on file:// field bundles. */
export default function FieldLink({ href, ...rest }: NextLinkProps) {
  const rel = useMemo(() => {
    if (!shouldUseFieldFileNavigation()) return null;
    const h =
      typeof href === 'string'
        ? href
        : href != null && typeof href === 'object' && 'pathname' in href
          ? `${(href as { pathname?: string }).pathname ?? ''}${(href as { search?: string }).search ?? ''}`
          : '';
    if (!h.startsWith('/')) return h;
    return hrefFieldFile(h);
  }, [href]);

  if (rel != null && shouldUseFieldFileNavigation()) {
    return <a href={rel} {...(rest as React.ComponentPropsWithoutRef<'a'>)} />;
  }
  return <NextLink href={href} {...rest} />;
}
