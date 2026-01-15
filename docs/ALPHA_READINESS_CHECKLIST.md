# Alpha Readiness Checklist

Internal checklist for confirming the platform is ready for alpha testing.

## Core Pipeline Flow

- [ ] Ideas Module: Can submit idea and receive analysis
- [ ] Ideas Module: Analysis results display correctly with scores
- [ ] Ideas Module: Can accept idea and create artifact
- [ ] Requirements Module: Shows blocked state when no validated ideas
- [ ] Requirements Module: Can select validated idea and generate requirements
- [ ] Requirements Module: Requirements display with proper sections
- [ ] Requirements Module: Can lock requirements to create artifact
- [ ] Prompts Module: Shows blocked state when no locked requirements
- [ ] Prompts Module: Can select requirements and IDE
- [ ] Prompts Module: Prompts generate with STOP/WAIT instructions
- [ ] Prompts Module: Can copy individual prompts and export all

## Project Isolation

- [ ] Default project creates automatically on first visit
- [ ] Project switcher displays current project
- [ ] Cannot access artifacts from other projects
- [ ] X-Project-Id header enforced on all artifact operations
- [ ] Cross-project access returns clear error

## Permission System

- [ ] Owner role has full access (generate, edit, lock)
- [ ] Collaborator role can generate and edit
- [ ] Viewer role is read-only
- [ ] Permission errors show helpful messages
- [ ] Role displayed in project context indicator

## Sequencing Enforcement

- [ ] Cannot generate requirements without validated idea
- [ ] Cannot generate prompts without locked requirements
- [ ] Blocked states explain why and provide next action
- [ ] Pipeline stages display correctly at each step

## STOP Recommendations

- [ ] Stop recommendation appears when idea needs refinement
- [ ] Cannot proceed without acknowledging stop recommendation
- [ ] Acknowledgment flag required in API request
- [ ] Clear explanation of why stopping is recommended

## Error Handling

- [ ] API errors display user-friendly messages
- [ ] Form validation errors show inline
- [ ] Network errors handled gracefully
- [ ] No raw error codes or stack traces shown to users

## Export & Ownership

- [ ] Artifacts exportable as Markdown
- [ ] Export includes all metadata and content
- [ ] Downloaded files have readable names
- [ ] No vendor lock-in on user data

## UI Polish

- [ ] Copy uses plain language (no jargon)
- [ ] Empty states have clear CTAs
- [ ] Loading states show progress indicators
- [ ] Dark mode works correctly
- [ ] Responsive layout on mobile

## Known Limitations (Document for Users)

- AI providers currently return mock data (real API keys not configured)
- Single-user mode only (team features pending)
- In-memory storage (data resets on server restart unless database configured)

---

Last reviewed: [Date]
Reviewed by: [Name]
