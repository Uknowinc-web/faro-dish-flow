<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Product catalog and prices live in `src/lib/catalogo.ts`; each order line stores its own unit-price snapshot, so catalog edits never change past accounts.
- Order submission, billing, voiding and "por cobrar" go through database functions (enviar_comanda, cobrar_cuenta, anular_cuenta, solicitar_cuenta) so table/account state stays consistent across devices.
- Duplicate sends are blocked by a unique client token per order draft, checked inside enviar_comanda.
- All three stations get live updates through one realtime hook (`src/hooks/use-realtime.ts`) that refreshes cached queries.
- Business date uses the America/Monterrey timezone, stamped when an account is paid or voided.
