# Dashmon — Customization guide

How to create your own themes and manage icons.

## Themes

A theme is a small JSON file: a color palette (`variables`, exposed as CSS
custom properties) plus optional extra CSS. Native themes live in
`public/themes/` (see `dark.json` for a complete example). Custom themes are
imported from the UI and persisted in `/app/data/themes/`.

### File format

```json
{
  "id": "mytheme",
  "name": "My theme",
  "author": "You",
  "description": "A short description",
  "version": "1.0.0",
  "variables": {
    "bg": "#101418",
    "surface": "#1a2027",
    "surface-2": "#222a33",
    "surface-3": "#2a3440",
    "border": "#33404d",
    "text": "#f3f5f7",
    "muted": "#98a4b1",
    "accent": "#4f8f89",
    "danger": "#b85c5c",
    "success": "#3cf59b",
    "error": "#ff4d6d",
    "shadow": "0 2px 6px rgba(0,0,0,.22)"
  },
  "css": "[data-theme=\"mytheme\"] .service-icon { filter: none !important; }"
}
```

### Rules

- **`id`**: lowercase letters, digits, `-` and `_` (anything else is converted
  to `-`). It must not clash with the native ids (`dark`, `light`, `polar`, `matrix`,
  `high-contrast`).
- **`variables`**: the 10 keys below are all **required** — the import is
  rejected if any is missing. They map to `--bg`, `--surface`, `--surface-2`,
  `--surface-3`, `--border`, `--text`, `--muted`, `--accent`, `--danger` and
  `--shadow`, used by every component.
- **`success`/`error`** (optional): status colors — the availability dots and
  the CPU/RAM bars (green/orange-red) use `--success` and `--error`. If absent,
  the CSS defaults apply.
- **`css`** (optional): up to 64 KB of CSS. Prefix your rules with
  `[data-theme="<id>"]` so they affect only this theme.

### Variable reference

| Variable | Usage |
| --- | --- |
| `bg` | page background |
| `surface` | cards, headers, menus |
| `surface-2` | hover / focus states |
| `surface-3` | icon chips, emphasis |
| `border` | borders, separators |
| `text` | main text |
| `muted` | secondary text |
| `accent` | highlights, active elements |
| `danger` | errors, offline status |
| `shadow` | card box-shadow |
| `success` (optional) | status "up" dots, metric bars |
| `error` (optional) | status "down" dots, critical bars |
| `warning` (optional) | "needs attention" dots, high bars, non-critical monitoring |

### Creating a theme

1. Open **Settings** from the top-right menu, then **Appearance → Theme**.
2. Choose a starting theme and click **Export** → a `theme-<id>.json` is
   downloaded.
3. Edit the JSON (new `id`, `name`, colors and optional `css`) in any editor.
4. Under **Theme management**, click **Import** and select the
   file. The theme appears under *Custom themes* in the theme selector.
5. Select it and close the window. It is applied immediately and survives
   container restarts (stored in `/app/data/themes/`).

To remove a custom theme: select it, then **Theme management → Delete**
(native themes cannot be deleted).

## Icons

There are two icon systems in Dashmon:

### Font Awesome icons (categories, hosts, web links)

Categories, hosts and web links use Font Awesome 6 (Free) classes, stored
directly in their `icon` field (e.g. `fa-solid fa-folder`,
`fa-brands fa-github`).

In the editor, click the icon of the item to open the picker and choose one.

### Images (services)

A service card renders an image, not a font icon: its `icon` is a PNG imported
into your library, referenced as `icons/<filename>` and served by the app. An
external image URL is not accepted: the browser never loads a picture from
another site. [Dashboard Icons](https://dashboardicons.com/) provides plain PNG
logos for many self-hosted apps, ready to import. Without an image, the card
shows a generic icon.

**Importing a PNG:**

1. **Settings → Dashboard → Images**, then *Add images* — or click the
   image button on a service row while editing it.
2. Pick a `.png` file (PNG only). It is uploaded to `/app/data/icons/` and
   referenced as `icons/<filename>`.
3. The service uses it right away.

**Deleting images:** **Settings → Dashboard → Images**, select the ones to remove,
then *Delete selection*.

### Example

A service with an imported image:

```json
{ "name": "Portainer", "url": "https://portainer.exemple.lan", "icon": "icons/portainer.png", "monitor": true }
```

The `icons/portainer.png` PNG was imported through **Settings → Dashboard → Images**.

## Fortune Cookie

The **Fortune Cookie** bar shows a phrase of the day under the web links bar.
Turn it on or off in **Settings → Appearance → Theme**: the choice is saved in
`config.json` and applies to every browser.

```json
"fortune": true
```

- A click on the phrase draws another one, with a little confetti.
- The cross at the far right hides the bar until midnight (the reader's local
  time). **Refresh statuses** in the `⋮` menu brings it back at once.
- The bar steps aside during a search, and is hidden on phones and tablets
  (under 800 px), like the web links bar.
- Older configurations with the special tile `"specialTile": { "type":
  "fortune" }` turn the bar on; the tile itself no longer exists.

**How the phrase is chosen.** The day of the reader (local, not UTC) and the
bar identity (`fortune`) are hashed into an index, so the phrase is stable for
the whole day. A click overrides that choice in the browser, tagged with the day
that produced it: the next day the tag no longer matches, the bar falls back to
the phrase of the day.

Phrases live in `public/fortune-messages.json`, with `fr` and `en` text per
entry. Adding an entry there needs no code change. If a language is missing on
an entry, the other one is used.
