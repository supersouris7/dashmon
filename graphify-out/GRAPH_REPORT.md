# Graph Report - dashmon  (2026-11-04)

## Corpus Check
- 233 files · ~131,698 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 7, .css 6, .example 2)

## Summary
- 2250 nodes · 4393 edges · 132 communities (109 shown, 23 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 250 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `255bc289`
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
- SessionStore
- createLocalMetrics
- _template/manifest.json
- js/config/normalize.js
- sanitizeText
- gotify/manifest.json
- with
- environment
- app.js
- ref_crypto
- registry.js
- web/manifest.json
- WidgetCore
- secrets.test.js
- package.json
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
- icons.js
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
- fortune-bar.js
- js/themes.js
- usage-card.js
- pairing-list.js
- Dashmon architecture
- host/metrics.js
- supervision/cards.js
- smart-report.js
- ref_fs
- supervision/format.js
- system.js
- wireguard-report.js
- store.js
- auth.test.js
- services.js
- verifyRequestOrigin
- .prettierrc.json
- Storage
- dockerfile.test.js
- monitor.js
- updates
- registerConfigRoutes
- claude-stats.test.js
- js/metrics.js
- config-parity.test.js
- OpenCode statistics
- opencode-stats.sh
- Claude Code statistics
- Add a widget to Dashmon
- import-cycles.test.js
- claude-stats.sh
- createAuth
- images.js
- api.js
- security-headers.test.js
- identity.js
- dashboard/cards.js
- Registry
- dashboard/web-links.js

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
10. `renderSupervision()` - 20 edges

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

## Communities (132 total, 23 thin omitted)

### Community 0 - "supervision.js"
Cohesion: 0.11
Nodes (34): DEFAULT_TAB_ICON, supervisionList, renderLive(), activeDashboardId(), applyPage(), button(), closeMobilePageMenu(), mobileMenuItem() (+26 more)

### Community 1 - "dom.js"
Cohesion: 0.07
Nodes (40): cancelBtn, collapseAllBtn, deleteThemeBtn, editorCategoryFilter, editorTabImages, editorTitle, exportThemeBtn, fortuneBar (+32 more)

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

### Community 13 - "SessionStore"
Cohesion: 0.27
Nodes (3): crypto, fs, SessionStore

### Community 14 - "createLocalMetrics"
Cohesion: 0.15
Nodes (13): clampPercent(), createLocalMetrics(), localCpuPercent(), localDiskPercent(), localRamPercent(), readCpuTimes(), fs, os (+5 more)

### Community 15 - "_template/manifest.json"
Cohesion: 0.06
Nodes (34): cacheKey, client, config, description, en, fr, apiToken, apiTokenConfigured (+26 more)

### Community 16 - "js/config/normalize.js"
Cohesion: 0.14
Nodes (31): DEFAULT_CATEGORIES, DEFAULT_DASHBOARDS, HOST_MONITORING_TYPES, normalizeAptUpdatesPrefs(), normalizeCollapsed(), normalizeConfig(), normalizeDashboards(), normalizeExpandedKeys() (+23 more)

### Community 17 - "sanitizeText"
Cohesion: 0.19
Nodes (19): HOST_MONITORING_TYPES, sanitizeFortune(), sanitizeHostMonitoring(), sanitizeLinkCounter(), WEB_LINK_COUNTER_TYPES, createConfigNormalizer(), crypto, sanitizeCollapsed() (+11 more)

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
Cohesion: 0.10
Nodes (37): closeTopMenu(), gridSelects, headerObserver, loadConfig(), openSettings(), PHONE, positionTopMenu(), searchBox (+29 more)

### Community 22 - "ref_crypto"
Cohesion: 0.22
Nodes (11): validBasicAuth(), crypto, crypto, digest(), KEY, safeEqual(), createSyncTokenCheck(), registerSessionRoutes() (+3 more)

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
Nodes (22): unused, devDependencies, eslint@10.13.0, @eslint/js@10.0.1, globals@17.13.0, prettier@3.9.10, name, overrides (+14 more)

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
Cohesion: 0.16
Nodes (31): tileColorFor(), groupLabel(), searchQuery(), createSection(), getDashboardSections(), prefersReducedMotion(), reorderDashboardSections(), sectionHomeRank() (+23 more)

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
Nodes (20): errorHandler(), notFound(), requestLog(), startServer(), log, registerAgentRoutes(), registerHostMetricsRoutes(), express (+12 more)

### Community 38 - "Dashmon"
Cohesion: 0.13
Nodes (15): Dashmon, Docker Compose, Docker (recommended), Documentation, First steps, From source, Icons, License (+7 more)

### Community 39 - "lib/themes.js"
Cohesion: 0.15
Nodes (23): fs, registerThemeRoutes(), fs, listThemeIds(), normalizeTheme(), OPTIONAL_VARIABLES, path, readTheme() (+15 more)

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
Nodes (35): 1. Run, 2. Environment variables, 3. Data, 4. Portainer stacks, 5. nginx (optional), 6. Verification, 7. Monitoring LAN domains (.lan, .local…), 8. Private CA certificates (+27 more)

### Community 44 - "t"
Cohesion: 0.26
Nodes (17): createAgentSettings(), renderForm(), request(), field(), generalSection(), help(), hint(), input() (+9 more)

### Community 45 - "icons.js"
Cohesion: 0.11
Nodes (24): availableFileName(), decodeFileName(), express, fs, path, PNG_SIGNATURE, pngSize(), registerIconRoutes() (+16 more)

### Community 46 - "github/manifest.json"
Cohesion: 0.20
Nodes (9): cacheKey, config, hidden, id, interval, probe, server, strings (+1 more)

### Community 47 - "opencode-report.test.js"
Cohesion: 0.16
Nodes (20): activity(), count(), fs, models(), money(), normalizeUsagePeriod(), PERIODS, readUsageReport() (+12 more)

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
Cohesion: 0.16
Nodes (7): createRateLimiter(), createRequestLimits(), assert, config, normalize, assert, limiter

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
Cohesion: 0.29
Nodes (5): button, error, form, password, TEXT

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
Cohesion: 0.10
Nodes (32): resolveLanguage(), closeBtn, configImportInput, demoConfigBtn, editorHostFilter, editorSearch, exportConfigBtn, importConfigBtn (+24 more)

### Community 89 - "APT updates"
Cohesion: 0.40
Nodes (5): APT updates, Bind mount variant, Dashmon supervision, Installation, Schedule and reboot

### Community 90 - "SMART supervision"
Cohesion: 0.40
Nodes (5): Dashmon configuration, Installation, Scheduling, Security, SMART supervision

### Community 91 - "ref_path"
Cohesion: 0.07
Nodes (20): assert, path, { pathToFileURL }, assert, element(), main(), path, { pathToFileURL } (+12 more)

### Community 92 - "fortune-bar.js"
Cohesion: 0.19
Nodes (21): scheduleMidnight(), showFortuneAgain(), updateFortuneBar(), asKey(), closeFortune(), currentFortuneIndex(), fortuneClosedToday(), fortuneKey() (+13 more)

### Community 93 - "js/themes.js"
Cohesion: 0.19
Nodes (21): patchConfig(), allThemes(), applyTheme(), applyThemeLabels(), buildThemeSelect(), currentTheme(), deleteCustomTheme(), downloadTheme() (+13 more)

### Community 94 - "usage-card.js"
Cohesion: 0.26
Nodes (22): smartNumberText(), activityChart(), activityDetails(), costText(), dailyActivity(), element(), figures(), locale() (+14 more)

### Community 95 - "pairing-list.js"
Cohesion: 0.30
Nodes (14): agentHostSelect(), agentUrlInput(), button(), createPairingList(), render(), row(), setStatus(), TEST_FAILURES (+6 more)

### Community 96 - "Dashmon architecture"
Cohesion: 0.40
Nodes (5): Browser, Checks, Dashmon architecture, Overview, Server

### Community 97 - "host/metrics.js"
Cohesion: 0.20
Nodes (12): fs, nonnegativeInteger(), readAptUpdatesReport(), createHostMetrics(), collect(), handle(), hostReport(), filteredReports() (+4 more)

### Community 98 - "supervision/cards.js"
Cohesion: 0.26
Nodes (16): aptUpdatesCard(), aptHealth(), applyHostColor(), cardKey(), EXPANDABLE_CARDS, isExpanded(), setAllSmartDetails(), setExpanded() (+8 more)

### Community 99 - "smart-report.js"
Cohesion: 0.36
Nodes (8): fs, normalizeSmartDisk(), readSmartDump(), smartAttribute(), smartNumber(), assert, disk, filesystem

### Community 100 - "ref_fs"
Cohesion: 0.11
Nodes (22): crypto, DEFAULT_WEB_LINKS, ensureAgentLocalHost(), ensureHostIds(), fs, path, prepareDataDir(), runStartupMigrations() (+14 more)

### Community 101 - "supervision/format.js"
Cohesion: 0.29
Nodes (17): bytesText(), handshakeAge(), handshakeText(), isMissing(), metricSeverity(), percentText(), relativeAge(), temperatureSeverity() (+9 more)

### Community 102 - "system.js"
Cohesion: 0.27
Nodes (9): fs, path, appIsMounted(), describeVersion(), fs, isMountedPath(), readMountPoints(), releaseLabel() (+1 more)

### Community 103 - "wireguard-report.js"
Cohesion: 0.29
Nodes (9): byteCount(), fs, handshakeSeconds(), normalizePeer(), normalizeWireguard(), readWireguardDump(), assert, filesystem (+1 more)

### Community 104 - "store.js"
Cohesion: 0.12
Nodes (16): ConfigStore, crypto, fs, parseConfig(), path, readValid(), syncFolder(), writeDurably() (+8 more)

### Community 105 - "auth.test.js"
Cohesion: 0.18
Nodes (9): createAuthFailures(), assert, dir, file, fs, login(), os, path (+1 more)

### Community 106 - "services.js"
Cohesion: 0.05
Nodes (84): ICON_OPTIONS, LINK_COUNTER_TYPES, TILE_COLORS, addCategoryBtn, addDashboardBtn, addHostBtn, addServiceBtn, addWebLinkBtn (+76 more)

### Community 107 - "verifyRequestOrigin"
Cohesion: 0.39
Nodes (6): defaultPort(), sameOrigin(), STATE_CHANGING, verifyRequestOrigin(), assert, check()

### Community 108 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): arrowParens, printWidth, trailingComma

### Community 109 - "Storage"
Cohesion: 0.24
Nodes (4): extraRoot(), fs, path, Storage

### Community 110 - "dockerfile.test.js"
Cohesion: 0.22
Nodes (7): assert, dockerfile, fs, http, path, server, { spawn, spawnSync }

### Community 111 - "monitor.js"
Cohesion: 0.39
Nodes (7): createStatusMonitor(), checkService(), isDue(), runCycle(), linkCounterService(), linkCounterServices(), createScheduler()

### Community 112 - "updates"
Cohesion: 0.17
Nodes (11): default-days, dependency-type, dev-tools, interval, updates, cooldown, directory, groups (+3 more)

### Community 113 - "registerConfigRoutes"
Cohesion: 0.36
Nodes (6): countsOf(), registerConfigRoutes(), flushUsage(), usageKey(), assert, main()

### Community 114 - "claude-stats.test.js"
Cohesion: 0.08
Nodes (20): assert, bin, dir, fs, os, path, { spawnSync }, assert (+12 more)

### Community 115 - "js/metrics.js"
Cohesion: 0.26
Nodes (11): init(), menuRefreshBtn, refreshBar, manualRefresh(), pageHidden(), refreshStatus(), setRefreshPending(), setupVisibilityPause() (+3 more)

### Community 116 - "config-parity.test.js"
Cohesion: 0.24
Nodes (9): assert, check(), FIXTURES, main(), pairing, path, { pathToFileURL }, SAME_KEYS (+1 more)

### Community 117 - "OpenCode statistics"
Cohesion: 0.40
Nodes (5): Bind mount variant, Enable or hide the card, Installation, OpenCode statistics, Schedule

### Community 119 - "Claude Code statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Claude Code statistics, Enable or hide the card, Installation, Schedule, What is counted

### Community 120 - "Add a widget to Dashmon"
Cohesion: 0.18
Nodes (16): Add a widget to Dashmon, client.mjs, If the plugin is missing or broken, Installing a third-party widget, Keeping a value over time, manifest.json, Security rules, server.js (+8 more)

### Community 121 - "import-cycles.test.js"
Cohesion: 0.22
Nodes (9): assert, findCycle(), visit(), fs, listFiles(), path, PATTERNS, resolve() (+1 more)

### Community 123 - "createAuth"
Cohesion: 0.42
Nodes (8): createAuth(), closeSession(), cookieValue(), openSession(), parseCookie(), setCookie(), sign(), validSession()

### Community 124 - "images.js"
Cohesion: 0.14
Nodes (17): closeImageLibraryBtn, imageGrid, imageLibrary, imageManagerGrid, manageDeleteBtn, managePngUpload, manageSelectionCount, manageUploadBtn (+9 more)

### Community 125 - "api.js"
Cohesion: 0.18
Nodes (11): RFC-5737, configConflict, configSaveChain, fetchConfig(), pendingConfigPatch, saveConfig(), setConfigRevision(), loadDemo() (+3 more)

### Community 126 - "security-headers.test.js"
Cohesion: 0.20
Nodes (9): AGENT_API_PATHS, agentApiFilter(), CONTENT_SECURITY_POLICY, securityHeaders(), applySecurity(), warnUntrustedProxy(), assert, headers() (+1 more)

### Community 127 - "identity.js"
Cohesion: 0.40
Nodes (4): crypto, fs, loadAgentIdentity(), path

### Community 128 - "dashboard/cards.js"
Cohesion: 0.35
Nodes (11): bumpUsage(), appendTileIcon(), applyWidgetStatus(), createCard(), statusTitle(), updateStatusIndicators(), serviceUsageKey(), effectiveStatus() (+3 more)

### Community 131 - "dashboard/web-links.js"
Cohesion: 0.27
Nodes (11): compactCount(), linkCounterValue(), sanitizeIconClass(), safeHref(), linkCounterText(), renderWebLinks(), updateWebLinkCounters(), updateWebLinksAppearance() (+3 more)

## Knowledge Gaps
- **3 isolated node(s):** `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1056 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Add a widget to Dashmon` connect `Add a widget to Dashmon` to `README.md`?**
  _High betweenness centrality (0.249) - this node is a cross-community bridge._
- **What connects `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supervision.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1064102564102564 - nodes in this community are weakly interconnected._
- **Why does `text()` connect `lib/themes.js` to `Add a widget to Dashmon`, `Themes`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Should `dom.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06620209059233449 - nodes in this community are weakly interconnected._
- **Should `en` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `en` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._