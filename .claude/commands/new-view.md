---
description: Create a new page/view wired into Sidebar and App routing with role visibility
argument-hint: <view name — purpose — roles that see it>
---

Create a new view: $ARGUMENTS

1. Use the `ui-designer` subagent to propose the layout first (wireframe + states) and wait for approval.
2. Create the component in `src/components/` (or `src/features/<domain>/` if that structure exists).
3. Add the nav item to `src/components/Sidebar.tsx` with correct role `visible` rules.
4. Wire the `activeTab` case in `src/App.tsx`.
5. Ensure the backing API routes enforce the same roles server-side (sidebar visibility is not security).
6. `npm run lint`, then tell me which role to log in as to see it.
