<div align="center">

<p><img src="docs/readme/banner.png" width="880" alt="XComb — a yellow X-and-comb mark above the name XCOMB, with Claude Code, Codex, Gemini, OpenCode and FreeBuff logos"></p>

<br>

**Claude Code, Codex, OpenCode, Gemini CLI and FreeBuff in a real Linux terminal on your Android phone.**

No root. No Termux. Open source.

<a href="https://github.com/quitsaurabhverma2008-sketch/xcomb/releases/latest"><img src="docs/readme/get-apk-on-github.png" height="72" alt="Get the APK on GitHub"></a>

[![Build XComb APK](https://github.com/quitsaurabhverma2008-sketch/xcomb/actions/workflows/build-apk.yml/badge.svg)](https://github.com/quitsaurabhverma2008-sketch/xcomb/actions/workflows/build-apk.yml)
[![Latest APK](https://img.shields.io/github/v/release/quitsaurabhverma2008-sketch/xcomb?filter=v*&label=APK&color=FFC21A&labelColor=0b0906)](https://github.com/quitsaurabhverma2008-sketch/xcomb/releases/latest)
[![Android 7.0+ · arm64](https://img.shields.io/badge/Android-7.0%2B%20%C2%B7%20arm64-FFC21A?labelColor=0b0906)](https://github.com/quitsaurabhverma2008-sketch/xcomb/releases/latest)
[![MIT license](https://img.shields.io/badge/license-MIT-FFC21A?labelColor=0b0906)](LICENSE)

[Download APK](https://github.com/quitsaurabhverma2008-sketch/xcomb/releases/latest) · [Build from source](#build-from-source) · [Issues](https://github.com/quitsaurabhverma2008-sketch/xcomb/issues) · [Contributing](CONTRIBUTING.md)

<br>

<img src="docs/screenshots/xcomb-home.jpg" width="168" alt="XComb home screen with the user, GitHub, device stats and six agent tiles">&nbsp;
<img src="docs/screenshots/xcomb-onboarding.jpg" width="168" alt="XComb onboarding: coding agents in your pocket">&nbsp;
<img src="docs/screenshots/xcomb-workspace.jpg" width="168" alt="XComb workspace file browser with copy to downloads">

<br>

<img src="docs/screenshots/xcomb-choose-linux.jpg" width="168" alt="XComb setup: choose Alpine or Debian">&nbsp;
<img src="docs/screenshots/xcomb-create-user.jpg" width="168" alt="XComb setup: create a user and pick an avatar">&nbsp;
<img src="docs/screenshots/xcomb-terminal-keys.jpg" width="168" alt="XComb setup: terminal key guide">

</div>

<br>

XComb turns your Android phone into a complete ARM64 Linux workspace. It
unpacks Alpine Linux inside the app, opens a real terminal, and puts the coding
agents one tap away: **Claude Code**, **Codex**, **OpenCode**, **Gemini CLI**,
**FreeBuff**, or a plain zsh shell. Point an agent at a project and let it work;
sessions keep running with the screen off.

No root. No Termux. No computer. Everything runs on the phone, in the app
sandbox, with a warm black and yellow interface built for a touch screen.

## Highlights

| | |
| :-- | :-- |
| **Real Linux** | Alpine Linux ARM64, unpacked from a pinned minirootfs and checked against SHA-256 before it runs. `git`, `curl`, `jq`, `rg`, `python3`, Node and `apk add` work like a normal box. |
| **A terminal that behaves** | Native PTY and renderer with resize, Ctrl-C, and job control. The key bar adds Esc, Tab, arrows, paste, and sticky Ctrl/Alt for everything a phone keyboard leaves out. |
| **Five agents, one tap** | Claude Code, Codex, OpenCode, Gemini CLI and FreeBuff each install on first open, with the installer output right in the terminal. |
| **Sessions that survive** | Terminals run in a foreground service in their own process. Lock the phone or close the UI; the agent keeps working and notifies you when it needs an answer. |
| **Your projects** | Create a folder, clone any HTTPS or SSH Git URL, or sign in to GitHub and pick from your repositories. Everything lives under `/workspace/projects`. |
| **A file browser** | Preview what the agents changed, then copy any folder to `Download/XComb` in one tap. |
| **Private by default** | No analytics, ads, crash reporting, or Google services. An optional password locks the app after 15 minutes in the background. |
| **Optional remote access** | Pair a computer over USB for an SSH shell on the phone. Off by default, loopback only, key-only logins. |

## Supported agents

| Agent | What it is | Installed by XComb |
| :-- | :-- | :-- |
| <img src="src/terminal/harness-logos/claude-code.png" width="22" alt=""> **Claude Code** | Anthropic's terminal coding agent | First open |
| <img src="src/terminal/harness-logos/openai-blossom.png" width="22" alt=""> **Codex** | OpenAI's terminal coding agent | First open |
| <img src="src/terminal/harness-logos/opencode.png" width="22" alt=""> **OpenCode** | Open-source terminal coding agent | First open |
| <img src="src/terminal/harness-logos/gemini.png" width="22" alt=""> **Gemini CLI** | Google's terminal AI assistant | First open |
| <img src="src/terminal/harness-logos/freebuff.png" width="22" alt=""> **FreeBuff** | Free, ad-supported coding agent from Codebuff | First open |
| **Bare terminal** | zsh in the Linux guest | Built in |

Each agent gets its own Linux user and private home. All agent users share the
`/workspace` group so they can work on the same projects. Sign-in credentials
stay inside each CLI; XComb never handles provider passwords.

## Install

### Download the APK

1. Open the [latest release](https://github.com/quitsaurabhverma2008-sketch/xcomb/releases/latest).
2. Download **`XComb-1.1.1.apk`**.
3. **Uninstall any older build first.** CI builds are signed with a per-run
   throwaway key, so Android refuses to update an app signed by another key.
   Export anything you need from `/workspace` before uninstalling.
4. Open the APK, allow installs from your browser or file manager, and install.
5. Launch XComb and create your Linux user.

You need an **ARM64** phone (`arm64-v8a`) on **Android 7.0** or newer. The first
launch downloads Alpine Linux and verifies it before unpacking.

> **Data warning:** uninstalling the app removes its private storage, including
> `/workspace` and every agent home. Copy important projects to shared Downloads
> first with **Files → Copy this folder to Downloads**.

### First run

1. Pick a username and an optional app password.
2. Wait for Alpine to download and unpack (about a minute on Wi-Fi).
3. Tap an agent tile. XComb installs that CLI the first time you open it.
4. Sign in inside the CLI. XComb never sees the provider password.
5. Create or clone a project under `/workspace/projects`.

## Using XComb

### Home

The home screen shows your Linux user, GitHub account, storage, RAM, network and
battery state, the six session tiles, and any sessions that are already running.
**Settings** is in the top right; **Browse your files** opens the read-only file
browser.

### Sessions

Up to four sessions can run at once, each with its own notification and its own
agent home. **STOP** on a session card ends it. Closing the UI does not end a
session: the terminal lives in a foreground service in the `:terminal` process.

### Projects and GitHub

Create an empty folder, clone an HTTPS or SSH URL, or sign in to GitHub with a
browser device login and pick a repository. Projects live under
`/workspace/projects` and are visible to every agent user.

### Files

The read-only browser previews text files, shows sizes, and copies a folder to
`Download/XComb` for sharing. It is the easiest way to rescue work before an
uninstall.

### Settings

- **Appearance** — yellow theme and text size.
- **Terminal** — key bar, haptics, and scrollback.
- **Security** — app lock and the background lock timer.
- **Remote access** — pair or revoke computers.
- **About** — version, licenses, and source.

## Remote access (optional)

XComb works fully on the phone. If you also want to use it like a small cloud
VM, pair a computer over USB and open an SSH session to the phone:

- The SSH server listens on loopback only and reaches your computer through
  `adb forward`, so nothing is exposed on Wi-Fi.
- Logins are key-only. Root is refused.
- **Settings → Remote access** turns it off and lists paired computers you can
  revoke.

A companion CLI in [`cli/`](cli/README.md) handles pairing and port forwarding.

## Security and privacy

- **Android's app sandbox is the only real security boundary.** PRoot emulates
  user IDs but gives no kernel isolation between agent users, so don't run code
  you don't trust.
- **No telemetry.** There is no analytics, advertising, crash reporting, or
  Google services dependency. The diagnostic log stays on the device and records
  lifecycle metadata only, never terminal input or output.
- **Agent credentials stay inside each CLI.** XComb does not proxy or store
  provider passwords.
- **Codex sandbox note.** Codex's own Linux sandbox does not work under PRoot,
  so the shell wraps `codex` with `--sandbox danger-full-access`; Codex's
  approval prompts still apply.
- **Remote access is off until paired.** Any app on the phone can reach loopback
  ports, so the paired key is what keeps others out.

### Permissions

| Permission | Why |
| :-- | :-- |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Download Alpine, packages and agents; show network state on the home screen |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE` | Keep terminal sessions running in a separate `:terminal` process while the UI is closed |
| `POST_NOTIFICATIONS` | One notification per running session, and "waiting for you" when an agent finishes a turn |
| `WAKE_LOCK` | Keep the CPU awake while a session is running |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Asked for during setup so Android does not pause long agent runs |
| `VIBRATE` | Short haptic feedback on button taps |
| `WRITE_EXTERNAL_STORAGE` (API ≤ 28 only) | Copy a folder to `Download/XComb` on old Android versions |

## How it works

```
React Native UI (App.tsx, src/)
  │  TerminalRuntime TurboModule + TerminalCanvas / TerminalInput native views
  ▼
Kotlin native layer (android/app/src/main/java/.../terminal)
  ├─ DistroStore*            rootfs download → verify → extract → promote
  ├─ ProotSessionLauncher    builds the PRoot command line and guest environment
  ├─ TerminalSessionService  foreground service in the :terminal process
  └─ NativeTerminalEngine / TerminalCanvasView  VT parsing and rendering
        │
        ▼
terminal_pty.c (JNI) ── PRoot (native/, built from source) ── Alpine rootfs
```

Each agent runs as its own guest user with a private home; all agent users share
workspace GID 1000.

## Build from source

### Prerequisites

- Node.js ≥ 22.11 (see `.node-version`)
- JDK 17
- Android SDK and NDK — the standard
  [React Native environment](https://reactnative.dev/docs/set-up-your-environment)
- `make`, `bash` and `git` for the native runtime

### Steps

```sh
git clone --recurse-submodules https://github.com/quitsaurabhverma2008-sketch/xcomb.git
cd xcomb
npm ci
npm run build:android:debug      # or build:android:release
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Cloned without `--recurse-submodules`? Run `git submodule update --init` to fetch
the pinned PRoot and libandroid-shmem sources.

Debug builds embed the JavaScript bundle, so they start without Metro. Release
builds stay unsigned unless you pass a keystore through the Gradle properties
declared in `android/app/build.gradle` (the property names are unchanged from
the fork base), for example in `~/.gradle/gradle.properties`.

### GitHub Actions

The [Build XComb APK](.github/workflows/build-apk.yml) workflow builds a signed
release APK on manual dispatch and on pushes to the `xcomb-update` branch. It
installs Node and JDK 17, builds both native submodules, runs typecheck and Jest,
builds the Android release APK, and uploads it as the **xcomb-apk** artifact.

The workflow signs with a throwaway key generated per run (`CN=XComb`). That is
fine for sideloading and testing, but it means every CI APK is a fresh identity:
uninstall the previous build before installing a new one. For real updates, sign
release builds with your own long-lived keystore.

### Tests

```sh
npm run typecheck
npm run lint
npm run test:unit                # Jest (TypeScript / React Native)
npm run test:kotlin              # JVM unit tests for the native layer
npm run test:android:connected   # instrumented tests on a connected device
```

Typecheck and Jest run before the APK build. The workflow keeps the APK step
strict; the check step is reported separately so a type-only failure does not
hide a buildable APK.

## Troubleshooting

| Symptom | Fix |
| :-- | :-- |
| **"App not installed"** | An older build signed with a different key is still installed. Uninstall it first — app data will be removed. |
| **First launch is slow** | Alpine is downloading and verifying. Keep the phone on Wi-Fi and the app in the foreground. |
| **An agent fails to install** | Check the network and the package mirror in **Settings**. Reopen the tile to retry. |
| **Session stops when the screen locks** | Allow XComb to ignore battery optimizations and keep the foreground-service notification enabled. |
| **I need my files before uninstalling** | **Files → Copy this folder to Downloads** copies to `Download/XComb`. |
| **No root / no Termux?** | Correct. XComb ships its own Linux runtime and needs neither. |
| **Which phones work?** | ARM64 (`arm64-v8a`), Android 7.0 (API 24) or newer. |

## Package identity

| | |
| :-- | :-- |
| App label | **XComb** |
| Application ID | Unchanged from the MIT-licensed fork base — declared in [`android/app/build.gradle`](android/app/build.gradle) |
| Version | `1.1.1` (versionCode `7`) |
| ABI | `arm64-v8a` only |
| Min / target SDK | 24 / 36 |
| Source | <https://github.com/quitsaurabhverma2008-sketch/xcomb> |
| Releases | <https://github.com/quitsaurabhverma2008-sketch/xcomb/releases> |
| Issue tracker | <https://github.com/quitsaurabhverma2008-sketch/xcomb/issues> |
| License | [MIT](LICENSE); bundled components in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |

The application ID and native module names were kept from the fork base so the
native layer does not need a parallel rewrite. They are implementation details;
the app label, UI and documentation are XComb.

## Third-party build components

- **PRoot, talloc and libandroid-shmem** are compiled during the Gradle build by
  [`scripts/native/build-proot-runtime.sh`](scripts/native/build-proot-runtime.sh):
  - `native/proot`: submodule, [termux/proot](https://github.com/termux/proot) v5.1.107.92, GPL-2.0-or-later;
  - `native/libandroid-shmem`: submodule, [termux/libandroid-shmem](https://github.com/termux/libandroid-shmem) v0.7, BSD-3-Clause;
  - `native/talloc`: talloc 2.4.3 core sources, vendored, LGPL-3.0-or-later.
- **The PTY** is [`android/app/src/main/cpp/terminal_pty.c`](android/app/src/main/cpp/terminal_pty.c) (JNI).
- **Hermes bytecode compiler.** Gradle uses the prebuilt `hermesc` from
  `node_modules/hermes-compiler` by default.

No binaries are committed except `android/gradle/wrapper/gradle-wrapper.jar`.

**Runtime downloads:** a pinned Alpine minirootfs from `dl-cdn.alpinelinux.org`,
checked against a SHA-256 in
[`AlpineRootfsCatalog.kt`](android/app/src/main/java/.../terminal/AlpineRootfsCatalog.kt),
then Alpine packages, then each agent from its publisher the first time it is
opened.

## Contributing

Use [Issues](https://github.com/quitsaurabhverma2008-sketch/xcomb/issues) for
reproducible bugs and concrete feature requests. Read
[Contributing](CONTRIBUTING.md), the
[Code of Conduct](.github/CODE_OF_CONDUCT.md), and the
[security policy](.github/SECURITY.md) before opening a pull request or reporting
a vulnerability.

## Credits

XComb is an independent UI rebrand of an MIT-licensed Android/Linux terminal
project. The Linux runtime, terminal engine and most of the Android architecture
come from that project and remain under its original copyright. XComb-specific
work covers the UI theme, branding, agent artwork, avatars, documentation and
store metadata.

Agent names and marks belong to their respective owners. See
[`src/terminal/harness-logos/README.md`](src/terminal/harness-logos/README.md)
for logo sources.

## License

[MIT](LICENSE). Bundled third-party components (xterm.js, PRoot, talloc,
libandroid-shmem, fonts, agent marks) are listed with their licenses in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

<div align="center">
<br>
<sub>XComb · Linux coding agents on Android</sub>
</div>
