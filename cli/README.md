# xcomb CLI

Use Android phones running [XComb](https://github.com/quitsaurabhverma2008-sketch/xcomb) like small Linux machines
from your computer, over USB. Every phone gets an SSH shell in its Alpine
workspace; you can copy files, forward ports, and run a command on all of them
at once.

Remote access is optional. XComb works fully on the phone without it.

## Install

Needs Node 18+, `adb` (Android platform-tools), and OpenSSH (`ssh`, `scp`;
`rsync` for `xcomb sync`). On macOS, `brew install android-platform-tools`
gives you `adb`; on Linux it's usually the `adb` or `android-tools` package.

```sh
npm install -g xcomb-cli
```

The CLI has no dependencies. Update with `npm update -g xcomb-cli`; remove it
with `npm uninstall -g xcomb-cli` (your keys and pairings stay in `~/.xcomb`).
From a clone of the repo, `npm install -g ./cli` links it instead.

On each phone: install XComb, finish setup, and turn on **USB debugging** in
Android's developer options. Then connect it and allow this computer.

## Pair

```sh
xcomb pair            # or: xcomb pair <serial> --name pixel
```

This makes a key for this computer in `~/.xcomb`, asks for the phone's XComb
password, and sends the public key to the app over adb. The first time, the
phone installs its SSH server (a minute or so). If Android won't start it in
the background, the CLI opens XComb on the phone.

The phone's host key is pinned on first connect, over USB, in
`~/.xcomb/known_hosts`.

## Use

```sh
xcomb devices                         # connected phones and their state
xcomb ssh                             # interactive zsh
xcomb ssh pixel -- make test          # one command
xcomb exec --all -- git -C /workspace/projects/app pull
xcomb cp -r ./app pixel:/workspace/projects/
xcomb cp pixel:/workspace/out.log .
xcomb sync ./site/ pixel:/workspace/site/ --delete
xcomb forward pixel 3000              # phone's port 3000 at localhost:3000
xcomb status --log                    # battery, temperature, server log
xcomb stop                            # turn remote access off on the phone
xcomb unpair                          # remove this computer's key
```

The first time you run `claude`, `codex` or `opencode` on a phone, it installs
that agent into your home there (needs internet, a minute or two) and then
starts it.

From scripts, run commands with `xcomb exec` or `xcomb ssh pixel -- cmd`, not
plain `ssh -tt`: the phone's SSH server (dropbear) drops a command's output when
a terminal is forced and stdin isn't one.

`xcomb cp` copies like `scp` and follows symlinks; `xcomb sync` (rsync `-a`)
keeps them.

When only one phone is connected, you can leave out its name. The adb serial
works anywhere a name does.

### Plain ssh and VS Code

```sh
xcomb config --install
ssh pixel
```

This writes `~/.xcomb/ssh_config` and includes it from `~/.ssh/config`. Each
phone's entry uses `xcomb proxy` as its ProxyCommand, which re-creates the adb
forward on demand. VS Code Remote-SSH picks the hosts up from there.

### Long-running work

Android 12+ kills background child processes beyond a small limit shared by
all apps, which can cut builds and agents short:

```sh
xcomb tune
```

This runs the documented `device_config` and `settings` commands over adb to
lift that limit for the whole phone. It lasts until a factory reset. Also allow
XComb unrestricted battery use; XComb asks for this during setup.

## How it works

- The phone runs `dropbear` inside Alpine, bound to `127.0.0.1:8022`. The CLI
  reaches it with `adb forward`, so nothing listens on Wi-Fi.
- Logins are key-only, never as root, and only as the XComb profile user.
- The CLI talks to the app with `adb shell content call`. The app answers that
  only for the adb shell, and pairing also needs the XComb password.
- Environment: `XCOMB_HOME` (default `~/.xcomb`), `ADB` (path to adb),
  `XCOMB_PASSWORD` (non-interactive pairing), `XCOMB_APP_ID`.
