> **BandPilot** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# Desktop packaging / Distribution de bureau

Guides utilisateurs : [Français](USER_GUIDE_FR.md) · [English](USER_GUIDE_EN.md).

## Architecture

Electron starts the backend in its main process and serves the compiled Vite interface on an available loopback port. SQLite and connection settings use the OS user-data directory. First launch defaults to simulation. Discovery, read-only connection and explicit control activation are available without restarting. The renderer is sandboxed and isolated; Node integration is disabled.

## Reproducible local build

The Electron 45 desktop candidate targets macOS 13 and later on Intel and Apple Silicon. Use Node.js 22.13 or later to build. SQLite uses the Node-API binary for the target platform and processor.

```sh
npm run ci:deps
npm --prefix web ci
npm test
npm run desktop:package
```

Build on each target OS. Native dependencies must match Electron and the target CPU. Output is in `release/`. Windows NSIS installs per-user with shortcuts; macOS uses DMG; Linux uses AppImage and Debian packages. OS prompts and AppImage executable permissions may require extra steps. Packages are not signed/notarized.

## GitHub release pipeline

`.github/workflows/desktop.yml` builds PR candidates and uploads temporary Actions artifacts. `.github/workflows/release.yml` runs on pushes to main that include changes outside its documentation and site exclusions, or by manual dispatch on main. Desktop releases on the same branch run in sequence. Four runners cover Windows x64, Mac Intel, Mac Apple Silicon and Linux x64. Each executes tests and builds; startup checks cover installed Windows, mounted macOS DMG and extracted Linux AppImage. Linux CI alone disables Chromium sandbox for its startup check; normal app startup keeps sandbox settings.

Only after every matrix job passes, a separate job downloads all packages, checks required filenames, generates SHA-256 checksums, creates the tag at the tested commit and uploads assets to a draft release. It publishes the release after upload succeeds. Existing releases are never overwritten. A failed run leaves no public partial release; if asset upload fails, a draft may need inspection before retrying. The preparation job allocates the next available stable version.

Physical-console validation remains separate from packaging and software checks; see [model compatibility](multi-model.md). On compatible installations the app can check for a published update and offer its download.
