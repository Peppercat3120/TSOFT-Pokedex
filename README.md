# TSOFT Pokédex

React Native CLI application built with strict TypeScript for the TSOFT Pokédex challenge. Pokémon data comes from PokéAPI.

## Features

- Paginated list: loads 20 Pokémon initially and up to 20 more when scrolling, with guards against duplicate requests.
- Detail screen: artwork, types, abilities, base statistics, height, weight, and base experience.
- Loading, error, empty, and saved-data feedback, with retry actions and pull-to-refresh.
- Local caching with AsyncStorage for previously loaded list pages and Pokémon details.
- Back navigation preserves the loaded list and scroll position.

## Setup and execution

Requirements: Node.js 22.11 or newer and a configured React Native development environment. Android requires the Android SDK and JDK; iOS requires macOS, Xcode, Ruby, and CocoaPods.

Install JavaScript dependencies:

```sh
npm ci
```

### Native toolchain configuration

For Android, install JDK 17 and these components through Android Studio's SDK Manager (enable **Show Package Details** to select exact versions):

- Android SDK Platform 37.
- Android SDK Build-Tools 37.0.0.
- NDK (Side by side) 27.1.12297006.
- Android SDK Platform-Tools, plus Android Emulator and a system image if using an emulator.

Use the committed Gradle 9.4.1 wrapper; no separate Gradle installation is needed. Configure your terminal on macOS:

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
java -version
adb devices
```

Adjust `ANDROID_HOME` to your SDK installation path. On Linux or Windows, set `JAVA_HOME` to your JDK 17 installation and `ANDROID_HOME` to your SDK installation, and add the corresponding executable directories to `PATH`. Alternatively, configure Gradle SDK discovery with `sdk.dir=/absolute/path/to/your/Android/sdk` in the ignored `android/local.properties` file. Use an emulator or device running Android API 24 or newer. Ensure the terminal selects JDK 17; Java 8 cannot run this project's Gradle wrapper.

For iOS, the verified native build used Xcode 27.0 (27A266a) and iOS Simulator SDK 27.0. The app deployment target is iOS 15.1. The local environment used Ruby 3.1.3 and Bundler 2.3.26; `Gemfile.lock` pins CocoaPods 1.15.2. Select Xcode and install the locked Bundler version:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
xcodebuild -version
gem install bundler -v 2.3.26
```

Adjust the Xcode path if needed, complete Xcode's first-launch setup, and install an iOS Simulator runtime in Xcode Settings. Build scripts resolve Node through `ios/.xcode.env`; if Xcode cannot resolve your Node installation, set `export NODE_BINARY=/absolute/path/to/node` in the ignored `ios/.xcode.env.local` file. For physical iOS devices, open `ios/TSOFTPokedex.xcworkspace` in Xcode and select your development team under the app target's **Signing & Capabilities**; simulator builds do not require signing configuration.

For iOS, also install Ruby dependencies and pods:

```sh
bundle install
cd ios
bundle exec pod install
cd ..
```

Start Metro:

```sh
npm start
```

In another terminal, run the app on an emulator, simulator, or connected device:

```sh
npm run android
# Or, on macOS:
npm run ios
```

### Known iOS issue: Xcode 27

The iOS project includes a workaround for the Xcode 27 launch error associated with the legacy UIKit application lifecycle. `ios/TSOFTPokedex/AppDelegate.swift` defines a `SceneDelegate` that creates the window and starts React Native, and `ios/TSOFTPokedex/Info.plist` registers it through `UIApplicationSceneManifest`.

Running `pod install` preserves the workaround. If the `ios/` directory is regenerated, preserve or reapply both changes unless the new template already supports the scene lifecycle.

## Architecture and dependencies

The project follows Clean Architecture with explicitly typed entities, API DTOs, component props, and navigation parameters:

- `src/domain/`: entities, repository interfaces, request validation, and use cases.
- `src/data/`: native `fetch` access to PokéAPI, DTO validation and mapping, AsyncStorage persistence, and repository implementations.
- `src/presentation/`: screens, components, custom hooks, and React Navigation configuration. Screens access data through hooks and use cases.
- `App.tsx`: composes the shared repository and use cases and provides them to the presentation layer.

React Native supplies UI primitives; React hooks and Context handle state and dependency injection. AsyncStorage provides persistence, and React Navigation native-stack provides navigation. `react-native-screens` and `react-native-safe-area-context` support native navigation and safe-area handling. The app uses no third-party UI kit, state management library, or HTTP wrapper.

## API and offline behavior

The list uses `GET https://pokeapi.co/api/v2/pokemon?offset=0&limit=20`; subsequent requests follow the returned pagination cursor. List sprites are derived from Pokémon IDs using the PokéAPI sprite repository. Details use `GET https://pokeapi.co/api/v2/pokemon/{id}` and artwork URLs from the response.

Validated list pages and details are cached separately with a 24-hour cache-first policy. Expired data can fall back to saved data after connectivity or server failures, with a visible warning. Refresh and explicit retries request current data. Automatic recovery is bounded and runs while the screen is focused and the app is active.

Offline access requires previously cached data. Startup loads the first page; additional cached pages become available through pagination. Uncached pages or details can fail offline, while existing rows remain usable. Images are not explicitly persisted, so offline image availability is not guaranteed.

## Verification

```sh
npx tsc --noEmit
npm run lint
npm test -- --runInBand --no-watchman
```

Tests cover domain use cases, data validation and caching, and presentation behavior using fixtures and mocked dependencies without live API requests. `--no-watchman` avoids requiring a local Watchman service.

Device acceptance checks on Android and iOS:

- Initial 20 rows, pagination, and duplicate-request prevention during fast scrolling.
- Detail navigation and return to the same list position.
- Loading, empty, error, retry, refresh, and image fallback behavior.
- Cached and uncached pages and details while offline.
- Narrow screens, large text, and screen-reader navigation.

Full device-level offline and accessibility validation remains pending.
