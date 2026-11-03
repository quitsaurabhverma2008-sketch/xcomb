# XComb avatar source art

The nine geometric avatars used by XComb. Each avatar is a flat mark on a warm
dark rounded square, drawn in the XComb palette (yellow, blue, pink, violet,
teal, orange). The SVGs in this directory are the source art; the PNG files one
level up are the exported assets used by the app.

| File | Name | Shape |
| :-- | :-- | :-- |
| `falcon.svg` | Nova | Four-point star |
| `ibis.svg` | Orbit | Ring with a satellite dot |
| `jackal.svg` | Pulse | Waveform bars |
| `cat.svg` | Prism | Faceted triangle |
| `cobra.svg` | Helix | Twisted double loop |
| `scarab.svg` | Grid | Rounded grid of squares |
| `lotus.svg` | Bloom | Four-petal flower |
| `papyrus.svg` | Wave | Layered sine waves |
| `sun-disk.svg` | Solar | Circle with radiating rays |

Keep the filenames stable. The app maps them to the `AvatarId` values in
`src/profile/profileStore.ts`.
