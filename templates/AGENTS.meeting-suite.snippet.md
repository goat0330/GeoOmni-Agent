<!-- GEOOMNI_MEETING_SUITE_CONTRACT_V2 -->
## GeoOmni Meeting Suite v2 Contract

- `GeoOmni-Agent` is the only delivery base. `GeoOmni-Meeting-Minutes` is a feature reference, not a second runtime to keep in sync.
- Do not edit `mirror-clean6/assets/*.js` or minified compiled CSS for meeting features.
- Preserve the original expertsCard / invitation list. Extend it only with the inline meeting-topic row and the `智能纪要` / `历史会议` entries.
- The obsolete intermediate `防御响应方案（协同编辑中） / 会商结论与响应等级确认` meeting step must never appear in the invitation → join flow.
- Required flow: expertsCard → `确认邀请` → device join dialog → full-screen emergency meeting room.
- `会商主题` is required and `meetingContext` is the single source of truth for subject, participants, region, response level and timestamps.
- Smart Minutes is one reusable right-side component: pre-meeting shows context + empty states; in-meeting shows live/final minute content; history stores the final state.
- New Meeting Suite UI must reuse the existing GeoOmni Design System (`--geo-*`, `.geo-ui-*`). Do not introduce raw colors, arbitrary radius or a second font stack.
- Only `结束会议` persists `meetingContext + finalMinutes + distribution` into the meeting record; `离开会议` must not create a final history record. Historical records use the existing one-page list + detail pattern.
- Before delivery run `npm run meeting:test`, `npm run meeting:audit`, `npm run design:audit`, `npm run meeting:smoke`, and the existing `npm run smoke`.
<!-- /GEOOMNI_MEETING_SUITE_CONTRACT_V2 -->
