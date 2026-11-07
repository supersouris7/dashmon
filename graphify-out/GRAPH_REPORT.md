# Graph Report - dashmon  (2026-11-07)

## Corpus Check
- 249 files · ~142,089 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 7, .css 6, .example 2)

## Summary
- 2432 nodes · 4768 edges · 141 communities (116 shown, 25 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 274 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e495db2f`
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
- session-routes.test.js
- createLocalMetrics
- _template/manifest.json
- widget-registry.js
- sanitizeText
- gotify/manifest.json
- with
- environment
- app.js
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
- ref_fs
- agent.test.js
- Dashmon widgets
- dashmon-agent
- server.js
- Dashmon
- lib/themes.js
- frontend.test.js
- main
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
- ref_assert
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
- fortune-bar.js
- APT updates
- SMART supervision
- ref_path
- host-settings.js
- opencode-widget.test.js
- js/themes.js
- pairing-list.js
- Dashmon architecture
- host/metrics.js
- claude-stats.test.js
- browser.test.js
- ref_fs
- opencode-report.test.js
- editor.js
- render.js
- registerAgentRoutes
- createConfirmDialog
- services.js
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
- scripts
- columns-layout.js
- claude-stats.sh
- store.js
- state
- ref_assert
- client.js
- ref_crypto
- version.js
- docker.test.js
- SessionStore
- directory-sizes.sh
- wireguard-report.js
- ping/server.js
- auth.test.js
- createAuth
- request-origin.js
- Directory sizes
- security-headers.test.js
- opencode/server.js

## God Nodes (most connected - your core abstractions)
1. `t()` - 122 edges
2. `WidgetCore` - 35 edges
3. `main()` - 33 edges
4. `state` - 31 edges
5. `sanitizeText()` - 28 edges
6. `applyEditorChanges()` - 27 edges
7. `normalizeConfig()` - 23 edges
8. `renderSupervision()` - 23 edges
9. `renderServiceEditor()` - 21 edges
10. `saveViewPrefs()` - 20 edges

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

## Communities (141 total, 25 thin omitted)

### Community 0 - "supervision.js"
Cohesion: 0.05
Nodes (105): mobilePageBtn, mobilePageMenu, pageSwitchGroup, supervisionList, supervisionPage, activeDashboardId(), applyPage(), button() (+97 more)

### Community 1 - "dom.js"
Cohesion: 0.05
Nodes (60): addCategoryBtn, addDashboardBtn, cancelBtn, categoryEditor, closeBtn, closeImageLibraryBtn, collapseAllBtn, configImportInput (+52 more)

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

### Community 13 - "session-routes.test.js"
Cohesion: 0.21
Nodes (11): createAuthFailures(), registerSessionRoutes(), recordFailure(), requireAuth(), tooManyAttempts(), assert, express, fs (+3 more)

### Community 14 - "createLocalMetrics"
Cohesion: 0.19
Nodes (11): clampPercent(), createLocalMetrics(), localCpuPercent(), localDiskPercent(), localRamPercent(), readCpuTimes(), assert, filesystem (+3 more)

### Community 15 - "_template/manifest.json"
Cohesion: 0.06
Nodes (34): cacheKey, client, config, description, en, fr, apiToken, apiTokenConfigured (+26 more)

### Community 16 - "widget-registry.js"
Cohesion: 0.09
Nodes (41): client.mjs, widgetConfig, widgetConfigBody, widgetConfigCloseBtn, widgetConfigSaveBtn, widgetControls(), buildWidgetField(), commitWidgetConfig() (+33 more)

### Community 17 - "sanitizeText"
Cohesion: 0.18
Nodes (19): HOST_MONITORING_TYPES, sanitizeFortune(), sanitizeHostMonitoring(), sanitizeLinkCounter(), sanitizeSpeedtest(), SPEEDTEST_INTERVALS, WEB_LINK_COUNTER_TYPES, createConfigNormalizer() (+11 more)

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
Cohesion: 0.09
Nodes (42): RFC-5737, saveConfig(), setConfigRevision(), closeTopMenu(), gridSelects, headerObserver, loadConfig(), loadDemo() (+34 more)

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
Cohesion: 0.14
Nodes (17): unused, dependencies, express@^5.3.0, devDependencies, eslint@10.13.0, @eslint/js@10.0.1, globals@17.13.0, prettier@3.9.10 (+9 more)

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

### Community 33 - "ref_fs"
Cohesion: 0.07
Nodes (23): crypto, fs, loadAgentIdentity(), path, fs, os, fs, path (+15 more)

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
Cohesion: 0.11
Nodes (20): AGENT_API_PATHS, agentApiFilter(), errorHandler(), notFound(), requestLog(), startServer(), log, registerHostMetricsRoutes() (+12 more)

### Community 38 - "Dashmon"
Cohesion: 0.13
Nodes (15): Dashmon, Docker Compose, Docker (recommended), Documentation, First steps, From source, Icons, License (+7 more)

### Community 39 - "lib/themes.js"
Cohesion: 0.06
Nodes (43): Creating a theme, Dashmon — Customization guide, Example, File format, Font Awesome icons (categories, hosts, web links), Fortune Cookie, Icons, Images (services) (+35 more)

### Community 40 - "frontend.test.js"
Cohesion: 0.16
Nodes (17): assert, check(), contains(), editorSource(), fs, importStateModules(), JS_DIR, main() (+9 more)

### Community 41 - "main"
Cohesion: 0.13
Nodes (14): Registry, assert, check(), fs, main(), ok(), os, path (+6 more)

### Community 42 - "settings.test.js"
Cohesion: 0.15
Nodes (14): fs, hostMetricsInterval(), path, readSettings(), assert, crypto, custom, defaults (+6 more)

### Community 43 - "Dashmon — Docker deployment"
Cohesion: 0.07
Nodes (35): 1. Run, 2. Environment variables, 3. Data, 4. Portainer stacks, 5. nginx (optional), 6. Verification, 7. Monitoring LAN domains (.lan, .local…), 8. Private CA certificates (+27 more)

### Community 44 - "createSpeedtest"
Cohesion: 0.33
Nodes (10): createSpeedtest(), nextAt(), prefs(), report(), run(), runNow(), start(), store() (+2 more)

### Community 45 - "icons.js"
Cohesion: 0.16
Nodes (15): availableFileName(), decodeFileName(), express, fs, path, PNG_SIGNATURE, pngSize(), registerIconRoutes() (+7 more)

### Community 46 - "github/manifest.json"
Cohesion: 0.20
Nodes (9): cacheKey, config, hidden, id, interval, probe, server, strings (+1 more)

### Community 47 - "usage-report.js"
Cohesion: 0.44
Nodes (10): activity(), count(), fs, models(), money(), normalizeUsagePeriod(), PERIODS, readUsageReport() (+2 more)

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

### Community 54 - "ref_assert"
Cohesion: 0.12
Nodes (16): createReplicationConfig(), sanitizeReplication(), associated(), sanitizeSyncUrl(), assert, check(), FIXTURES, main() (+8 more)

### Community 56 - "screenshots.js"
Cohesion: 0.10
Nodes (38): CLAUDE_MODELS, compose(), crypto, dataUrl(), downloadIcons(), fakeHostMetrics(), fakeSpeedtest(), fakeStatus() (+30 more)

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

### Community 91 - "ref_path"
Cohesion: 0.06
Nodes (23): express, fs, path, assert, path, { pathToFileURL }, assert, element() (+15 more)

### Community 92 - "host-settings.js"
Cohesion: 0.36
Nodes (15): SPEEDTEST_INTERVALS, field(), filterSection(), renderChoices(), generalSection(), help(), hint(), input() (+7 more)

### Community 93 - "opencode-widget.test.js"
Cohesion: 0.14
Nodes (14): createUsageSource(), agentName(), agentOfService(), fromAgent(), usageReport(), KINDS, agents, assert (+6 more)

### Community 94 - "js/themes.js"
Cohesion: 0.13
Nodes (26): configConflict, configSaveChain, fetchConfig(), patchConfig(), pendingConfigPatch, themeSelect, allThemes(), applyTheme() (+18 more)

### Community 95 - "pairing-list.js"
Cohesion: 0.20
Nodes (20): createAgentSettings(), renderForm(), request(), agentHostSelect(), agentUrlInput(), button(), createPairingList(), render() (+12 more)

### Community 96 - "Dashmon architecture"
Cohesion: 0.40
Nodes (5): Browser, Checks, Dashmon architecture, Overview, Server

### Community 97 - "host/metrics.js"
Cohesion: 0.17
Nodes (16): fs, nonnegativeInteger(), readAptUpdatesReport(), fs, readDirectoryReport(), createHostMetrics(), collect(), handle() (+8 more)

### Community 98 - "claude-stats.test.js"
Cohesion: 0.17
Nodes (10): assert, dir, fs, now, old, os, path, projects (+2 more)

### Community 99 - "browser.test.js"
Cohesion: 0.14
Nodes (17): assert, children, crypto, dir, freePort(), fs, loopback, main() (+9 more)

### Community 100 - "ref_fs"
Cohesion: 0.11
Nodes (22): crypto, DEFAULT_WEB_LINKS, ensureAgentLocalHost(), ensureHostIds(), fs, path, prepareDataDir(), runStartupMigrations() (+14 more)

### Community 101 - "opencode-report.test.js"
Cohesion: 0.12
Nodes (13): assert, bin, dir, fs, os, path, period, read() (+5 more)

### Community 102 - "editor.js"
Cohesion: 0.18
Nodes (22): activateEditorPanel(), agentSettings, clearSaveStatus(), closeEditor(), confirmDanger(), confirmDialog, openConfirm, discardEditor() (+14 more)

### Community 103 - "render.js"
Cohesion: 0.06
Nodes (85): bumpUsage(), compactCount(), DEFAULT_CATEGORIES, DEFAULT_DASHBOARDS, HOST_MONITORING_TYPES, LINK_COUNTER_TYPES, linkCounterValue(), normalizeAptUpdatesPrefs() (+77 more)

### Community 104 - "registerAgentRoutes"
Cohesion: 0.43
Nodes (5): registerAgentRoutes(), collect(), readAgents(), registerAgentSpeedtest(), registerAgentTest()

### Community 105 - "createConfirmDialog"
Cohesion: 0.50
Nodes (3): createConfirmDialog(), cancel(), open()

### Community 106 - "services.js"
Cohesion: 0.23
Nodes (18): addServiceBtn, serviceEditor, categorySelect(), deleteButton(), getEditorHostNames(), hostSelect(), iconElement(), imageButton() (+10 more)

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
Cohesion: 0.33
Nodes (8): createStatusMonitor(), checkService(), isDue(), runCycle(), linkCounterService(), linkCounterServices(), createScheduler(), createServices()

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

### Community 120 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, format, format:check, lint, screenshots, start, test, test:browser

### Community 121 - "columns-layout.js"
Cohesion: 0.25
Nodes (16): board(), clear(), GAP, layoutColumns(), place(), placeColumns(), rowSpan(), schedule() (+8 more)

### Community 123 - "store.js"
Cohesion: 0.23
Nodes (8): ConfigStore, crypto, fs, parseConfig(), path, readValid(), syncFolder(), writeDurably()

### Community 124 - "state"
Cohesion: 0.16
Nodes (28): DEFAULT_TAB_ICON, ICON_OPTIONS, addHostBtn, addWebLinkBtn, editorHostFilter, hostEditor, webLinksEditor, renderCategoryEditor() (+20 more)

### Community 125 - "ref_assert"
Cohesion: 0.17
Nodes (9): assert, config, normalize, assert, { execFileSync }, fs, os, path (+1 more)

### Community 126 - "client.js"
Cohesion: 0.24
Nodes (14): open(), apiRequest(), blockedAddressError(), dns, getMaxBody(), getTimeout(), http, httpProbe() (+6 more)

### Community 127 - "ref_crypto"
Cohesion: 0.27
Nodes (7): validBasicAuth(), crypto, crypto, digest(), KEY, safeEqual(), createSyncTokenCheck()

### Community 128 - "version.js"
Cohesion: 0.24
Nodes (10): fs, path, appIsMounted(), describeVersion(), fs, isMountedPath(), readMountPoints(), releaseLabel() (+2 more)

### Community 129 - "docker.test.js"
Cohesion: 0.20
Nodes (12): assert, check(), eacces(), http, pending, ref(), dockerErrorBody(), dockerHostMode() (+4 more)

### Community 131 - "SessionStore"
Cohesion: 0.27
Nodes (3): crypto, fs, SessionStore

### Community 133 - "wireguard-report.js"
Cohesion: 0.29
Nodes (9): byteCount(), fs, handshakeSeconds(), normalizePeer(), normalizeWireguard(), readWireguardDump(), assert, filesystem (+1 more)

### Community 134 - "ping/server.js"
Cohesion: 0.31
Nodes (6): check(), dns, net, parseTarget(), resolveTarget(), tcpConnect()

### Community 135 - "auth.test.js"
Cohesion: 0.22
Nodes (8): assert, dir, file, fs, login(), os, path, request()

### Community 136 - "createAuth"
Cohesion: 0.42
Nodes (8): createAuth(), closeSession(), cookieValue(), openSession(), parseCookie(), setCookie(), sign(), validSession()

### Community 137 - "request-origin.js"
Cohesion: 0.39
Nodes (6): defaultPort(), sameOrigin(), STATE_CHANGING, verifyRequestOrigin(), assert, check()

### Community 138 - "Directory sizes"
Cohesion: 0.40
Nodes (4): Directory sizes, Installation and selection, Scheduling, Without Docker

### Community 139 - "security-headers.test.js"
Cohesion: 0.38
Nodes (5): CONTENT_SECURITY_POLICY, securityHeaders(), assert, headers(), plain

### Community 140 - "opencode/server.js"
Cohesion: 0.80
Nodes (4): check(), mainModel(), summary(), usedTokens()

## Knowledge Gaps
- **3 isolated node(s):** `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `client.mjs` connect `widget-registry.js` to `opencode-widget.test.js`, `lib/themes.js`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **What connects `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supervision.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0546218487394958 - nodes in this community are weakly interconnected._
- **Why does `ctx()` connect `opencode-widget.test.js` to `widget-registry.js`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **Should `dom.js` be split into smaller, more focused modules?**
  _Cohesion score 0.046634615384615385 - nodes in this community are weakly interconnected._
- **Should `en` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `en` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._