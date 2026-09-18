---
description: Design or redesign a screen/component in the HSAC design system
argument-hint: <screen or component + what you want>
---

UI task: $ARGUMENTS

Delegate to the `ui-designer` subagent. Process:
1. It reads the existing component(s) and the data/API they use.
2. It proposes a layout (ASCII wireframe), component breakdown, states (loading/empty/error/populated), and interactions — then STOP and show me the proposal for approval.
3. After I approve, it implements, runs `npm run lint`, and tells me exactly what to check in the browser (which role to log in as, which tab).

If I say "just build it", skip the approval pause.
