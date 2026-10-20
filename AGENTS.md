
- AquaAssistant UI must remain in `AquaAssistantModule`; the legacy `AquaAssistant` widget is not a second implementation. This keeps one mounted assistant surface and one persisted conversation system.
- Preserve explicit tab IDs during URL resolution; permission-group IDs must not redirect sibling screens, so Stock remains a separate screen with existing feeding permissions.

- Treasury uses append-only unit-scoped movements with server-side account locking and balanced journal lines; account opening is atomic to prevent partial initialization.
- Business sale cancellation preserves the sale and its previous status; journal generation retains original entries and adds dated reversals, while linked POS cash refunds are atomic with cancellation.
- Accounting and treasury use the same application client as sales; deployment must target the application's actual backend, never silently switch existing users to another database.
- CRM contact shortcuts share ContactActions and open the user's messaging applications; they do not send messages automatically.
- POS uses the active unit's real stock and sale items through posCatalog; purchase cost is never used as a selling price.
- Cash sale history is linked through cash_movements.sale_id and session_id, including closed sessions, to avoid duplicating sales records.
- POS retains the sale and its original cash session when a cash posting fails; retry the posting rather than create a second sale.
- POS checks that the selected cash session is still open before recording a sale and reports unexpected failures; this client check does not replace server-side atomic posting.
- Stock removals use one unit-scoped selected-ID delete and a confirmation; reset snapshots the unit's displayed IDs rather than issuing an unbounded delete, preserving existing movement and financial history.
