# Repository Agent Instructions

<!-- GEOOMNI_DESIGN_SYSTEM_CONTRACT_V1 -->
## GeoOmni UI Design Contract

For any new or modified product UI:

1. Read `design-system/DESIGN.md` before implementation.
2. Reuse `design-system/primitives.css` and `design-system/patterns.css` before creating new component CSS.
3. New feature stylesheets must begin with `/* @geo-design-enforce */`.
4. Use only `--geo-*` design tokens for colors, typography, radius, spacing, elevation and control sizing.
5. Do not introduce raw hex/rgb/hsl colors in enforced feature CSS; add a semantic token first when a new visual value is genuinely required.
6. Do not introduce arbitrary `border-radius: Npx` or a new font stack.
7. New dialogs must use `.geo-ui-dialog`; new buttons `.geo-ui-button`; new form controls the `.geo-ui-*` form primitives.
8. Keep new UI inside `.geo-ui` or `#geo-smart-prototype` so light-mode isolation and typography are deterministic.
9. Do not edit `mirror-clean6/assets/*.js` or minified compiled CSS for feature implementation.
10. Dark dialogs are not the default. Use a dark surface only when the product specification explicitly calls for a dark-mode context.
11. Compare new UI with `/design-system/examples.html` before delivery.
12. Run `npm run design:audit` and `npm run design:test` before completing UI work.

If an existing legacy component must be normalized, add a narrow compatibility rule to `design-system/theme-bridge.css` rather than creating another design language.
<!-- /GEOOMNI_DESIGN_SYSTEM_CONTRACT_V1 -->
