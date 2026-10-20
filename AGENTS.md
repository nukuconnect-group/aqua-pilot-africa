
- AquaAssistant UI must remain in `AquaAssistantModule`; the legacy `AquaAssistant` widget is not a second implementation. This keeps one mounted assistant surface and one persisted conversation system.
- Preserve explicit tab IDs during URL resolution; permission-group IDs must not redirect sibling screens, so Stock remains a separate screen with existing feeding permissions.
