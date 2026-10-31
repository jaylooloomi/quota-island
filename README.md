<h1 align="center">Quota Pebble 🏝️</h1>

<p align="center"><b>Three AI subscriptions. One tiny island.</b><br>Keep Claude, Gemini, and Codex quotas in sight. Expand for details. Get back to building.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/version-1.1.0-informational" alt="Version 1.1.0">
  <img src="https://img.shields.io/badge/Windows-tested-brightgreen" alt="Windows tested">
  <img src="https://img.shields.io/badge/Electron-TypeScript-47848F" alt="Electron and TypeScript">
  <a href="docs/test-coverage.md"><img src="https://img.shields.io/badge/core%20tests-69%20passing-brightgreen" alt="69 core tests passed locally"></a>
  <a href="README.zh-TW.md"><img src="https://img.shields.io/badge/lang-繁體中文-green" alt="Traditional Chinese"></a>
</p>

<p align="center"><img src="docs/design/compact-double-layer/compact.png" alt="Compact dark island: Claude 36%, Gemini 62%, Codex 12%, with a draggable grip" width="464"><br><sub>Actual app screenshot with demo data. Percentages are illustrative, not live account readings.</sub></p>

## Use cases

| Situation | What you do | What the island shows |
|---|---|---|
| 🧑‍💻 **Deep in a coding session** | Leave the capsule above your windows | Remaining quota at a glance |
| 🔄 **Switching between AI tools** | Expand the island | Each provider's windows and reset times |
| 🔐 **Connecting an account** | Finish authorization | Connection progress, then automatic quota sync |
| 🧩 **Your tools, your order** | Drag an icon or card heading | Shared ordering, saved across restarts |
| ⏳ **A provider is rate-limiting** | Let the countdown run | An explicit error and scheduled retry |
| 🖥️ **A busy desktop** | Collapse it or hide it to the tray | A small capsule, ready when needed |

## Get started

**Requires:** Node.js 24 LTS recommended, npm, and the official provider tools for the accounts you want to monitor. Windows is locally tested. macOS and Linux have build targets but still need real-device validation.

### 1. Start the app

```sh
git clone https://github.com/jaylooloomi/quota-island.git
cd quota-island
git switch design/original-dark-00
npm ci
npm start
```

The branch above contains the compact Original Dark layout shown here. Prefer an executable? Run `npm run dist:win`; the portable Windows executable is written to `release/`. There is currently no published installer download.

### 2. Connect your tools

| Provider | What to install / open | How it connects |
|---|---|---|
| **Claude** | [Claude Code](https://code.claude.com/docs/en/setup) | Use the app's login; paste the browser authorization code back into the app if prompted. Existing CLI authorization can also be used. |
| **Gemini — personal** | Antigravity, running and signed in | Reads Gemini model quotas from its local service. Keep Antigravity open. |
| **Gemini — enterprise** | A Code Assist account | Choose **Code Assist** in Google source settings, then complete Google OAuth. |
| **Codex** | [Codex CLI](https://developers.openai.com/codex/cli) | Use the app's login or an existing local ChatGPT subscription login. |

After authorization, the app comes forward and syncs automatically. Signing into a provider's website alone does not connect the app.

### 3. Keep building

Click a quota or chevron to expand. Drag the left grip to move the island. Drag provider icons or card headings to reorder them.

<p align="center"><img src="docs/design/compact-double-layer/expanded.png" alt="Expanded dark panel with remaining/used switch, three provider cards, quota bars, reset times and connection status" width="480"><br><sub>Original Dark · compact window 464 × 76 · expanded window 616 × 520, including transparent margins. Demo data.</sub></p>

## Everyday controls

The footer now has distinct roles: **Language** opens an in-place four-language
menu; **Sync status** opens provider timestamps, failures and retry countdowns
with a refresh action; **Settings** opens preferences and returns to the same
Quota/Accounts tab when closed. Popovers are mutually exclusive and close on
outside click or Escape. Account management stays in the top Accounts tab.

Version 1.1.0 uses the Compact Double-layer layout: a capsule with mini progress
bars, flat provider rows, visible version labels, and **Quota / Accounts** tabs.
Open Accounts to switch or sign out of Claude/Codex. Signing out requires
confirmation and also affects the official CLI account on this computer.
Gemini personal accounts are managed in Antigravity through its dedicated button.

<p align="center"><img src="docs/design/compact-double-layer/accounts.png" alt="Accounts tab with independent Claude and Codex switch/sign-out controls and Antigravity account management" width="616"><br><sub>Demo account state. No email addresses are inferred or fabricated.</sub></p>

**Languages:** Settings → Language → 繁體中文 / English / 日本語 / 한국어.
Switches immediately and remembers your choice after restart. The tray menu,
quota countdowns, account controls and accessibility labels are localized too.

| Control | Action |
|---|---|
| Remaining / Used | Switch the percentage view; your choice is saved |
| Refresh | Request fresh data after a 5-second debounce; service cooldowns still apply |
| Connection status | Manage authorization and inspect the data source |
| `Alt + ← / →` on a compact provider | Reorder with the keyboard |
| Card's left grip / `Alt + ↑ / ↓` on that grip | Drag or use the keyboard to reorder cards; source-provided plan badges stay visible |
| `Esc` | Close connection details, close settings, then collapse |
| `Ctrl / ⌘ + Alt + Q` | Show or hide the app |
| Settings / system tray | Always-on-top, sources, usage alerts, hide, or quit |

Background polling runs every two minutes. Disabling a source stops its polling. `Retry-After` survives restarts; refresh cannot bypass it. Unknown quotas remain unknown, and stale readings are labeled.

Every quota window shows how many days/hours remain until reset in your selected
language. Hover for the exact date/time and your computer's timezone. If the
provider supplies no reset time, the app says so. Pacing guidance is currently
in the [concept selection stage](docs/design/pacing-proposals/README.md).

## What the numbers mean

Claude's main row shows the current session and weekly all-model limit. Open
**View model limits** for Fable and other scoped limits, including their reset
times. They keep updating in the background; scoped and all-model limits cannot
be added together.

Antigravity now prefers its grouped `RetrieveUserQuotaSummary` source, covering
Gemini weekly/session pools, Claude/GPT weekly/session pools and separate model
limits such as Argon. The compact provider row shows the two most constrained
limits with a **View all limits** count; open it to see every returned group.
These Claude/GPT pools belong to Antigravity, not the independent subscription
cards. Older local services fall back to their measured Gemini model rows.

These are **subscription quotas and reset windows**, not network traffic, API billing, or local token counts.

| Card | Source | Important distinction |
|---|---|---|
| Claude | Local Claude Code authorization → OAuth usage endpoint | The usage endpoint is not a stable public API |
| Gemini | Antigravity local service by default; enterprise Code Assist is optional | Not Gemini website quota; Antigravity's Claude/GPT quotas are not mixed into the other cards |
| Codex | Official `codex app-server` → `account/rateLimits/read` | Uses server-provided windows instead of assuming every plan has the same limits |

## Tested, with boundaries

| Check | Latest local result |
|---|---|
| Core tests | **69 passed** |
| Measured Node modules | **91.91% lines · 88.63% branches · 91.26% functions** |
| Windows packaged app | Desktop controls, ordering and design checks passed |
| Authorization integration | Fixture upstream responses; real local IPC, callbacks and child-process paths |
| Real accounts | Gemini and Codex reads previously verified; Claude's last real check returned HTTP 429 |
| macOS / Linux | Build targets and CI matrix exist; no local real-device validation |

Coverage describes modules loaded by Node tests, **not the entire app**. Electron entrypoints, provider integration and renderer behavior are checked separately. Antigravity native discovery still has a unit-test gap. See [coverage scope](docs/test-coverage.md) and [Actions](https://github.com/jaylooloomi/quota-island/actions) for remote run status.

<details>
<summary><b>Run tests and build packages</b></summary>

```sh
npm run test:coverage  # rebuild, core tests, enforced coverage thresholds
npm run test:desktop   # dimensions, controls, sandbox, encryption
npm run test:auth      # authorization and automatic UI sync
npm run test:order     # drag, keyboard, restart persistence
npm run test:design    # overlap, clipping, bars, states, no-scroll layout
npm run dist:win       # Windows portable executable
npm run dist:mac       # macOS ZIP
npm run dist:linux     # Linux AppImage
```

CI gates: 85% lines, 80% branches and 85% functions in measured modules. Reports are uploaded as workflow artifacts. Windows packages are unsigned; macOS packages are unsigned and not notarized.

Build first, then use `npx electron . --demo` for a demo without provider requests. `npm run check:live`, `npm run check:accounts` and `npm run test:live` query real local account data; they are separate from fixture tests.

</details>

<details>
<summary><b>Credentials and local storage</b></summary>

Claude and Codex credentials remain managed by their official CLIs; the app does not rotate their refresh tokens. Enterprise Google OAuth credentials use native Electron `safeStorage` encryption; plaintext fallback is refused. Tokens are not sent to the renderer or stored in preferences or test reports.

| Platform | App data directory |
|---|---|
| Windows | `%APPDATA%/quota-island` |
| macOS | `~/Library/Application Support/quota-island` |
| Linux | `~/.config/quota-island` or the configured XDG path |

Linux requires a working Secret Service. To remove the app's enterprise Google credential copy, quit and delete `gemini-session.bin` from its data directory. Disabling monitoring does not log out of an official CLI.

</details>

## FAQ

**Why does Gemini use Antigravity?**  
The personal source reads Antigravity's Gemini model quotas. Enterprise Code Assist is a separate setting. See [source research](docs/research.md).

**Why does Claude show a countdown instead of a percentage?**  
The last real request was rate-limited. The app shows that response and retries after the cooldown; it does not invent a quota or treat rate-limiting as a logout.

**Can I switch to the five alternative themes?**  
Those are [design explorations](docs/design/style-explorations/00-six-styles-comparison.png). Original Dark is implemented; there is no theme switcher yet.

**Is this an official provider app?**  
No. This is an independent desktop utility. Provider names belong to their respective owners. Unpublished quota interfaces can change upstream.

## Contributing

For additional credential removal and troubleshooting notes, see the [detailed usage notes in Traditional Chinese](docs/usage-guide.zh-TW.md).

Issues and PRs are welcome. Run the coverage gate and desktop checks relevant to your changes. Include your OS and distinguish demo data from real provider responses in bug reports.

README presentation inspired by [i-want-to-sleep](https://github.com/jaylooloomi/i-want-to-sleep): a compact introduction, screenshots, use-case tables and expandable technical details.

## License

[MIT](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for fonts and bundled material.

Antigravity account controls: **Switch account** opens the official app, clears old quota, and automatically refreshes after a different account is detected. **Disconnect** only stops monitoring in Quota Pebble and persists across restarts; it does not sign out of Antigravity. Direct native logout is not enabled because no supported external logout entry point was verified for the installed 2.27.0 app.

### Pacing mode
Choose **Remaining / Used / Pace** without changing the provider row layout. Pacing uses an independent selected quota window, reserves 5% of total quota by default, and divides the available balance by the actual time until reset. Windows under one day use hourly advice. Details let you choose the window and reserve percentage; both persist locally. Missing or expired reset times, stale data and paused monitoring suppress guidance. These are average budgeting suggestions, not additional provider allowances.

Pacing details expand inline beneath the selected provider row. Only one provider is expanded at a time; the other provider cards remain visible and the fixed-width window grows to fit. Collapse the same row to restore the original height.

### Automatic Hello

Settings provides an automatic Hello switch. At any time of day, each connected, enabled Claude profile is checked independently: the five-hour usage must explicitly be 0%, and its reset must be absent or expired. An active reset timestamp, even with 0% usage, prevents sending. Missing session data is never treated as unused quota. It uses the official CLI and Haiku to send one short Hello, which consumes quota and can establish a new five-hour window; it cannot reset an active window early.

Attempts are at least five hours apart per profile, with a durable claim to prevent duplicates across restart or uncertain outcomes. The app must remain running; no wake or fixed morning schedule is used. Unavailable, signed-out, stale or exhausted profiles do not send. Settings shows outcomes; quota is refreshed after success, and a fresh server reset is required before claiming the window is confirmed. Tests use a fixture CLI without spending live quota.

References: [Claude usage limits](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work), [CLI reference](https://code.claude.com/docs/en/cli-reference).

### Multiple Claude accounts
Use **＋ Add account** below the cards to name and sign into an additional Claude account. Each account uses a separate official Claude Code config directory under the local app data folder. Quotas, cooldowns, pacing preferences, visibility, ordering and logout are isolated. Removing an added account deletes only its managed local profile. Credentials stay in the official CLI profile and never enter renderer state or account metadata. Select the intended account in the browser. The fixed-size compact Claude slot rotates visible accounts every five seconds and shows 1/2, 2/2, etc. Hover pauses rotation and shows the account name, weekly quota, reset time and errors; click switches accounts, while drag still reorders providers. Rotation uses cached readings and makes no quota requests. The expanded panel lists every account. This release adds multiple Claude accounts; additional Codex and Antigravity profiles are not offered.

Drag near a screen edge or corner to snap the visible island to the display work area. Expand, collapse and settings changes keep the selected edge anchored. Drag away to release the anchor; docking is saved across restarts.
