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

## Architecture decisions
- Keep survey record types and pure GPS/CSV calculations in `src/lib/gps.ts`, with browser APIs in client-side screen and feature modules, so formatting and alert-distance rules stay testable without loading the map or browser.
- Load the Leaflet map dynamically after the screen mounts, so map-browser dependencies do not break server rendering.