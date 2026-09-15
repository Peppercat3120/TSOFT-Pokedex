# TSOFT Pokédex

React Native CLI application written in strict TypeScript. The initial screen displays 20 Pokémon and appends up to 20 more as the user scrolls. Selecting a row opens a scrollable profile with artwork, types, abilities, base statistics, height, weight, and base experience.

## Install and run

Set up the [React Native development environment](https://reactnative.dev/docs/set-up-your-environment), including Android SDK/JDK for Android or Xcode and CocoaPods for iOS. Use Node.js 22.11 or newer.

```sh
npm ci
```

For iOS, install Ruby dependencies from the repository root, then install pods from `ios`:

```sh
bundle install
cd ios
bundle exec pod install
cd ..
```

Start Metro in one terminal:

```sh
npm start
```

Run on an emulator, simulator, or connected device in another terminal:

```sh
npm run android
# Or on macOS:
npm run ios
```

### iOS scene lifecycle

Xcode 27's SDK requires the UIKit scene lifecycle; apps using the legacy lifecycle fail to launch. `ios/TSOFTPokedex/AppDelegate.swift` includes a `SceneDelegate` that creates the window and starts React Native, registered through `UIApplicationSceneManifest` in `ios/TSOFTPokedex/Info.plist`. See [Apple's migration guide](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle).

`pod install` preserves this fix. If the `ios/` folder is recreated from a template, preserve or reapply both changes unless the template already provides scene lifecycle support.

According to the React Native Changelog, React Native is addressing the error. Its 0.88 release candidate changelog includes “Add SceneDelegate lifecycle support". Therefore manual fix will not be necessary when React Native gets an update featuring this change.

## Verification

```sh
npx tsc --noEmit
npm run lint
npm test -- --runInBand --no-watchman
```

`--no-watchman` avoids requiring the local Watchman service. Tests use injected use cases, mocked native storage, and fixture responses; they do not call the live API.

## Architecture and endpoint mapping

- `src/domain`: immutable entities, repository contracts, validation, and use cases. `GetPokemonPage` validates the page request without knowing fetch or storage.
- `src/data`: fetch-based PokéAPI access, runtime DTO validation, mapping, and an AsyncStorage-backed cached repository.
- `src/presentation`: typed navigation, dependency context, `usePokemonList`, and accessible list rows. Screens never access network or storage directly.
- `App.tsx`: composition boundary; constructs one shared repository and the list/detail use cases once. Typed providers allow presentation hooks and tests to receive each use-case contract. Tests inject both dependencies to avoid live API or storage access.

Initial request: `GET https://pokeapi.co/api/v2/pokemon?offset=0&limit=20`. The [list endpoint](https://pokeapi.co/docs/v2/#resource-lists-pagination-section) returns `count`, `next`, `previous`, and `results` containing `name` and `url`. The mapper preserves response order and extracts the numeric ID from each resource URL. Names are capitalized only when rendered. Total count is preserved, not hard-coded.

Images are not included in the list response. The mapper derives `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png` from the official [PokéAPI sprite repository](https://github.com/PokeAPI/sprites). This avoids 20 detail requests per page, but depends on that repository's URL convention. Image requests are separate from the single JSON page request, and failures show a non-blocking fallback.

## Pagination and failure behavior

- The mapped `next` offset drives each subsequent request, always with `limit=20`.
- `FlatList` requests another page near the end (`onEndReachedThreshold=0.5`), only after a user drag. One drag authorizes one request, preventing mount-time loading and automatic request chains after appending.
- A synchronous request lock prevents duplicate requests. Pages append in order and duplicate IDs keep their first occurrence. Existing rows remain visible and usable during loading or errors.
- A failed page retains its cursor. Scrolling does not repeatedly retry a failing request; bounded recovery and the footer retry can recover it.
- Null next links, empty/duplicate-only pages, and non-advancing offsets stop pagination safely. A final page may contain fewer than 20 records.
- `FlatList` virtualizes rendering; accumulated records remain in memory while the screen is mounted. Returning from detail retains the mounted list and scroll position.

## Persistence and partial offline support

AsyncStorage stores validated DTOs in versioned keys isolated by `offset:limit`, with a 24-hour cache-first TTL. Fresh cache avoids a JSON request. Expired cache is refreshed and can fall back to stale data for connectivity failures or HTTP 5xx errors. Invalid cache is ignored; cache writes are best-effort and never hide valid remote data.

Each visited page is independently available from cache. Startup loads only the first page, not all saved pages. If a later uncached page cannot load offline, earlier rows remain visible with a footer retry action. Any stale fallback displays a saved-data warning; fresh cache does not imply offline status.

Only JSON is explicitly persisted. Images may benefit from platform caching, but persistent offline images are not guaranteed. Existing cached DTOs need no migration because image URLs are generated during mapping.

## Detail screen

The selected navigation ID drives `GET https://pokeapi.co/api/v2/pokemon/{pokemonId}` through `usePokemonDetail`, `GetPokemonById`, and the shared cached repository. The existing DTO guard and mapper preserve the endpoint data; no schema or cache migration is needed.

- Artwork uses `sprites.other['official-artwork'].front_default`, then `sprites.front_default` if missing or loading fails. Neither image being available shows a non-blocking fallback. Image URLs come from the response, not an additional endpoint request.
- Types and abilities are displayed in slot order, with hidden abilities annotated. Names are humanized only for presentation.
- Height is converted from decimetres to metres and weight from hectograms to kilograms, both with one decimal. Nullable base experience shows “Not available”; zero remains visible.
- Statistics show exact numeric values in HP/Attack/Defense/Special Attack/Special Defense/Speed order, additional statistics afterward, and a total. Empty types, abilities, or statistics receive section-specific feedback.
- Loading and retryable connectivity/service/payload errors have explicit feedback. HTTP 404 displays “This Pokémon couldn’t be found” with a back action; invalid IDs do not trigger futile retries. Old responses are ignored on ID changes or unmount.
- Detail DTOs are cached separately by ID with the same 24-hour TTL and stale fallback policy. Cached list rows do not imply a cached detail: opening an unvisited Pokémon offline can still fail. Images are not explicitly persisted.
- Back navigation returns to the mounted list without replacing its loaded pages or scroll position. The detail screen uses wrapping layouts, scalable text, semantic section headings, and decorative artwork for screen readers.

## Centralized error feedback

A pure presentation-layer error mapper provides consistent messages and retry decisions for the initial list, pagination, and detail. Connectivity failures, HTTP 408, HTTP 429, server failures, invalid responses, and unknown failures allow explicit retry. Other HTTP 4xx errors and invalid arguments do not offer repeated requests; detail provides a back action, while list feedback advises restarting the app. Rate-limit feedback asks the user to wait; HTTP 429 is never automatically retried and has no enforced countdown. Pagination failures preserve loaded rows and explain that they remain available. Technical error details are never displayed. Domain error classes and cache fallback rules remain separate from UI wording.

## Libraries and boundaries

React Native provides lists, images, loading indicators, and pressable controls; React hooks and Context API provide local state and dependency injection. AsyncStorage provides local persistence, and React Navigation native-stack provides typed screen navigation.

The navigation implementation also uses these support dependencies:

- `react-native-screens`: provides native screen primitives used by React Navigation's native-stack navigator.
- `react-native-safe-area-context`: provides safe-area insets to keep content clear of notches and system bars on Android and iOS.

As discussed with the Alejandro, React Navigation and AsyncStorage are permitted because they support the explicit navigation and persistence requirements. Both navigation support dependencies follow this criterion: they provide native navigation and safe-area handling, while application architecture, state management, and business logic are implemented in the project using React tools, use cases, and repositories. There is no HTTP wrapper, third-party state manager, or UI kit.

Pending work: validate full device-level Android/iOS offline behavior and accessibility, and optionally add search. These features do not implement moves, evolution/species descriptions, audio, shiny toggles, favorites, background page prefetching or persistent image downloads.

Manual acceptance checks on both platforms: initial 20 rows; scrolling to 40 and beyond without losing position; fast-scroll request guarding; navigation/back; initial offline error; cached pages offline; failed next-page retry; image failures; narrow screens, large text, and screen readers.

### Refresh and connectivity recovery

Normal reads retain the 24-hour cache-first policy. Pull-to-refresh, explicit retries, and recovery use network-first reads, bypassing even fresh JSON cache. Network failures and HTTP 5xx may fall back to validated saved JSON, marked stale even if its TTL has not expired. Cache keys and persisted DTOs are unchanged.

While the app is active and the screen is focused, connectivity failures, HTTP 408/5xx, stale fallback, and failed mounted images trigger up to five recovery rounds after delays of 2, 4, 8, 16, and 30 seconds. Resume/focus attempts pending recovery immediately and restarts the budget; manual retry also restarts it. Backgrounding, blurring, and unmounting cancel scheduled retries. HTTP 429, other HTTP 4xx, invalid arguments, and invalid payloads are not automatically retried. This is bounded retry, not connectivity monitoring: a reconnection after exhaustion requires resume/focus or manual retry.

Loaded pages refresh in place; only pages still needing automatic recovery are refreshed before the failed pagination cursor is retried. Pull-to-refresh refreshes all loaded pages. Rows and scroll position remain available, and stale warnings derive from each page's status. An exhausted recovery budget exposes “Retry updates”.

JSON and image recovery are independent. Footer retry also resets failed existing row images. Failed images restart with unchanged URLs and a new attempt identity; successful images are retained, obsolete callbacks are ignored, and unmounted failures stop contributing to recovery. Detail artwork restarts its artwork/sprite fallback chain only after exhaustion. Images remain subject to platform caching; persistent offline images are not guaranteed.
