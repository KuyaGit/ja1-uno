# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Architecture

This is a fresh Expo Router starter app (SDK 57, React 19, React Native 0.86, New Architecture). All app code lives under `src/`:

- `src/app/` — Expo Router routes only. `_layout.tsx` wraps the app in `ThemeProvider` (light/dark via `useColorScheme`) and renders `AnimatedSplashOverlay` + `AppTabs`. `index.tsx` and `explore.tsx` are the two tab screens.
- `src/components/app-tabs.tsx` — defines the native tab bar using `expo-router/unstable-native-tabs`, driven by theme colors from `src/constants/theme.ts`. Has a `.web.tsx` counterpart since `NativeTabs` is native-only.
- `src/components/` — platform-specific files use the standard Expo/Metro suffix convention (`.web.tsx` for web overrides, e.g. `animated-icon.web.tsx`, `app-tabs.web.tsx`); `animated-icon.module.css` is a CSS module used only by the web variant.
- `src/constants/theme.ts` — single source of truth for `Colors` (light/dark), `Fonts` (per-platform via `Platform.select`), `Spacing` scale, and layout constants (`BottomTabInset`, `MaxContentWidth`). Prefer extending this file over hardcoding colors/spacing in components.
- `src/hooks/use-theme.ts` and `use-color-scheme.ts` (+ `.web.ts` variant) — theme/color-scheme access; `use-theme.ts` normalizes the `'unspecified'` scheme to `'light'` before indexing into `Colors`.

### Path aliases

`@/*` maps to `src/*` and `@/assets/*` maps to `assets/*` (see `tsconfig.json`). Use these instead of relative `../../` imports.

### Styling

No styling library is installed yet (NativeWind/Tamagui/Unistyles are mentioned only as options in a comment in `theme.ts`). Styling is currently plain `StyleSheet`/inline styles keyed off `Colors`/`Spacing` from `theme.ts`, plus a `global.css` for the web build.
