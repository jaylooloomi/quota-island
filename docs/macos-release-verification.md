# macOS release verification

Version: v1.16.10
Build source: 36d45f6 (native macOS workflow and current app source).
Workflow: https://github.com/jaylooloomi/quota-island/actions/runs/41268179244

- Apple Silicon: macos-15 / arm64; native ZIP build, 117 unit tests, ad-hoc signature integrity verification, packaged launch and UI smoke checks passed.
- Intel: macos-15-intel / x64; the same checks passed natively.
- Both: pet preview/apply and 12 background load/persistence tests passed against packaged executables.
- ZIP SHA-256 values were checked against the checksums produced by each macOS runner.
- No Developer ID certificate or Apple notarization is configured. Ad-hoc signing is not an Apple-verified developer identity.
- CI uses isolated demo data. Live Claude/Codex/Antigravity login and quota access on Mac remain unverified.

Download the matching architecture ZIP from Releases, unzip, and move Quota Pebble.app into Applications. Apple first-launch guidance: https://support.apple.com/102445 . No global Gatekeeper disabling is required.

Evidence screenshots remain in the workflow artifacts.
