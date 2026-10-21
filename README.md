# Stage Builder

Visualise stage templates in 3D. Vite + React + TypeScript + React Three Fiber. No backend.

```bash
npm install
npm run dev      # local dev server
npm run build    # static build into dist/
```

Deploy: import the repo into Vercel (framework preset "Vite"); it builds `dist/` as a static site.

## Structure

- `src/templates/<stage>/` — one module per stage type, implementing `StageTemplate` (see `src/types.ts`)
- `src/templates/registry.ts` — list of available templates; add new ones here
- `src/helpers/` — shared seating generator, dimension labels, floor grid, views, param utilities
- `src/components/` — top bar, stage picker, auto-generated properties panel, 3D viewport
- `src/store/` — zustand project store (save to localStorage, export/import JSON)

Units are stored in metres; Y is up; the audience floor is y = 0 and the front audience is towards +Z.
