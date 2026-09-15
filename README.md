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
- A failed page retains its cursor and requires explicit footer retry; scrolling does not repeatedly retry a failing request.
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
- Loading and retryable connectivity/service/payload errors have explicit feedback. HTTP 404 displays “Pokémon not found” with a back action; invalid IDs do not trigger futile retries. Old responses are ignored on ID changes or unmount.
- Detail DTOs are cached separately by ID with the same 24-hour TTL and stale fallback policy. Cached list rows do not imply a cached detail: opening an unvisited Pokémon offline can still fail. Images are not explicitly persisted.
- Back navigation returns to the mounted list without replacing its loaded pages or scroll position. The detail screen uses wrapping layouts, scalable text, semantic section headings, and decorative artwork for screen readers.

## Libraries and boundaries

The feature adds no dependencies. React Native provides lists, images, loading indicators, and pressable controls; React hooks/context provide local state and dependency injection. AsyncStorage provides local persistence, and React Navigation native-stack provides typed screen navigation with its existing safe-area/screens support dependencies. There is no HTTP wrapper, third-party state manager, or UI kit.

Pending work: validate full device-level Android/iOS offline behavior and accessibility, and optionally add search or deliberate cache refresh. These features do not implement moves, evolution/species descriptions, audio, shiny toggles, favorites, background page prefetching, forced refresh, or persistent image downloads.

Manual acceptance checks on both platforms: initial 20 rows; scrolling to 40 and beyond without losing position; fast-scroll request guarding; navigation/back; initial offline error; cached pages offline; failed next-page retry; image failures; narrow screens, large text, and screen readers.
