# Stage Builder

Visualise stage templates in 3D. Vite + React + TypeScript + React Three Fiber. No backend.

```bash
npm install
npm run dev      # local dev server
npm run build    # static build into dist/
```

Deploy: import the repo into Vercel (framework preset "Vite"); it builds `dist/` as a static site.

## Structure

- `src/templates/<stage>/` — one module per stage type, implementing `StageTemplate` (see `src/types.ts`):
  Proscenium, End Stage, Thrust, In-the-Round, Traverse, Black Box, Open-Air. Each can declare size presets,
  shared dimensions (for switching templates), extra data (Black Box blocks) and an environment (Open-Air sky).
- `src/templates/registry.ts` — list of available templates; add new ones here
- `src/objects/<piece>/` — set pieces users place on a stage (flats, platforms, arches, truss, LED walls...), each implementing
  `SetObjectType` (see `src/objects/types.ts`) and listed in `src/objects/registry.ts`. Snapping, handles and undo are shared.
- `src/helpers/` — shared seating generator, dimension labels, floor grid, views, param utilities
- `src/components/` — top bar, stage picker, auto-generated properties panel, 3D viewport
- `src/store/` — zustand project store (save to localStorage, export/import JSON)

Units are stored in metres; Y is up; the audience floor is y = 0 and the front audience is towards +Z.
