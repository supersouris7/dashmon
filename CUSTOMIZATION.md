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
  to `-`). It must not clash with the native ids (`dark`, `light`, `black`,
  `matrix`, `rainbow-dark`, `rainbow-light`).
- **`variables`**: the 10 keys below are all **required** — the import is
  rejected if any is missing. They map to `--bg`, `--surface`, `--surface-2`,
  `--surface-3`, `--border`, `--text`, `--muted`, `--accent`, `--danger` and
  `--shadow`, used by every component.
- **`success`/`error`** (optional): status colors — the availability dots and
  the CPU/RAM bars (green/orange-red) use `--success` and `--error`. If absent,
  the CSS defaults apply.
- **`css`** (optional): any CSS, scoped under `[data-theme="<id>"]`. Max 64 KB.

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

### Creating a theme

1. Open **Appearance** (top-right menu → *Modifier le thème*).
2. Choose a starting theme and click **Exporter** → a `theme-<id>.json` is
   downloaded.
3. Edit the JSON (new `id`, `name`, colors and optional `css`) in any editor.
4. In **Appearance → Gestion des thèmes**, click **Importer** and select the
   file. The theme appears under *Custom themes* in the theme selector.
5. Select it and close the window. It is applied immediately and survives
   container restarts (stored in `/app/data/themes/`).

To remove a custom theme: select it, then **Gestion des thèmes → Supprimer**
(native themes cannot be deleted).

## Icons

There are two icon systems in Dashmon:

### Font Awesome icons (categories, hosts, web links)

Categories, hosts and web links use Font Awesome 6 (Free) classes, stored
directly in their `icon` field (e.g. `fa-solid fa-folder`,
`fa-brands fa-github`).

In the editor, click the icon of the item to open the picker and choose one.

### Images (services)

A service card renders an image, not a font icon: its `icon` is a path or URL.

- Imported PNG from your library → `icons/<filename>` (relative, served by the
  app), or
- any direct image URL.

**Importing a PNG:**

1. **Edit Dashmon → Images** tab, then *Ajouter des images* — or click the
   image button on a service row while editing it.
2. Pick a `.png` file (PNG only). It is uploaded to `/app/data/icons/` and
   referenced as `icons/<filename>`.
3. The service uses it right away.

**Deleting images:** **Edit Dashmon → Images** tab, select the ones to remove,
then *Supprimer la sélection*.

### Example

From the built-in sample configuration:

```json
{ "name": "Portainer", "url": "https://portainer.local", "icon": "icons/portainer.png", "monitor": true }
```

The `icons/portainer.png` PNG was imported through the **Images** tab.