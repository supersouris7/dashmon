# Graph Report - dashmon  (2026-11-04)

## Corpus Check
- 228 files · ~128,779 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 7, .css 6, .example 2)

## Summary
- 2202 nodes · 4299 edges · 118 communities (98 shown, 20 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 248 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0a0c29f3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supervision.js
- app.js
- core.js
- en
- en
- en
- en
- en
- en
- en
- youtube/manifest.json
- en
- dockerhub/manifest.json
- auth.test.js
- createLocalMetrics
- _template/manifest.json
- widget-registry.js
- sanitizeText
- gotify/manifest.json
- with
- environment
- app.js
- createAuth
- registry.js
- web/manifest.json
- WidgetCore
- secrets.test.js
- icons-routes.test.js
- browser.test.js
- HTTPS with nginx
- Themes
- en
- fr
- render.js
- agent.test.js
- Dashmon widgets
- dashmon-agent
- server.js
- Dashmon
- lib/themes.js
- frontend.test.js
- widgets.test.js
- settings.test.js
- Dashmon — Docker deployment
- t
- fortune.js
- github/manifest.json
- opencode-report.test.js
- AGENTS.md
- lichess/server.js
- youtube/server.js
- docker.js
- duplicati/server.js
- qbittorrent/server.js
- replication-config.test.js
- screenshots.js
- security-headers.test.js
- lichess/client.mjs
- dashmon
- WireGuard in Dashmon
- uptimekuma/client.mjs
- apt-updates.sh
- wireguard-dump.sh
- login.js
- dockerhub/server.js
- github/server.js
- metube/server.js
- github/client.mjs
- description
- label
- gotify/server.js
- metube/client.mjs
- ping/client.mjs
- qbittorrent/client.mjs
- web/server.js
- smart-dump.sh
- Install Dashmon and its agents
- editor.js
- APT updates
- SMART supervision
- ref_path
- usage-report.js
- js/themes.js
- state.js
- pairing-list.js
- Dashmon architecture
- host/metrics.js
- services.js
- smart-report.js
- ref_fs
- ref_crypto
- hosts.js
- verifyRequestOrigin
- .prettierrc.json
- apt.test.js
- monitor.js
- updates
- ref_assert
- claude-stats.test.js
- OpenCode statistics
- opencode-stats.sh
- Claude Code statistics
- import-cycles.test.js
- claude-stats.sh
- confirm-dialog.test.js
- createConfirmDialog
- main

## God Nodes (most connected - your core abstractions)
1. `t()` - 113 edges
2. `WidgetCore` - 35 edges
3. `main()` - 33 edges
4. `state` - 30 edges
5. `render()` - 28 edges
6. `applyEditorChanges()` - 27 edges
7. `sanitizeText()` - 26 edges
8. `normalizeConfig()` - 23 edges
9. `renderServiceEditor()` - 21 edges
10. `saveViewPrefs()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Variable reference` --references--> `text()`  [INFERRED]
  CUSTOMIZATION.md → lib/themes.js
- `manifest.json` --references--> `text()`  [INFERRED]
  docs/EXTENDING.md → lib/themes.js
- `client.mjs` --references--> `formatDateTime()`  [INFERRED]
  docs/EXTENDING.md → public/js/format.js
- `client.mjs` --references--> `formatNumber()`  [INFERRED]
  docs/EXTENDING.md → public/js/format.js
- `client.mjs` --references--> `formatCompactNumber()`  [INFERRED]
  docs/EXTENDING.md → public/js/format.js

## Import Cycles
- None detected.

## Communities (118 total, 20 thin omitted)

### Community 0 - "supervision.js"
Cohesion: 0.07
Nodes (87): renderLive(), activeDashboardId(), applyPage(), button(), closeMobilePageMenu(), mobileMenuItem(), renderPageSwitch(), selectDashboard() (+79 more)

### Community 1 - "app.js"
Cohesion: 0.05
Nodes (61): cancelBtn, closeBtn, closeImageLibraryBtn, configImportInput, demoConfigBtn, editorCategoryFilter, editorSearch, editorTabImages (+53 more)

### Community 2 - "core.js"
Cohesion: 0.13
Nodes (13): crypto, maskSecret(), secretFingerprint(), extraRoot(), fs, path, fs, path (+5 more)

### Community 3 - "en"
Cohesion: 0.04
Nodes (46): cacheKey, client, config, description, en, fr, days, error (+38 more)

### Community 4 - "en"
Cohesion: 0.05
Nodes (43): cacheKey, client, config, css, description, en, fr, error (+35 more)

### Community 5 - "en"
Cohesion: 0.05
Nodes (40): cacheKey, client, config, description, en, fr, disconnected, download (+32 more)

### Community 6 - "en"
Cohesion: 0.05
Nodes (39): cacheKey, client, config, description, en, fr, blockedAddress, error (+31 more)

### Community 7 - "en"
Cohesion: 0.05
Nodes (38): cacheKey, client, config, description, en, fr, blocked, error (+30 more)

### Community 8 - "en"
Cohesion: 0.05
Nodes (38): cacheKey, client, config, description, en, fr, badgeNok, badgeOk (+30 more)

### Community 9 - "en"
Cohesion: 0.05
Nodes (38): cacheKey, client, config, description, en, fr, badSlug, missingConfig (+30 more)

### Community 10 - "youtube/manifest.json"
Cohesion: 0.05
Nodes (37): cacheKey, config, description, en, fr, consent, error, missingChannel (+29 more)

### Community 11 - "en"
Cohesion: 0.05
Nodes (36): cacheKey, client, config, description, en, fr, activeMany, activeOne (+28 more)

### Community 12 - "dockerhub/manifest.json"
Cohesion: 0.06
Nodes (35): cacheKey, config, description, en, fr, error, missingRepo, name (+27 more)

### Community 13 - "auth.test.js"
Cohesion: 0.11
Nodes (12): createAuthFailures(), crypto, fs, SessionStore, assert, dir, file, fs (+4 more)

### Community 14 - "createLocalMetrics"
Cohesion: 0.14
Nodes (13): clampPercent(), createLocalMetrics(), localCpuPercent(), localDiskPercent(), localRamPercent(), readCpuTimes(), fs, os (+5 more)

### Community 15 - "_template/manifest.json"
Cohesion: 0.06
Nodes (34): cacheKey, client, config, description, en, fr, apiToken, apiTokenConfigured (+26 more)

### Community 16 - "widget-registry.js"
Cohesion: 0.08
Nodes (45): Add a widget to Dashmon, client.mjs, If the plugin is missing or broken, Installing a third-party widget, Keeping a value over time, manifest.json, Security rules, server.js (+37 more)

### Community 17 - "sanitizeText"
Cohesion: 0.13
Nodes (28): HOST_MONITORING_TYPES, sanitizeFortune(), sanitizeHostMonitoring(), sanitizeLinkCounter(), WEB_LINK_COUNTER_TYPES, createConfigNormalizer(), crypto, sanitizeCollapsed() (+20 more)

### Community 18 - "gotify/manifest.json"
Cohesion: 0.06
Nodes (32): cacheKey, client, config, description, en, fr, empty, error (+24 more)

### Community 19 - "with"
Cohesion: 0.06
Nodes (37): if, needs, runs-on, steps, ACTIONLINT_SHA256, ACTIONLINT_VERSION, CHROMIUM_BIN, jobs (+29 more)

### Community 20 - "environment"
Cohesion: 0.06
Nodes (31): cap_drop, container_name, dns, environment, image, ports, read_only, restart (+23 more)

### Community 21 - "app.js"
Cohesion: 0.07
Nodes (39): closeTopMenu(), gridSelects, headerObserver, init(), openSettings(), PHONE, positionTopMenu(), searchBox (+31 more)

### Community 22 - "createAuth"
Cohesion: 0.16
Nodes (17): createAuth(), closeSession(), cookieValue(), openSession(), parseCookie(), setCookie(), sign(), validBasicAuth() (+9 more)

### Community 23 - "registry.js"
Cohesion: 0.21
Nodes (13): asLocalized(), FIELD_TYPES, fs, isPlainObject(), path, { pathToFileURL }, validateField(), validateManifest() (+5 more)

### Community 24 - "web/manifest.json"
Cohesion: 0.08
Nodes (23): cacheKey, defaultFor, description, en, fr, badProtocol, invalidUrl, name (+15 more)

### Community 25 - "WidgetCore"
Cohesion: 0.20
Nodes (6): createSecretCodec(), decryptSecret(), isEncryptedSecret(), isMaskedSecret(), WidgetCore, main()

### Community 26 - "secrets.test.js"
Cohesion: 0.29
Nodes (6): assert, codec, crypto, encrypted, unconfigured, value

### Community 27 - "icons-routes.test.js"
Cohesion: 0.05
Nodes (43): unused, availableFileName(), decodeFileName(), express, fs, path, PNG_SIGNATURE, pngSize() (+35 more)

### Community 28 - "browser.test.js"
Cohesion: 0.14
Nodes (17): assert, children, crypto, dir, freePort(), fs, loopback, main() (+9 more)

### Community 29 - "HTTPS with nginx"
Cohesion: 0.17
Nodes (12): 1. Prepare Dashmon, 2. Install nginx and certbot, 3. Configure the HTTP proxy, 4. Add the certificate, 5. Check, Before you start, HTTPS with nginx, Local name: internal certificate (+4 more)

### Community 30 - "Themes"
Cohesion: 0.17
Nodes (11): Creating a theme, Dashmon — Customization guide, Example, File format, Font Awesome icons (categories, hosts, web links), Fortune Cookie, Icons, Images (services) (+3 more)

### Community 31 - "en"
Cohesion: 0.11
Nodes (19): error, metric, metricForks, metricForksShort, metricIssues, metricIssuesShort, metricStars, metricStarsShort (+11 more)

### Community 32 - "fr"
Cohesion: 0.11
Nodes (19): error, metric, metricForks, metricForksShort, metricIssues, metricIssuesShort, metricStars, metricStarsShort (+11 more)

### Community 33 - "render.js"
Cohesion: 0.06
Nodes (80): RFC-5737, bumpUsage(), demoData(), LABELS, withDemo(), compactCount(), DEFAULT_CATEGORIES, DEFAULT_DASHBOARDS (+72 more)

### Community 34 - "agent.test.js"
Cohesion: 0.10
Nodes (19): CAPABILITIES, PROTOCOL, assert, children, crypto, dir, freePort(), fs (+11 more)

### Community 35 - "Dashmon widgets"
Cohesion: 0.13
Nodes (15): Adding your own, AdGuard Home, Dashmon widgets, Docker, Duplicati, Gotify, How failures are displayed, Lichess (+7 more)

### Community 36 - "dashmon-agent"
Cohesion: 0.13
Nodes (14): cap_drop, environment, image, ports, read_only, restart, security_opt, volumes (+6 more)

### Community 37 - "server.js"
Cohesion: 0.09
Nodes (23): AGENT_API_PATHS, agentApiFilter(), errorHandler(), notFound(), requestLog(), startServer(), log, registerAgentRoutes() (+15 more)

### Community 38 - "Dashmon"
Cohesion: 0.13
Nodes (15): Dashmon, Docker Compose, Docker (recommended), Documentation, First steps, From source, Icons, License (+7 more)

### Community 39 - "lib/themes.js"
Cohesion: 0.16
Nodes (22): fs, registerThemeRoutes(), fs, listThemeIds(), normalizeTheme(), OPTIONAL_VARIABLES, path, readTheme() (+14 more)

### Community 40 - "frontend.test.js"
Cohesion: 0.18
Nodes (17): assert, check(), contains(), editorSource(), fs, importStateModules(), JS_DIR, main() (+9 more)

### Community 41 - "widgets.test.js"
Cohesion: 0.17
Nodes (12): assert, check(), fs, ok(), os, path, { pathToFileURL }, pick() (+4 more)

### Community 42 - "settings.test.js"
Cohesion: 0.12
Nodes (20): fs, hostMetricsInterval(), path, readSettings(), appIsMounted(), describeVersion(), fs, isMountedPath() (+12 more)

### Community 43 - "Dashmon — Docker deployment"
Cohesion: 0.07
Nodes (35): 1. Run, 2. Environment variables, 3. Data, 4. Portainer stacks, 5. nginx (optional), 6. Verification, 7. Monitoring LAN domains (.lan, .local…), 8. Private CA certificates (+27 more)

### Community 44 - "t"
Cohesion: 0.26
Nodes (20): createAgentSettings(), renderForm(), request(), field(), generalSection(), help(), hint(), input() (+12 more)

### Community 45 - "fortune.js"
Cohesion: 0.16
Nodes (22): scheduleMidnight(), fortuneBar, fortuneCloseBtn, fortuneText, asKey(), closeFortune(), currentFortuneIndex(), fortuneClosedToday() (+14 more)

### Community 46 - "github/manifest.json"
Cohesion: 0.20
Nodes (9): cacheKey, config, hidden, id, interval, probe, server, strings (+1 more)

### Community 47 - "opencode-report.test.js"
Cohesion: 0.18
Nodes (10): assert, bin, dir, fs, os, path, period, read() (+2 more)

### Community 48 - "AGENTS.md"
Cohesion: 0.15
Nodes (11): Analyse de sécurité avec Semgrep, Avant chaque push, Chaine de livraison, Contraintes, graphify, Portee de la documentation, Regle principale : aucune donnee personnelle, Suite de commit (+3 more)

### Community 49 - "lichess/server.js"
Cohesion: 0.47
Nodes (7): check(), dayKey(), monthProgress(), readStore(), recordFor(), recordSnapshot(), startOfDay()

### Community 50 - "youtube/server.js"
Cohesion: 0.50
Nodes (7): channelPath(), normalizeInput(), parseNumber(), parseSubscribers(), check(), fetchChannel(), isChallenge()

### Community 51 - "docker.js"
Cohesion: 0.06
Nodes (49): apiRequest(), blockedAddressError(), dns, getMaxBody(), getTimeout(), http, httpProbe(), https (+41 more)

### Community 52 - "duplicati/server.js"
Cohesion: 0.39
Nodes (5): check(), computeStatus(), listBackups(), login(), parseDate()

### Community 53 - "qbittorrent/server.js"
Cohesion: 0.39
Nodes (5): check(), cookieOf(), login(), numberOf(), transferInfo()

### Community 54 - "replication-config.test.js"
Cohesion: 0.24
Nodes (7): createReplicationConfig(), sanitizeReplication(), associated(), sanitizeSyncUrl(), assert, result, { sanitizeReplication, sanitizeSyncUrl }

### Community 56 - "screenshots.js"
Cohesion: 0.10
Nodes (37): CLAUDE_MODELS, compose(), crypto, dataUrl(), downloadIcons(), fakeHostMetrics(), fakeStatus(), freePort() (+29 more)

### Community 57 - "security-headers.test.js"
Cohesion: 0.28
Nodes (4): createRateLimiter(), createRequestLimits(), assert, limiter

### Community 58 - "lichess/client.mjs"
Cohesion: 0.53
Nodes (5): render(), signed(), trendClass(), VARIANT_LABELS, variantLabel()

### Community 59 - "dashmon"
Cohesion: 0.40
Nodes (4): build, image, services, dashmon

### Community 60 - "WireGuard in Dashmon"
Cohesion: 0.22
Nodes (9): 1. Install the script, 2. Choose where Dashmon reads it, 3. Schedule it with cron, 4. Security, Friendly names, Parameters, Troubleshooting, What the script writes (+1 more)

### Community 61 - "uptimekuma/client.mjs"
Cohesion: 0.70
Nodes (4): countText(), element(), isSmallIcons(), pageColor()

### Community 62 - "apt-updates.sh"
Cohesion: 0.50
Nodes (3): DEBIAN_FRONTEND, LC_ALL, apt-updates.sh script

### Community 63 - "wireguard-dump.sh"
Cohesion: 0.83
Nodes (3): dump_filtered(), names_local(), wireguard-dump.sh script

### Community 64 - "login.js"
Cohesion: 0.50
Nodes (3): error, form, password

### Community 65 - "dockerhub/server.js"
Cohesion: 0.83
Nodes (3): check(), isValidRepo(), repoPath()

### Community 66 - "github/server.js"
Cohesion: 0.67
Nodes (3): check(), isValidRepo(), METRICS

### Community 67 - "metube/server.js"
Cohesion: 0.83
Nodes (3): check(), entries(), summarize()

### Community 69 - "description"
Cohesion: 0.67
Nodes (3): description, en, fr

### Community 70 - "label"
Cohesion: 0.67
Nodes (3): label, en, fr

### Community 87 - "Install Dashmon and its agents"
Cohesion: 0.22
Nodes (9): 1. Prepare the secrets, 2. Install the primary, 3. Install an agent, 4. Add WireGuard, SMART, APT or usage statistics, 5. Upgrade and back up, Choose your installation, Install Dashmon and its agents, Quick troubleshooting (+1 more)

### Community 88 - "editor.js"
Cohesion: 0.12
Nodes (36): configConflict, configSaveChain, fetchConfig(), pendingConfigPatch, saveConfig(), setConfigRevision(), loadConfig(), loadDemo() (+28 more)

### Community 89 - "APT updates"
Cohesion: 0.40
Nodes (5): APT updates, Bind mount variant, Dashmon supervision, Installation, Schedule and reboot

### Community 90 - "SMART supervision"
Cohesion: 0.40
Nodes (5): Dashmon configuration, Installation, Scheduling, Security, SMART supervision

### Community 91 - "ref_path"
Cohesion: 0.08
Nodes (15): assert, path, { pathToFileURL }, assert, path, { pathToFileURL }, assert, path (+7 more)

### Community 92 - "usage-report.js"
Cohesion: 0.44
Nodes (10): activity(), count(), fs, models(), money(), normalizeUsagePeriod(), PERIODS, readUsageReport() (+2 more)

### Community 93 - "js/themes.js"
Cohesion: 0.18
Nodes (22): patchConfig(), themeSelect, allThemes(), applyTheme(), applyThemeLabels(), buildThemeSelect(), currentTheme(), deleteCustomTheme() (+14 more)

### Community 94 - "state.js"
Cohesion: 0.22
Nodes (13): DEFAULT_TAB_ICON, ICON_OPTIONS, searchInput, buildPicker(), createDashboardIconPicker(), createIconPicker(), createTabIconPicker(), positionPicker() (+5 more)

### Community 95 - "pairing-list.js"
Cohesion: 0.30
Nodes (12): agentHostSelect(), agentUrlInput(), button(), createPairingList(), render(), row(), setStatus(), TEST_FAILURES (+4 more)

### Community 96 - "Dashmon architecture"
Cohesion: 0.40
Nodes (5): Browser, Checks, Dashmon architecture, Overview, Server

### Community 97 - "host/metrics.js"
Cohesion: 0.12
Nodes (21): fs, nonnegativeInteger(), readAptUpdatesReport(), createHostMetrics(), collect(), handle(), hostReport(), filteredReports() (+13 more)

### Community 98 - "services.js"
Cohesion: 0.19
Nodes (23): addServiceBtn, serviceEditor, setIconButton(), categorySelect(), deleteButton(), getEditorHostNames(), hostSelect(), iconElement() (+15 more)

### Community 99 - "smart-report.js"
Cohesion: 0.36
Nodes (8): fs, normalizeSmartDisk(), readSmartDump(), smartAttribute(), smartNumber(), assert, disk, filesystem

### Community 100 - "ref_fs"
Cohesion: 0.11
Nodes (22): crypto, DEFAULT_WEB_LINKS, ensureAgentLocalHost(), ensureHostIds(), fs, path, prepareDataDir(), runStartupMigrations() (+14 more)

### Community 104 - "ref_crypto"
Cohesion: 0.14
Nodes (7): crypto, fs, loadAgentIdentity(), path, ConfigStore, crypto, fs

### Community 106 - "hosts.js"
Cohesion: 0.14
Nodes (26): addCategoryBtn, addDashboardBtn, addHostBtn, addWebLinkBtn, categoryEditor, dashboardEditor, editorHostFilter, hostEditor (+18 more)

### Community 107 - "verifyRequestOrigin"
Cohesion: 0.39
Nodes (6): defaultPort(), sameOrigin(), STATE_CHANGING, verifyRequestOrigin(), assert, check()

### Community 108 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): arrowParens, printWidth, trailingComma

### Community 110 - "apt.test.js"
Cohesion: 0.14
Nodes (10): assert, bin, dir, fs, os, path, { spawnSync }, path (+2 more)

### Community 111 - "monitor.js"
Cohesion: 0.39
Nodes (7): createStatusMonitor(), checkService(), isDue(), runCycle(), linkCounterService(), linkCounterServices(), createScheduler()

### Community 112 - "updates"
Cohesion: 0.17
Nodes (11): default-days, dependency-type, dev-tools, interval, updates, cooldown, directory, groups (+3 more)

### Community 113 - "ref_assert"
Cohesion: 0.13
Nodes (12): CONTENT_SECURITY_POLICY, securityHeaders(), registerConfigRoutes(), usageKey(), assert, config, normalize, assert (+4 more)

### Community 114 - "claude-stats.test.js"
Cohesion: 0.17
Nodes (10): assert, dir, fs, now, old, os, path, projects (+2 more)

### Community 117 - "OpenCode statistics"
Cohesion: 0.40
Nodes (5): Bind mount variant, Enable or hide the card, Installation, OpenCode statistics, Schedule

### Community 119 - "Claude Code statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Claude Code statistics, Enable or hide the card, Installation, Schedule, What is counted

### Community 121 - "import-cycles.test.js"
Cohesion: 0.22
Nodes (9): assert, findCycle(), visit(), fs, listFiles(), path, PATTERNS, resolve() (+1 more)

### Community 123 - "confirm-dialog.test.js"
Cohesion: 0.40
Nodes (5): assert, element(), main(), path, { pathToFileURL }

### Community 128 - "createConfirmDialog"
Cohesion: 0.50
Nodes (3): createConfirmDialog(), cancel(), open()

### Community 129 - "main"
Cohesion: 0.17
Nodes (3): localize(), Registry, main()

## Knowledge Gaps
- **3 isolated node(s):** `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1029 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Add a widget to Dashmon` connect `widget-registry.js` to `README.md`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `main()` (e.g. with `.cacheKey()` and `.check()`) actually correct?**
  _`main()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supervision.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06565656565656566 - nodes in this community are weakly interconnected._
- **Why does `text()` connect `lib/themes.js` to `widget-registry.js`, `Themes`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.051923076923076926 - nodes in this community are weakly interconnected._
- **Should `core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12648221343873517 - nodes in this community are weakly interconnected._