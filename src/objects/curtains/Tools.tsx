import { addObjectAt } from '../actions';

/** Quick actions shown under the "Curtains & drapes" library heading. */
export function CurtainTools() {
  return (
    <div className="library__tools">
      <button className="btn btn--small" onClick={() => addObjectAt('main-curtain')} title="Hang a main curtain just behind the arch (or across the front of the stage)">
        + Add main curtain
      </button>
    </div>
  );
}
