# Tiny Farm art license

The pixel art is © Maeve Devs (Tiny Farm RPG). The sheets stay on this machine, in a gitignored `Tiny Asset Pack*` folder. They are not committed, not pushed, and not redistributed.

`npm run art:cut` reads those sheets and writes the crops the app actually draws into `.cache/tiny-farm/`. That cache is gitignored. The runtime loads it at dev and build time. A clone without the pack cannot reproduce the crops, and that is intentional.

Comparison renders under `docs/design/tiny-farm/` are the same pixels. The PNGs stay local. The markdown notes in this folder are the only design files that belong in git.

Credit line for the app: "Pixel art: Tiny Farm RPG by Maeve Devs".
