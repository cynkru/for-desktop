<div align="center">
<h1>
  Stoat for Desktop
  
  [![Stars](https://img.shields.io/github/stars/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/stargazers)
  [![Forks](https://img.shields.io/github/forks/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/network/members)
  [![Pull Requests](https://img.shields.io/github/issues-pr/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/pulls)
  [![Issues](https://img.shields.io/github/issues/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/issues)
  [![Contributors](https://img.shields.io/github/contributors/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/graphs/contributors)
  [![License](https://img.shields.io/github/license/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/blob/main/LICENSE)
</h1>
Application for Windows, macOS, and Linux.
</div>
<br/>

## Installation

<a href="https://repology.org/project/stoat-desktop/versions">
    <img src="https://repology.org/badge/vertical-allrepos/stoat-desktop.svg" alt="Packaging status" align="right">
</a>

- All downloads and instructions for Stoat can be found on our [Website](https://stoat.chat/download).

## Local RPC

Stoat Desktop exposes a local IPC server using Discord's 8-byte IPC frame
header (opcode and payload length, both unsigned little-endian 32-bit integers)
followed by a UTF-8 JSON payload. It accepts protocol version `1` handshakes
and responds to opcode `3` pings with opcode `4` pongs.

The server listens on `discord-ipc-0` through `discord-ipc-9` in the temporary
directory selected from `XDG_RUNTIME_DIR`, `TMPDIR`, `TMP`, `TEMP`, or `/tmp`.
On Windows it uses the corresponding `\\?\pipe\discord-ipc-N` named pipes.
It binds the first available endpoint. If another Discord-compatible server
already owns a lower-numbered endpoint, connect specifically to Stoat's
endpoint rather than relying on automatic Discord IPC discovery.

Start with an opcode `0` handshake containing
`{"v":1,"client_id":"your-client-id"}`. The opcode `1` response is a `READY`
event containing the Stoat application name and version.

After the handshake, send opcode `1` with a JSON request:

```json
{ "cmd": "GET_STATUS", "nonce": "1" }
```

The response uses opcode `1` and includes app name, version, platform, and
window visibility/focus/minimized state. `{"cmd":"SHOW_WINDOW","nonce":"2"}`
restores and focuses the app window. Unsupported commands return an `ERROR`
event. The server only exposes these local status/window commands; it does not
provide account data or accept Rich Presence updates.

## Development Guide

_Contribution guidelines for Desktop app TBA!_

<!-- Before contributing, make yourself familiar with [our contribution guidelines](https://developers.revolt.chat/contrib.html), the [code style guidelines](./GUIDELINES.md), and the [technical documentation for this project](https://revoltchat.github.io/frontend/). -->

Before getting started, you'll want to install:

- [Git](https://git-scm.com/install/)
- [mise-en-place](https://mise.jdx.dev/getting-started.html)

Then proceed to setup:

```bash
# clone the repository
git clone --recursive https://github.com/stoatchat/for-desktop stoat-for-desktop
cd stoat-for-desktop

# Install tools from mise
mise install

# install all packages
mise install:frozen

# start the application
mise dev
# ... or build the bundle
mise build
# ... or build all distributables
mise make
```

Various useful commands for development testing:

```bash
# connect to the development server
mise exec -- pnpm start -- --force-server http://localhost:5173

# test the flatpak (after `make`)
mise exec -- pnpm install:flatpak
mise exec -- pnpm run:flatpak
# ... also connect to dev server like so:
mise exec -- pnpm run:flatpak --force-server http://localhost:5173

# Nix-specific instructions for testing
nix develop
pnpm package
pnpm run:nix
# ... as before:
pnpm run:nix --force-server=http://localhost:5173
# a better solution would be telling
# Electron Forge where system Electron is
```

### Pulling in Stoat's assets

If you want to pull in Stoat brand assets after pulling, run the following:

```bash
# update the assets
mise assets
```

Currently, this is required to build, any forks are expected to provide their own assets.
