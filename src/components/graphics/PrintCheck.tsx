import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { graphicUses, requiredPixels, usePrintSettings, checkPrint, checkScreen, type CheckResult } from '../../graphics/printCheck';
import { download, fileSlug, specCsv, specSheetPdf } from '../../graphics/specSheet';
import { updatePlacement } from '../../graphics/library';
import { SURFACE, useObjectUI, type FaceRef } from '../../objects/ui';
import { formatLength } from '../../units';
import { Modal } from '../Modal';

export function Badge({ result }: { result?: CheckResult }) {
  if (!result) return <span className="badge badge--low">Graphic missing</span>;
  return (
    <span className={`badge badge--${result.status}`} title={result.detail}>
      {result.label}
    </span>
  );
}

/** Live check for one face's graphic (shown in its graphic section). */
export function FaceBadge({ target }: { target: FaceRef }) {
  // Re-evaluate when the project or thresholds change.
  useProjectStore((s) => s.objectsByTemplate);
  useProjectStore((s) => s.surfaceStylesByTemplate);
  useProjectStore((s) => s.paramsByTemplate);
  usePrintSettings((s) => s.thresholds);
  const use = graphicUses().find((u) => u.target.objectId === target.objectId && u.target.face === target.face);
  if (!use) return null;
  return <Badge result={use.result} />;
}

/** "Print check" overview: every graphic on this stage with its status, plus spec sheet export. */
export function PrintCheckDialog({ onClose }: { onClose: () => void }) {
  const units = useProjectStore((s) => s.units);
  useProjectStore((s) => s.objectsByTemplate);
  useProjectStore((s) => s.surfaceStylesByTemplate);
  const { thresholds, setThresholds } = usePrintSettings();
  const [busy, setBusy] = useState(false);
  const uses = graphicUses();
  const counts = { good: 0, ok: 0, low: 0 };
  for (const u of uses) counts[u.result?.status ?? 'low']++;

  const goTo = (u: (typeof uses)[number]) => {
    if (u.target.objectId !== SURFACE) useProjectStore.getState().select([u.target.objectId]);
    else useProjectStore.getState().select([]);
    useObjectUI.getState().setSelectedFace(u.target);
    onClose();
  };

  return (
    <Modal title="Print check" onClose={onClose} wide>
      <p className="modal__text">
        {uses.length ? `${uses.length} graphic${uses.length === 1 ? '' : 's'} on this stage: ${counts.good} ready, ${counts.ok} low for close viewing, ${counts.low} too low.` : 'No graphics on this stage yet.'}
      </p>
      <div className="thresholds">
        <label>
          Print ready from
          <input type="number" min={1} value={thresholds.good} onChange={(e) => setThresholds({ ...thresholds, good: Math.max(1, Number(e.target.value)) })} /> DPI
        </label>
        <label>
          Too low under
          <input type="number" min={1} value={thresholds.ok} onChange={(e) => setThresholds({ ...thresholds, ok: Math.max(1, Number(e.target.value)) })} /> DPI
        </label>
        <span className="hint">Large prints are viewed from a distance, so 100 DPI is usually plenty.</span>
      </div>
      {uses.length > 0 && (
        <div className="print-table-wrap">
          <table className="print-table">
            <thead>
              <tr>
                <th>Object / face</th>
                <th>Face size</th>
                <th>Needs @100 DPI</th>
                <th>Status</th>
                <th>Material / substrate</th>
              </tr>
            </thead>
            <tbody>
              {uses.map((u) => {
                const need = requiredPixels(u.size, 100);
                return (
                  <tr key={`${u.target.objectId}:${u.target.face}`}>
                    <td>
                      <button className="btn btn--link" onClick={() => goTo(u)}>
                        {u.owner}
                      </button>
                      <div className="hint">
                        {u.faceName} · {u.meta?.name ?? 'missing'}
                      </div>
                    </td>
                    <td>
                      {formatLength(u.size.w, units)} × {formatLength(u.size.h, units)}
                    </td>
                    <td>{u.screen ? `${u.screen[0]} × ${u.screen[1]} px (screen)` : `${need[0]} × ${need[1]} px`}</td>
                    <td>
                      <Badge result={u.result} />
                    </td>
                    <td>
                      <input
                        className="substrate"
                        placeholder="e.g. flex, fabric, vinyl"
                        value={u.graphic.substrate ?? ''}
                        onChange={(e) => updatePlacement(u.target, { substrate: e.target.value }, `substrate:${u.target.objectId}:${u.target.face}`)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="modal__actions">
        <button className="btn" disabled={!uses.length} onClick={() => download(new Blob([specCsv()], { type: 'text/csv' }), `${fileSlug()}-graphics-spec.csv`)}>
          Export CSV
        </button>
        <button
          className="btn btn--primary"
          disabled={!uses.length || busy}
          onClick={async () => {
            setBusy(true);
            try {
              download(await specSheetPdf(), `${fileSlug()}-graphics-spec.pdf`);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Preparing…' : 'Export spec sheet (PDF)'}
        </button>
      </div>
    </Modal>
  );
}

export { checkPrint, checkScreen };
