# NightSeek Guide star

An open sky-blue telescope lens points towards a white guide star, on deep navy.
The mark uses bold, flat shapes so it remains readable in the header and favicon.
The existing NightSeek wordmark is unchanged.

The single master is `web/src/assets/nightseek.svg`. `NightSeekIcon` imports it for
the header, setup, loading screen and About dialog. Do not draw separate variants
in React or edit the generated exports by hand.

From `web/`, run `pnpm icons:generate` after changing the SVG, and `pnpm icons:check`
to verify exports. CI runs the same check. The script generates the favicon,
192/512 px PWA icons, maskable icons, 180 px Apple touch icon, 1024 px iOS icon
and centred iOS launch-screen images. Social previews use the 512 px PWA export.
Maskable exports include additional padding for circular launcher masks. PNGs
have opaque navy backgrounds and no alpha channel, including the iOS asset.

Review at 16, 32 and 64 px as well as in the app. Updating the iOS asset in the
repository does not publish a native app update; that requires a separate release.
