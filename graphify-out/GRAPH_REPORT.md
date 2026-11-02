# Graph Report - dashmon  (2026-11-02)

## Corpus Check
- 214 files · ~120,823 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 7, .css 6, .example 2)

## Summary
- 2055 nodes · 3955 edges · 121 communities (99 shown, 22 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 247 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cebd408c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supervision.js
- dom.js
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
- services.js
- sanitizeText
- gotify/manifest.json
- with
- environment
- js/themes.js
- createAuth
- registry.js
- web/manifest.json
- WidgetCore
- secrets.test.js
- package.json
- browser.test.js
- HTTPS with nginx
- app.js
- en
- fr
- js/config/normalize.js
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
- ref_assert
- fortune.js
- github/manifest.json
- dashboard/cards.js
- AGENTS.md
- lichess/server.js
- youtube/server.js
- docker.js
- duplicati/server.js
- qbittorrent/server.js
- dashboard/web-links.js
- identity.js
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
- claude-stats.test.js
- APT updates
- SMART supervision
- ref_assert
- opencode-report.test.js
- replication-config.test.js
- editor.js
- client.js
- Dashmon architecture
- host/metrics.js
- docker.test.js
- render.js
- ref_fs
- wireguard-report.js
- system.js
- js/metrics.js
- Registry
- smart-report.js
- state.js
- verifyRequestOrigin
- .prettierrc.json
- t
- apt.test.js
- monitor.js
- icons.js
- registerConfigRoutes
- ping/server.js
- Storage
- createConfirmDialog
- OpenCode statistics
- opencode-stats.sh
- Claude Code statistics
- claude-stats.sh

## God Nodes (most connected - your core abstractions)
1. `t()` - 97 edges
2. `createApp()` - 45 edges
3. `WidgetCore` - 35 edges
4. `main()` - 33 edges
5. `renderServiceEditor()` - 31 edges
6. `state` - 30 edges
7. `render()` - 27 edges
8. `sanitizeText()` - 26 edges
9. `applyEditorChanges()` - 25 edges
10. `usageCard()` - 22 edges

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

## Communities (121 total, 22 thin omitted)

### Community 0 - "supervision.js"
Cohesion: 0.07
Nodes (80): DEFAULT_TAB_ICON, ICON_OPTIONS, mobilePageBtn, mobilePageMenu, pageSwitchGroup, supervisionList, activeDashboardId(), applyPage() (+72 more)

### Community 1 - "dom.js"
Cohesion: 0.05
Nodes (62): addCategoryBtn, addDashboardBtn, addHostBtn, addWebLinkBtn, categoryEditor, closeBtn, closeImageLibraryBtn, collapseAllBtn (+54 more)

### Community 2 - "core.js"
Cohesion: 0.17
Nodes (15): createSecretCodec(), decryptSecret(), crypto, isEncryptedSecret(), isMaskedSecret(), maskSecret(), secretFingerprint(), fs (+7 more)

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
Cohesion: 0.15
Nodes (13): clampPercent(), createLocalMetrics(), localCpuPercent(), localDiskPercent(), localRamPercent(), readCpuTimes(), fs, os (+5 more)

### Community 15 - "_template/manifest.json"
Cohesion: 0.06
Nodes (34): cacheKey, client, config, description, en, fr, apiToken, apiTokenConfigured (+26 more)

### Community 16 - "services.js"
Cohesion: 0.08
Nodes (48): client.mjs, addServiceBtn, editorCategoryFilter, serviceEditor, widgetConfig, widgetConfigBody, widgetConfigCloseBtn, widgetConfigSaveBtn (+40 more)

### Community 17 - "sanitizeText"
Cohesion: 0.19
Nodes (19): HOST_MONITORING_TYPES, sanitizeHostMonitoring(), sanitizeLinkCounter(), sanitizeSpecialTile(), SPECIAL_TILE_TYPES, WEB_LINK_COUNTER_TYPES, createConfigNormalizer(), crypto (+11 more)

### Community 18 - "gotify/manifest.json"
Cohesion: 0.06
Nodes (32): cacheKey, client, config, description, en, fr, empty, error (+24 more)

### Community 19 - "with"
Cohesion: 0.07
Nodes (31): needs, runs-on, steps, jobs, docker, test, name, on (+23 more)

### Community 20 - "environment"
Cohesion: 0.06
Nodes (31): cap_drop, container_name, dns, environment, image, ports, read_only, restart (+23 more)

### Community 21 - "js/themes.js"
Cohesion: 0.13
Nodes (26): configConflict, configSaveChain, fetchConfig(), patchConfig(), pendingConfigPatch, saveConfig(), setConfigRevision(), themeSelect (+18 more)

### Community 22 - "createAuth"
Cohesion: 0.15
Nodes (17): createAuth(), closeSession(), cookieValue(), openSession(), parseCookie(), setCookie(), sign(), validBasicAuth() (+9 more)

### Community 23 - "registry.js"
Cohesion: 0.21
Nodes (13): asLocalized(), FIELD_TYPES, fs, isPlainObject(), path, { pathToFileURL }, validateField(), validateManifest() (+5 more)

### Community 24 - "web/manifest.json"
Cohesion: 0.08
Nodes (23): cacheKey, defaultFor, description, en, fr, badProtocol, invalidUrl, name (+15 more)

### Community 26 - "secrets.test.js"
Cohesion: 0.29
Nodes (6): assert, codec, crypto, encrypted, unconfigured, value

### Community 27 - "package.json"
Cohesion: 0.10
Nodes (19): express, fs, path, registerPageRoutes(), dependencies, express@^5.3.0, devDependencies, prettier@3.9.10 (+11 more)

### Community 28 - "browser.test.js"
Cohesion: 0.14
Nodes (17): assert, children, crypto, dir, freePort(), fs, loopback, main() (+9 more)

### Community 29 - "HTTPS with nginx"
Cohesion: 0.17
Nodes (12): 1. Prepare Dashmon, 2. Install nginx and certbot, 3. Configure the HTTP proxy, 4. Add the certificate, 5. Check, Before you start, HTTPS with nginx, Local name: internal certificate (+4 more)

### Community 30 - "app.js"
Cohesion: 0.09
Nodes (39): closeTopMenu(), gridSelects, headerObserver, loadConfig(), openSettings(), pageSwitch, PHONE, placeSearchBox() (+31 more)

### Community 31 - "en"
Cohesion: 0.11
Nodes (19): error, metric, metricForks, metricForksShort, metricIssues, metricIssuesShort, metricStars, metricStarsShort (+11 more)

### Community 32 - "fr"
Cohesion: 0.11
Nodes (19): error, metric, metricForks, metricForksShort, metricIssues, metricIssuesShort, metricStars, metricStarsShort (+11 more)

### Community 33 - "js/config/normalize.js"
Cohesion: 0.12
Nodes (33): DEFAULT_CATEGORIES, DEFAULT_DASHBOARDS, DEFAULT_HOSTS, DEFAULT_SERVICES, DEFAULT_WEB_LINKS, HOST_MONITORING_TYPES, LINK_COUNTER_TYPES, normalizeAptUpdatesPrefs() (+25 more)

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
Cohesion: 0.11
Nodes (16): AGENT_API_PATHS, agentApiFilter(), errorHandler(), notFound(), requestLog(), startServer(), log, registerAgentRoutes() (+8 more)

### Community 38 - "Dashmon"
Cohesion: 0.14
Nodes (14): Dashmon, Docker Compose, Docker (recommended), Documentation, First steps, From source, Icons, License (+6 more)

### Community 39 - "lib/themes.js"
Cohesion: 0.07
Nodes (39): Creating a theme, Dashmon — Customization guide, Example, File format, Font Awesome icons (categories, hosts, web links), Icons, Images (services), Rules (+31 more)

### Community 40 - "frontend.test.js"
Cohesion: 0.18
Nodes (17): assert, check(), contains(), editorSource(), fs, importStateModules(), JS_DIR, main() (+9 more)

### Community 41 - "widgets.test.js"
Cohesion: 0.17
Nodes (12): assert, check(), fs, ok(), os, path, { pathToFileURL }, pick() (+4 more)

### Community 42 - "settings.test.js"
Cohesion: 0.15
Nodes (14): fs, hostMetricsInterval(), path, readSettings(), assert, crypto, custom, defaults (+6 more)

### Community 43 - "Dashmon — Docker deployment"
Cohesion: 0.07
Nodes (34): 1. Run, 2. Environment variables, 3. Data, 4. nginx (optional), 5. Verification, 6. Monitoring LAN domains (.lan, .local…), 7. Private CA certificates, 8. Host supervision (+26 more)

### Community 44 - "ref_assert"
Cohesion: 0.38
Nodes (5): CONTENT_SECURITY_POLICY, securityHeaders(), assert, headers(), plain

### Community 45 - "fortune.js"
Cohesion: 0.21
Nodes (16): createFortuneCard(), asKey(), currentFortuneIndex(), fortuneKey(), fortuneText(), hashString(), loadFortunes(), messages (+8 more)

### Community 46 - "github/manifest.json"
Cohesion: 0.20
Nodes (9): cacheKey, config, hidden, id, interval, probe, server, strings (+1 more)

### Community 47 - "dashboard/cards.js"
Cohesion: 0.35
Nodes (11): bumpUsage(), appendTileIcon(), applyWidgetStatus(), createCard(), statusTitle(), updateStatusIndicators(), serviceUsageKey(), effectiveStatus() (+3 more)

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
Cohesion: 0.15
Nodes (19): cachedResolved(), classifyDockerContainers(), computeDockerSummary(), computeLiveDockerSummary(), crypto, http, https, isDockerHub() (+11 more)

### Community 52 - "duplicati/server.js"
Cohesion: 0.39
Nodes (5): check(), computeStatus(), listBackups(), login(), parseDate()

### Community 53 - "qbittorrent/server.js"
Cohesion: 0.39
Nodes (5): check(), cookieOf(), login(), numberOf(), transferInfo()

### Community 54 - "dashboard/web-links.js"
Cohesion: 0.42
Nodes (8): compactCount(), linkCounterValue(), sanitizeIconClass(), safeHref(), linkCounterText(), renderWebLinks(), updateWebLinkCounters(), updateWebLinksAppearance()

### Community 56 - "identity.js"
Cohesion: 0.40
Nodes (4): crypto, fs, loadAgentIdentity(), path

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
Nodes (9): 1. Prepare the secrets, 2. Install the primary, 3. Install an agent, 4. Add WireGuard, SMART or APT, 5. Upgrade and back up, Choose your installation, Install Dashmon and its agents, Quick troubleshooting (+1 more)

### Community 88 - "claude-stats.test.js"
Cohesion: 0.17
Nodes (10): assert, dir, fs, now, old, os, path, projects (+2 more)

### Community 89 - "APT updates"
Cohesion: 0.40
Nodes (5): APT updates, Bind mount variant, Dashmon supervision, Installation, Schedule and reboot

### Community 90 - "SMART supervision"
Cohesion: 0.40
Nodes (5): Dashmon configuration, Installation, Scheduling, Security, SMART supervision

### Community 91 - "ref_assert"
Cohesion: 0.06
Nodes (20): assert, path, { pathToFileURL }, assert, element(), main(), path, { pathToFileURL } (+12 more)

### Community 92 - "opencode-report.test.js"
Cohesion: 0.16
Nodes (20): activity(), count(), fs, models(), money(), normalizeUsagePeriod(), PERIODS, readUsageReport() (+12 more)

### Community 93 - "replication-config.test.js"
Cohesion: 0.15
Nodes (10): createReplicationConfig(), sanitizeReplication(), associated(), sanitizeSyncUrl(), assert, config, normalize, assert (+2 more)

### Community 94 - "editor.js"
Cohesion: 0.12
Nodes (25): updateIconsButton(), cancelBtn, configImportInput, editorHostFilter, exportConfigBtn, importConfigBtn, importExportStatus, modalBackdrop (+17 more)

### Community 95 - "client.js"
Cohesion: 0.21
Nodes (12): apiRequest(), blockedAddressError(), dns, getMaxBody(), getTimeout(), http, httpProbe(), https (+4 more)

### Community 96 - "Dashmon architecture"
Cohesion: 0.33
Nodes (5): Browser, Checks, Dashmon architecture, Overview, Server

### Community 97 - "host/metrics.js"
Cohesion: 0.20
Nodes (12): fs, nonnegativeInteger(), readAptUpdatesReport(), createHostMetrics(), collect(), handle(), hostReport(), filteredReports() (+4 more)

### Community 98 - "docker.test.js"
Cohesion: 0.20
Nodes (12): assert, check(), eacces(), http, pending, ref(), dockerErrorBody(), dockerHostMode() (+4 more)

### Community 99 - "render.js"
Cohesion: 0.16
Nodes (33): tileColorFor(), createSection(), getDashboardSections(), prefersReducedMotion(), reorderDashboardSections(), sectionHomeRank(), dashboard, announceSearch() (+25 more)

### Community 100 - "ref_fs"
Cohesion: 0.08
Nodes (25): crypto, DEFAULT_WEB_LINKS, ensureAgentLocalHost(), ensureHostIds(), fs, path, prepareDataDir(), runStartupMigrations() (+17 more)

### Community 101 - "wireguard-report.js"
Cohesion: 0.29
Nodes (9): byteCount(), fs, handshakeSeconds(), normalizePeer(), normalizeWireguard(), readWireguardDump(), assert, filesystem (+1 more)

### Community 102 - "system.js"
Cohesion: 0.29
Nodes (9): fs, path, registerSystemRoutes(), appIsMounted(), describeVersion(), fs, isMountedPath(), readMountPoints() (+1 more)

### Community 103 - "js/metrics.js"
Cohesion: 0.26
Nodes (11): init(), menuRefreshBtn, refreshBar, manualRefresh(), pageHidden(), refreshStatus(), setRefreshPending(), setupVisibilityPause() (+3 more)

### Community 105 - "smart-report.js"
Cohesion: 0.36
Nodes (8): fs, normalizeSmartDisk(), readSmartDump(), smartAttribute(), smartNumber(), assert, disk, filesystem

### Community 106 - "state.js"
Cohesion: 0.18
Nodes (28): activateEditorPanel(), renderCategoryEditor(), closeColorPalette(), createColorPicker(), confirmDelete(), renderDashboardEditor(), makeDraggable(), moveItem() (+20 more)

### Community 107 - "verifyRequestOrigin"
Cohesion: 0.39
Nodes (6): defaultPort(), sameOrigin(), STATE_CHANGING, verifyRequestOrigin(), assert, check()

### Community 108 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): arrowParens, printWidth, trailingComma

### Community 109 - "t"
Cohesion: 0.20
Nodes (20): createAgentSettings(), renderForm(), request(), confirmDanger(), renderHostSettings(), field(), help(), input() (+12 more)

### Community 110 - "apt.test.js"
Cohesion: 0.14
Nodes (10): assert, bin, dir, fs, os, path, { spawnSync }, path (+2 more)

### Community 111 - "monitor.js"
Cohesion: 0.39
Nodes (7): createStatusMonitor(), checkService(), isDue(), runCycle(), linkCounterService(), linkCounterServices(), createScheduler()

### Community 112 - "icons.js"
Cohesion: 0.32
Nodes (7): availableFileName(), express, fs, path, PNG_SIGNATURE, pngSize(), registerIconRoutes()

### Community 113 - "registerConfigRoutes"
Cohesion: 0.43
Nodes (4): registerConfigRoutes(), usageKey(), assert, main()

### Community 114 - "ping/server.js"
Cohesion: 0.31
Nodes (6): check(), dns, net, parseTarget(), resolveTarget(), tcpConnect()

### Community 115 - "Storage"
Cohesion: 0.24
Nodes (4): extraRoot(), fs, path, Storage

### Community 116 - "createConfirmDialog"
Cohesion: 0.50
Nodes (3): createConfirmDialog(), cancel(), open()

### Community 117 - "OpenCode statistics"
Cohesion: 0.40
Nodes (5): Bind mount variant, Enable or hide the card, Installation, OpenCode statistics, Schedule

### Community 119 - "Claude Code statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Claude Code statistics, Enable or hide the card, Installation, Schedule, What is counted

## Knowledge Gaps
- **2 isolated node(s):** `DEBIAN_FRONTEND`, `LC_ALL`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 990 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Add a widget to Dashmon` connect `lib/themes.js` to `services.js`, `README.md`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `createApp()` (e.g. with `server.js` and `agentApiFilter()`) actually correct?**
  _`createApp()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DEBIAN_FRONTEND`, `LC_ALL` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supervision.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0713064713064713 - nodes in this community are weakly interconnected._
- **Why does `client.mjs` connect `services.js` to `lib/themes.js`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `main()` (e.g. with `.cacheKey()` and `.check()`) actually correct?**
  _`main()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Should `dom.js` be split into smaller, more focused modules?**
  _Cohesion score 0.046620046620046623 - nodes in this community are weakly interconnected._