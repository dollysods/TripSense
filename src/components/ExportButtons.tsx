import { useRef, useState } from 'react';
import type { ItineraryResult } from '../types';
import ShareCard from './ShareCard';

interface Props {
  result: ItineraryResult;
}

/**
 * PDF and image export. Both libraries are heavy relative to the rest
 * of the app, so they are dynamic-imported on click and never appear
 * in the initial bundle (the <3s load success criterion depends on this).
 */
export default function ExportButtons({ result }: Props) {
  const [busy, setBusy] = useState<'pdf' | 'image' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const download = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const exportPdf = async () => {
    setBusy('pdf');
    try {
      const [{ pdf }, { ItineraryPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ItineraryPdf'),
      ]);
      const blob = await pdf(<ItineraryPdf result={result} />).toBlob();
      const url = URL.createObjectURL(blob);
      download(url, 'tripsense-itinerary.pdf');
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed', err);
      alert('Sorry — the PDF export failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const exportImage = async () => {
    if (!cardRef.current) return;
    setBusy('image');
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, { width: 1200, height: 630, pixelRatio: 1 });
      download(dataUrl, 'tripsense-card.png');
    } catch (err) {
      console.error('Image export failed', err);
      alert('Sorry — the image export failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={exportPdf}
        disabled={busy !== null}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy === 'pdf' ? 'Building…' : 'Export PDF'}
      </button>
      <button
        type="button"
        onClick={exportImage}
        disabled={busy !== null}
        className="rounded-lg border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
      >
        {busy === 'image' ? 'Rendering…' : 'Share card'}
      </button>
      {/* Offscreen 1200x630 card rendered only for the image export. */}
      <div className="fixed -left-[2400px] top-0" aria-hidden>
        <ShareCard ref={cardRef} result={result} />
      </div>
    </div>
  );
}
