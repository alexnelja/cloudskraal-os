import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Export, Image, FilePdf } from '@phosphor-icons/react';
import type maplibregl from 'maplibre-gl';

interface ExportMapButtonProps {
  map: maplibregl.Map | null;
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function captureCanvas(map: maplibregl.Map): Promise<string> {
  return new Promise((resolve) => {
    map.once('render', () => {
      resolve(map.getCanvas().toDataURL('image/png'));
    });
    map.triggerRepaint();
  });
}

async function downloadPng(map: maplibregl.Map) {
  const dataUrl = await captureCanvas(map);
  const link = document.createElement('a');
  link.download = `cloudskraal-map-${timestamp()}.png`;
  link.href = dataUrl;
  link.click();
}

async function downloadPdf(map: maplibregl.Map) {
  const dataUrl = await captureCanvas(map);
  const title = `Cloudskraal Map — ${timestamp()}`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(
    `<html><head><title>${title}</title><style>` +
    `@page{size:landscape;margin:0}` +
    `body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff}` +
    `img{max-width:100%;max-height:100%;object-fit:contain}` +
    `</style></head><body>` +
    `<img src="${dataUrl}" onload="window.print();window.close();" />` +
    `</body></html>`,
  );
  win.document.close();
}

export default function ExportMapButton({ map }: ExportMapButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!map) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Export map"
        title="Export map"
        className="glass-button rounded-full p-2 flex items-center justify-center"
      >
        <Export size={16} weight="duotone" className="text-amber-700" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="export-popover"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="absolute bottom-full left-0 mb-2 glass-panel rounded-xl p-1.5 min-w-[160px] z-20"
          >
            <button
              type="button"
              onClick={() => { downloadPng(map); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-800 hover:bg-stone-100/60 rounded-lg transition-colors"
            >
              <Image size={16} weight="duotone" className="text-emerald-700" />
              Download PNG
            </button>
            <button
              type="button"
              onClick={() => { downloadPdf(map); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-800 hover:bg-stone-100/60 rounded-lg transition-colors"
            >
              <FilePdf size={16} weight="duotone" className="text-rose-700" />
              Print / PDF
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
