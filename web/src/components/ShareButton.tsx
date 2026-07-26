'use client';

import { useState } from 'react';

/** Native share sheet where available, clipboard copy everywhere else. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        return; // user dismissed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — nothing useful to do */
    }
  }

  return (
    <button className="btn btn--outline" onClick={share}>
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
