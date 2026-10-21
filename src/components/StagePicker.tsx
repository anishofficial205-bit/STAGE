import { templates } from '../templates/registry';
import { useProjectStore } from '../store/useProjectStore';

export function StagePicker() {
  const templateId = useProjectStore((s) => s.templateId);
  const setTemplate = useProjectStore((s) => s.setTemplate);
  return (
    <aside className="sidebar sidebar--left">
      <h2 className="panel-title">Stage type</h2>
      <ul className="picker">
        {templates.map((t) => (
          <li key={t.id}>
            <button className={`picker__item ${t.id === templateId ? 'is-active' : ''}`} onClick={() => setTemplate(t.id)}>
              <span className="picker__name">{t.name}</span>
              <span className="picker__desc">{t.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
