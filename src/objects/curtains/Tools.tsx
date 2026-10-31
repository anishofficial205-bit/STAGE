import { useState } from 'react';
import { addObjectAt } from '../actions';
import { Modal } from '../../components/Modal';
import { addFalseProscenium, addMaskingSets } from './masking';
import { Plain } from '../../glossary/Plain';
import { TILE, Tile } from '../../components/ActionTile';

function MaskingDialog({ onClose }: { onClose: () => void }) {
  const [count, setCount] = useState(3);
  const ok = () => {
    addMaskingSets(Math.max(1, Math.min(8, Math.round(count))));
    onClose();
  };
  return (
    <Modal title="Add masking sets" onClose={onClose}>
      <p className="modal__text">Each set is a pair of legs and a border, spaced evenly from the proscenium to the back wall and sized to the stage. Each set appears as a group in Layers.</p>
      <label className="field">
        <span className="field__label">How many sets?</span>
        <input className="field__input" type="number" min={1} max={8} value={count} onChange={(e) => setCount(Number(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && ok()} autoFocus />
      </label>
      <div className="modal__actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn--primary" onClick={ok}>
          Add {count} set{count === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}

/** Quick actions shown under the "Curtains & drapes" library heading. */
export function CurtainTools() {
  const [masking, setMasking] = useState(false);
  return (
    <div className="action-tiles library__tools">
      <Tile icon={TILE.curtain} label={<Plain text="Main curtain" />} onClick={() => addObjectAt('main-curtain')} title="Hang a main curtain just behind the arch (or across the front of the stage)" />
      <Tile icon={TILE.frame} label={<Plain text="Masking sets" />} onClick={() => setMasking(true)} title="Pairs of legs plus a border at even depths" />
      <Tile icon={TILE.arch} label={<Plain text="Tormentors & teaser" />} onClick={addFalseProscenium} title="Front legs (tormentors) and border (teaser) that frame a false proscenium" />
      <Tile icon={TILE.skirt} label={<Plain text="Stage skirt" />} onClick={() => addObjectAt('stage-skirt')} title="Cover the front of a raised stage, sized automatically" />
      {masking && <MaskingDialog onClose={() => setMasking(false)} />}
    </div>
  );
}
