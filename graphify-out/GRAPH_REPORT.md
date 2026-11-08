# Graph Report - dashmon  (2026-11-08)

## Corpus Check
- 257 files · ~152,741 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 7, .css 6, .example 2)

## Summary
- 2534 nodes · 5088 edges · 151 communities (124 shown, 27 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 277 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b10de8b3`
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
- setup.sh
- createLocalMetrics
- _template/manifest.json
- widget-registry.js
- sanitizeText
- gotify/manifest.json
- with
- environment
- js/themes.js
- en
- registry.js
- web/manifest.json
- WidgetCore
- secrets.test.js
- package.json
- import-cycles.test.js
- HTTPS with nginx
- speedtest.js
- en
- fr
- apt.test.js
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
- createSpeedtest
- icons.js
- github/manifest.json
- usage-report.js
- AGENTS.md
- lichess/server.js
- youtube/server.js
- docker.js
- duplicati/server.js
- qbittorrent/server.js
- replication-config.test.js
- screenshots.js
- ref_assert
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
- fortune-bar.js
- APT updates
- SMART supervision
- ref_url
- render.js
- services.js
- opencode-widget.test.js
- pairing-list.js
- Dashmon architecture
- host/metrics.js
- claude-stats.test.js
- browser.test.js
- ref_fs
- app.js
- editor.js
- t
- registerAgentRoutes
- createConfirmDialog
- js/config/normalize.js
- smart-report.js
- .prettierrc.json
- Storage
- dockerfile.test.js
- monitor.js
- updates
- registerConfigRoutes
- opencode/client.mjs
- js/metrics.js
- Speed test
- OpenCode statistics
- opencode-stats.sh
- Claude Code statistics
- js/pages.js
- columns-layout.js
- claude-stats.sh
- store.js
- state
- dashboard/web-links.js
- client.js
- auth.test.js
- dashboard/cards.js
- demo.js
- Host scripts
- directory-sizes.sh
- images.js
- state
- docker.test.js
- wireguard-report.js
- ping/server.js
- Directory sizes
- js/format.js
- createUsageSource
- api.js
- Registry
- confirm-dialog.test.js
- SessionStore
- identity.js
- editor-draft.test.js
- editor-drag.test.js
- host-monitoring-draft.test.js
- replication-draft.test.js
- opencode/server.js

## God Nodes (most connected - your core abstractions)
1. `t()` - 132 edges
2. `WidgetCore` - 35 edges
3. `main()` - 33 edges
4. `state` - 32 edges
5. `sanitizeText()` - 28 edges
6. `applyEditorChanges()` - 27 edges
7. `renderSupervision()` - 24 edges
8. `normalizeConfig()` - 23 edges
9. `install_one()` - 22 edges
10. `renderServiceEditor()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `client.mjs` --references--> `ctx()`  [INFERRED]
  docs/EXTENDING.md → test/opencode-widget.test.js
- `Variable reference` --references--> `text()`  [INFERRED]
  CUSTOMIZATION.md → lib/themes.js
- `manifest.json` --references--> `text()`  [INFERRED]
  docs/EXTENDING.md → lib/themes.js
- `client.mjs` --references--> `formatDateTime()`  [INFERRED]
  docs/EXTENDING.md → public/js/format.js
- `client.mjs` --references--> `formatNumber()`  [INFERRED]
  docs/EXTENDING.md → public/js/format.js

## Import Cycles
- None detected.

## Communities (151 total, 27 thin omitted)

### Community 0 - "supervision.js"
Cohesion: 0.06
Nodes (95): supervisionList, supervisionPage, aptUpdatesCard(), aptHealth(), applyHostColor(), cardKey(), EXPANDABLE_CARDS, isExpanded() (+87 more)

### Community 1 - "dom.js"
Cohesion: 0.05
Nodes (47): addCategoryBtn, addDashboardBtn, addHostBtn, addServiceBtn, addWebLinkBtn, cancelBtn, categoryEditor, closeBtn (+39 more)

### Community 2 - "core.js"
Cohesion: 0.18
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

### Community 13 - "setup.sh"
Cohesion: 0.19
Nodes (33): ask_frequency(), check_tools(), choose_container(), confirm(), cron_drop(), cron_lines(), cron_owner(), cron_read() (+25 more)

### Community 14 - "createLocalMetrics"
Cohesion: 0.15
Nodes (13): clampPercent(), createLocalMetrics(), localCpuPercent(), localDiskPercent(), localRamPercent(), readCpuTimes(), fs, os (+5 more)

### Community 15 - "_template/manifest.json"
Cohesion: 0.06
Nodes (34): cacheKey, client, config, description, en, fr, apiToken, apiTokenConfigured (+26 more)

### Community 16 - "widget-registry.js"
Cohesion: 0.19
Nodes (23): buildWidgetField(), commitWidgetConfig(), hostSelect(), renderWidgetConfig(), widgetConfigIndex, defaultWidgetConfig(), fieldLabel(), fieldPlaceholder() (+15 more)

### Community 17 - "sanitizeText"
Cohesion: 0.10
Nodes (33): HOST_MONITORING_TYPES, sanitizeFortune(), sanitizeHostMonitoring(), sanitizeLinkCounter(), sanitizeSpeedtest(), SPEEDTEST_INTERVALS, WEB_LINK_COUNTER_TYPES, createConfigNormalizer() (+25 more)

### Community 18 - "gotify/manifest.json"
Cohesion: 0.06
Nodes (32): cacheKey, client, config, description, en, fr, empty, error (+24 more)

### Community 19 - "with"
Cohesion: 0.06
Nodes (37): if, needs, runs-on, steps, ACTIONLINT_SHA256, ACTIONLINT_VERSION, CHROMIUM_BIN, jobs (+29 more)

### Community 20 - "environment"
Cohesion: 0.06
Nodes (31): cap_drop, container_name, dns, environment, image, ports, read_only, restart (+23 more)

### Community 21 - "js/themes.js"
Cohesion: 0.17
Nodes (23): patchConfig(), updateThemeManageUI(), themeSelect, allThemes(), applyTheme(), applyThemeLabels(), buildThemeSelect(), currentTheme() (+15 more)

### Community 22 - "en"
Cohesion: 0.04
Nodes (46): cacheKey, client, config, description, en, fr, cost, days30 (+38 more)

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

### Community 28 - "import-cycles.test.js"
Cohesion: 0.22
Nodes (9): assert, findCycle(), visit(), fs, listFiles(), path, PATTERNS, resolve() (+1 more)

### Community 29 - "HTTPS with nginx"
Cohesion: 0.17
Nodes (12): 1. Prepare Dashmon, 2. Install nginx and certbot, 3. Configure the HTTP proxy, 4. Add the certificate, 5. Check, Before you start, HTTPS with nginx, Local name: internal certificate (+4 more)

### Community 30 - "speedtest.js"
Cohesion: 0.11
Nodes (26): agentsFor(), check(), crypto, downloadWorker(), endpoints(), errorCode(), failure(), fs (+18 more)

### Community 31 - "en"
Cohesion: 0.11
Nodes (19): error, metric, metricForks, metricForksShort, metricIssues, metricIssuesShort, metricStars, metricStarsShort (+11 more)

### Community 32 - "fr"
Cohesion: 0.11
Nodes (19): error, metric, metricForks, metricForksShort, metricIssues, metricIssuesShort, metricStars, metricStarsShort (+11 more)

### Community 33 - "apt.test.js"
Cohesion: 0.07
Nodes (26): fs, path, assert, bin, dir, fs, os, path (+18 more)

### Community 34 - "agent.test.js"
Cohesion: 0.10
Nodes (19): CAPABILITIES, PROTOCOL, assert, children, crypto, dir, freePort(), fs (+11 more)

### Community 35 - "Dashmon widgets"
Cohesion: 0.12
Nodes (16): Adding your own, AdGuard Home, Dashmon widgets, Docker, Duplicati, Gotify, How failures are displayed, Lichess (+8 more)

### Community 36 - "dashmon-agent"
Cohesion: 0.13
Nodes (14): cap_drop, environment, image, ports, read_only, restart, security_opt, volumes (+6 more)

### Community 37 - "server.js"
Cohesion: 0.09
Nodes (26): AGENT_API_PATHS, agentApiFilter(), errorHandler(), notFound(), requestLog(), CONTENT_SECURITY_POLICY, securityHeaders(), createSyncTokenCheck() (+18 more)

### Community 38 - "Dashmon"
Cohesion: 0.13
Nodes (15): Dashmon, Docker Compose, Docker (recommended), Documentation, First steps, From source, Icons, License (+7 more)

### Community 39 - "lib/themes.js"
Cohesion: 0.06
Nodes (43): Creating a theme, Dashmon — Customization guide, Example, File format, Font Awesome icons (categories, hosts, web links), Fortune Cookie, Icons, Images (services) (+35 more)

### Community 40 - "frontend.test.js"
Cohesion: 0.16
Nodes (17): assert, check(), contains(), editorSource(), fs, importStateModules(), JS_DIR, main() (+9 more)

### Community 41 - "widgets.test.js"
Cohesion: 0.17
Nodes (12): assert, check(), fs, ok(), os, path, { pathToFileURL }, pick() (+4 more)

### Community 42 - "settings.test.js"
Cohesion: 0.10
Nodes (24): fs, hostMetricsInterval(), path, readSettings(), fs, path, appIsMounted(), describeVersion() (+16 more)

### Community 43 - "Dashmon — Docker deployment"
Cohesion: 0.07
Nodes (35): 1. Run, 2. Environment variables, 3. Data, 4. Portainer stacks, 5. nginx (optional), 6. Verification, 7. Monitoring LAN domains (.lan, .local…), 8. Private CA certificates (+27 more)

### Community 44 - "createSpeedtest"
Cohesion: 0.33
Nodes (10): createSpeedtest(), nextAt(), prefs(), report(), run(), runNow(), start(), store() (+2 more)

### Community 45 - "icons.js"
Cohesion: 0.11
Nodes (21): availableFileName(), decodeFileName(), express, fs, path, PNG_SIGNATURE, pngSize(), registerIconRoutes() (+13 more)

### Community 46 - "github/manifest.json"
Cohesion: 0.20
Nodes (9): cacheKey, config, hidden, id, interval, probe, server, strings (+1 more)

### Community 47 - "usage-report.js"
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
Cohesion: 0.15
Nodes (19): cachedResolved(), classifyDockerContainers(), computeDockerSummary(), computeLiveDockerSummary(), crypto, http, https, isDockerHub() (+11 more)

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
Nodes (38): CLAUDE_MODELS, compose(), crypto, dataUrl(), downloadIcons(), fakeHostMetrics(), fakeSpeedtest(), fakeStatus() (+30 more)

### Community 57 - "ref_assert"
Cohesion: 0.15
Nodes (10): createRateLimiter(), createRequestLimits(), defaultPort(), sameOrigin(), STATE_CHANGING, verifyRequestOrigin(), assert, limiter (+2 more)

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

### Community 88 - "fortune-bar.js"
Cohesion: 0.16
Nodes (24): scheduleMidnight(), showFortuneAgain(), updateFortuneBar(), fortuneBar, fortuneCloseBtn, fortuneText, asKey(), closeFortune() (+16 more)

### Community 89 - "APT updates"
Cohesion: 0.40
Nodes (5): APT updates, Bind mount variant, Dashmon supervision, Installation, Schedule and reboot

### Community 90 - "SMART supervision"
Cohesion: 0.40
Nodes (5): Dashmon configuration, Installation, Scheduling, Security, SMART supervision

### Community 91 - "ref_url"
Cohesion: 0.33
Nodes (3): assert, path, { pathToFileURL }

### Community 92 - "render.js"
Cohesion: 0.14
Nodes (33): tileColorFor(), groupLabel(), searchQuery(), createSection(), collapseAllBtn, dashboard, searchInput, searchStatus (+25 more)

### Community 93 - "services.js"
Cohesion: 0.20
Nodes (22): categorySelect(), deleteButton(), getEditorHostNames(), hostSelect(), iconElement(), imageButton(), monitorControls(), optionsSelect() (+14 more)

### Community 94 - "opencode-widget.test.js"
Cohesion: 0.18
Nodes (8): agents, assert, config, ctx(), local, path, { pathToFileURL }, source

### Community 95 - "pairing-list.js"
Cohesion: 0.30
Nodes (12): agentHostSelect(), agentUrlInput(), button(), createPairingList(), render(), row(), setStatus(), TEST_FAILURES (+4 more)

### Community 96 - "Dashmon architecture"
Cohesion: 0.40
Nodes (5): Browser, Checks, Dashmon architecture, Overview, Server

### Community 97 - "host/metrics.js"
Cohesion: 0.10
Nodes (31): fs, nonnegativeInteger(), readAptUpdatesReport(), ERRORS, fs, readDirectoryReport(), createHostMetrics(), collect() (+23 more)

### Community 98 - "claude-stats.test.js"
Cohesion: 0.17
Nodes (10): assert, dir, fs, now, old, os, path, projects (+2 more)

### Community 99 - "browser.test.js"
Cohesion: 0.14
Nodes (17): assert, children, crypto, dir, freePort(), fs, loopback, main() (+9 more)

### Community 100 - "ref_fs"
Cohesion: 0.11
Nodes (22): crypto, DEFAULT_WEB_LINKS, ensureAgentLocalHost(), ensureHostIds(), fs, path, prepareDataDir(), runStartupMigrations() (+14 more)

### Community 101 - "app.js"
Cohesion: 0.08
Nodes (38): closeTopMenu(), gridSelects, headerObserver, loadConfig(), openSettings(), PHONE, positionTopMenu(), searchBox (+30 more)

### Community 102 - "editor.js"
Cohesion: 0.18
Nodes (26): fetchConfig(), updateIconsButton(), updateViewButton(), activateEditorPanel(), agentSettings, applyEditorChanges(), clearSaveStatus(), closeEditor() (+18 more)

### Community 103 - "t"
Cohesion: 0.20
Nodes (29): directorySection(), render(), field(), filterSection(), renderChoices(), frequencyList(), generalSection(), guideLink() (+21 more)

### Community 104 - "registerAgentRoutes"
Cohesion: 0.43
Nodes (5): registerAgentRoutes(), collect(), readAgents(), registerAgentSpeedtest(), registerAgentTest()

### Community 105 - "createConfirmDialog"
Cohesion: 0.32
Nodes (5): confirmDanger(), confirmDialog, createConfirmDialog(), cancel(), open()

### Community 106 - "js/config/normalize.js"
Cohesion: 0.12
Nodes (37): DEFAULT_CATEGORIES, DEFAULT_DASHBOARDS, HOST_MONITORING_TYPES, LINK_COUNTER_TYPES, normalizeAptUpdatesPrefs(), normalizeCollapsed(), normalizeConfig(), normalizeDashboards() (+29 more)

### Community 107 - "smart-report.js"
Cohesion: 0.36
Nodes (8): fs, normalizeSmartDisk(), readSmartDump(), smartAttribute(), smartNumber(), assert, disk, filesystem

### Community 108 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): arrowParens, printWidth, trailingComma

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

### Community 115 - "js/metrics.js"
Cohesion: 0.33
Nodes (9): init(), menuRefreshBtn, refreshBar, manualRefresh(), pageHidden(), refreshStatus(), setRefreshPending(), setupVisibilityPause() (+1 more)

### Community 116 - "Speed test"
Cohesion: 0.40
Nodes (5): Data used, How a test is measured, Settings, Speed test, Your own server: LibreSpeed

### Community 117 - "OpenCode statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Enable or hide the card, Installation, On an application tile, OpenCode statistics, Schedule

### Community 119 - "Claude Code statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Claude Code statistics, Enable or hide the card, Installation, Schedule, What is counted

### Community 120 - "js/pages.js"
Cohesion: 0.19
Nodes (20): setSearchOpen(), mobilePageBtn, mobilePageMenu, pageSwitchGroup, activeDashboardId(), applyPage(), button(), closeMobilePageMenu() (+12 more)

### Community 121 - "columns-layout.js"
Cohesion: 0.25
Nodes (16): board(), clear(), GAP, layoutColumns(), place(), placeColumns(), rowSpan(), schedule() (+8 more)

### Community 123 - "store.js"
Cohesion: 0.12
Nodes (16): ConfigStore, crypto, fs, parseConfig(), path, readValid(), syncFolder(), writeDurably() (+8 more)

### Community 124 - "state"
Cohesion: 0.26
Nodes (16): editorHostFilter, renderCategoryEditor(), closeColorPalette(), createColorPicker(), confirmDelete(), renderDashboardEditor(), makeDraggable(), moveItem() (+8 more)

### Community 125 - "dashboard/web-links.js"
Cohesion: 0.29
Nodes (10): compactCount(), linkCounterValue(), safeHref(), linkCounterText(), renderWebLinks(), updateWebLinkCounters(), updateWebLinksAppearance(), webLinksEnabledSelect (+2 more)

### Community 126 - "client.js"
Cohesion: 0.24
Nodes (14): open(), apiRequest(), blockedAddressError(), dns, getMaxBody(), getTimeout(), http, httpProbe() (+6 more)

### Community 127 - "auth.test.js"
Cohesion: 0.07
Nodes (35): createAuth(), closeSession(), cookieValue(), openSession(), parseCookie(), setCookie(), sign(), validBasicAuth() (+27 more)

### Community 128 - "dashboard/cards.js"
Cohesion: 0.38
Nodes (10): bumpUsage(), appendTileIcon(), applyWidgetStatus(), createCard(), statusTitle(), updateStatusIndicators(), effectiveStatus(), statusIcon() (+2 more)

### Community 129 - "demo.js"
Cohesion: 0.50
Nodes (4): RFC-5737, demoData(), LABELS, withDemo()

### Community 131 - "Host scripts"
Cohesion: 0.25
Nodes (8): Cron in short, For contributors, Host scripts, Moving from the former locations, Quick start: dashmon-setup, Schedules, Update everything at once, Without the setup tool

### Community 133 - "images.js"
Cohesion: 0.14
Nodes (18): closeImageLibraryBtn, imageGrid, imageLibrary, imageManagerGrid, manageDeleteBtn, managePngUpload, manageSelectionCount, manageUploadBtn (+10 more)

### Community 134 - "state"
Cohesion: 0.26
Nodes (12): DEFAULT_TAB_ICON, ICON_OPTIONS, createAgentSettings(), renderForm(), request(), buildPicker(), createDashboardIconPicker(), createIconPicker() (+4 more)

### Community 135 - "docker.test.js"
Cohesion: 0.20
Nodes (12): assert, check(), eacces(), http, pending, ref(), dockerErrorBody(), dockerHostMode() (+4 more)

### Community 136 - "wireguard-report.js"
Cohesion: 0.29
Nodes (9): byteCount(), fs, handshakeSeconds(), normalizePeer(), normalizeWireguard(), readWireguardDump(), assert, filesystem (+1 more)

### Community 137 - "ping/server.js"
Cohesion: 0.31
Nodes (6): check(), dns, net, parseTarget(), resolveTarget(), tcpConnect()

### Community 138 - "Directory sizes"
Cohesion: 0.40
Nodes (5): Directory sizes, Installation and selection, Permissions, Scheduling, Without Docker

### Community 139 - "js/format.js"
Cohesion: 0.57
Nodes (7): client.mjs, formatCompactCount(), formatCompactNumber(), formatDateTime(), formatNumber(), formatters(), localeOf()

### Community 140 - "createUsageSource"
Cohesion: 0.43
Nodes (6): createUsageSource(), agentName(), agentOfService(), fromAgent(), usageReport(), KINDS

### Community 141 - "api.js"
Cohesion: 0.33
Nodes (6): configConflict, configSaveChain, pendingConfigPatch, saveConfig(), setConfigRevision(), loadDemo()

### Community 143 - "confirm-dialog.test.js"
Cohesion: 0.40
Nodes (5): assert, element(), main(), path, { pathToFileURL }

### Community 145 - "identity.js"
Cohesion: 0.40
Nodes (4): crypto, fs, loadAgentIdentity(), path

### Community 146 - "editor-draft.test.js"
Cohesion: 0.40
Nodes (3): assert, path, { pathToFileURL }

### Community 147 - "editor-drag.test.js"
Cohesion: 0.40
Nodes (3): assert, path, { pathToFileURL }

### Community 148 - "host-monitoring-draft.test.js"
Cohesion: 0.40
Nodes (3): assert, path, { pathToFileURL }

### Community 149 - "replication-draft.test.js"
Cohesion: 0.40
Nodes (3): assert, path, { pathToFileURL }

### Community 150 - "opencode/server.js"
Cohesion: 0.80
Nodes (4): check(), mainModel(), summary(), usedTokens()

## Knowledge Gaps
- **3 isolated node(s):** `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1173 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `client.mjs` connect `js/format.js` to `opencode-widget.test.js`, `lib/themes.js`?**
  _High betweenness centrality (0.250) - this node is a cross-community bridge._
- **What connects `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supervision.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0628245067497404 - nodes in this community are weakly interconnected._
- **Why does `ctx()` connect `opencode-widget.test.js` to `js/format.js`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Should `dom.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05333333333333334 - nodes in this community are weakly interconnected._
- **Should `en` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `en` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._