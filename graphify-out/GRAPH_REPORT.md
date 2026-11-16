# Graph Report - dashmon  (2026-11-16)

## Corpus Check
- 301 files · ~172,910 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 10, (none) 7, .example 2)

## Summary
- 2961 nodes · 5911 edges · 156 communities (134 shown, 22 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 364 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fac31ddc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- WidgetCore
- app.js
- supervisions.test.js
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
- ref_path
- request-origin.js
- en
- docker.test.js
- HTTPS with nginx
- speedtest.js
- en
- fr
- ref_path
- agent.test.js
- Dashmon widgets
- dashmon-agent
- server.js
- Dashmon
- lib/themes.js
- frontend.test.js
- editor.js
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
- api-errors.js
- hosts.js
- monitor.js
- screenshots.js
- rate-limit.test.js
- lichess/client.mjs
- dashmon
- WireGuard in Dashmon
- uptimekuma/client.mjs
- apt-updates.sh
- wireguard-dump.sh
- login.js
- dockerhub/server.js
- github/server.js
- supervision.js
- github/client.mjs
- description
- label
- supervision/format.js
- metube/client.mjs
- ping/client.mjs
- qbittorrent/client.mjs
- web/server.js
- smart-dump.sh
- directories/client.mjs
- Install Dashmon and its agents
- fortune-bar.js
- APT updates
- SMART supervision
- services.js
- plugin-card.js
- apt-updates/manifest.json
- opencode-widget.test.js
- dom.js
- Dashmon architecture
- host/metrics.js
- SessionStore
- browser.test.js
- ref_fs
- pairing-list.js
- Themes
- config-parity.test.js
- store.js
- directories/manifest.json
- js/config/normalize.js
- auth.test.js
- .prettierrc.json
- host/metrics.js
- claude-stats.test.js
- speedtest-card.js
- updates
- replication-config.test.js
- opencode/client.mjs
- js/metrics.js
- Speed test
- OpenCode statistics
- opencode-stats.sh
- Claude Code statistics
- usage-card.js
- columns-layout.js
- claude-stats.sh
- ping/server.js
- t
- smart/report.js
- client.js
- wireguard/report.js
- devDependencies
- secrets.test.js
- Host scripts
- directory-sizes.sh
- registerConfigRoutes
- confirm.js
- render.js
- security-headers.test.js
- smart/manifest.json
- Directory sizes
- demo.js
- wireguard/manifest.json
- claude/manifest.json
- identity.js
- supervisions/opencode/manifest.json
- i18n.js
- ref_fs
- dashboard/cards.js
- js/config/plugin-prefs.js
- Registry
- manifest.js
- lib/config/plugin-prefs.js
- preserve.js
- opencode-report.test.js
- dashboard/web-links.js
- supervision-registry.js
- browser-paths.mjs

## God Nodes (most connected - your core abstractions)
1. `t()` - 122 edges
2. `sanitizeText()` - 38 edges
3. `apiError()` - 36 edges
4. `WidgetCore` - 35 edges
5. `state` - 32 edges
6. `Registry` - 27 edges
7. `applyEditorChanges()` - 27 edges
8. `main()` - 26 edges
9. `install_one()` - 25 edges
10. `element()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Host settings` --references--> `help()`  [INFERRED]
  docs/EXTENDING.md → public/js/editor/host-settings.js
- `client.mjs` --references--> `prefs()`  [INFERRED]
  docs/EXTENDING.md → lib/host/speedtest.js
- `server.js` --references--> `prefs()`  [INFERRED]
  docs/EXTENDING.md → lib/host/speedtest.js
- `client.mjs` --references--> `details()`  [INFERRED]
  docs/EXTENDING.md → public/js/supervision/speedtest-card.js
- `Add a widget or a Supervision card` --references--> `ctx()`  [INFERRED]
  CONTRIBUTING.md → test/opencode-widget.test.js

## Import Cycles
- None detected.

## Communities (156 total, 22 thin omitted)

### Community 0 - "WidgetCore"
Cohesion: 0.11
Nodes (16): createSecretCodec(), decryptSecret(), crypto, isEncryptedSecret(), isMaskedSecret(), maskSecret(), secretFingerprint(), localize() (+8 more)

### Community 1 - "app.js"
Cohesion: 0.11
Nodes (38): saveConfig(), setConfigRevision(), closeTopMenu(), gridSelects, headerObserver, loadConfig(), loadDemo(), openSettings() (+30 more)

### Community 2 - "supervisions.test.js"
Cohesion: 0.09
Nodes (23): extraRoot(), fs, path, pluginEnabled(), pluginPrefs(), SupervisionCore, withTimeout(), extraRoot() (+15 more)

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
Cohesion: 0.13
Nodes (49): ask_frequency(), auto_status(), auto_update(), check_tools(), choose_container(), clear_screen(), confirm(), cron_comment() (+41 more)

### Community 14 - "createLocalMetrics"
Cohesion: 0.16
Nodes (13): clampPercent(), createLocalMetrics(), localCpuPercent(), localDiskPercent(), localRamPercent(), readCpuTimes(), fs, os (+5 more)

### Community 15 - "_template/manifest.json"
Cohesion: 0.06
Nodes (34): cacheKey, client, config, description, en, fr, apiToken, apiTokenConfigured (+26 more)

### Community 16 - "widget-registry.js"
Cohesion: 0.11
Nodes (32): errorText(), widgetConfig, widgetConfigBody, widgetConfigCloseBtn, widgetConfigSaveBtn, buildWidgetField(), commitWidgetConfig(), hasWidgetType() (+24 more)

### Community 17 - "sanitizeText"
Cohesion: 0.17
Nodes (20): HOST_MONITORING_TYPES, sanitizeFortune(), sanitizeHostMonitoring(), sanitizeLinkCounter(), sanitizeSpeedtest(), SPEEDTEST_INTERVALS, WEB_LINK_COUNTER_TYPES, createConfigNormalizer() (+12 more)

### Community 18 - "gotify/manifest.json"
Cohesion: 0.06
Nodes (32): cacheKey, client, config, description, en, fr, empty, error (+24 more)

### Community 19 - "with"
Cohesion: 0.06
Nodes (35): if, needs, runs-on, steps, CHROMIUM_BIN, jobs, docker, test (+27 more)

### Community 20 - "environment"
Cohesion: 0.06
Nodes (31): cap_drop, container_name, dns, environment, image, ports, read_only, restart (+23 more)

### Community 21 - "js/themes.js"
Cohesion: 0.18
Nodes (22): patchConfig(), themeSelect, allThemes(), applyTheme(), applyThemeLabels(), buildThemeSelect(), currentTheme(), deleteCustomTheme() (+14 more)

### Community 22 - "en"
Cohesion: 0.04
Nodes (46): cacheKey, client, config, description, en, fr, cost, days30 (+38 more)

### Community 23 - "registry.js"
Cohesion: 0.15
Nodes (16): asLocalized(), FIELD_TYPES, fs, isPlainObject(), path, { pathToFileURL }, validateField(), validateManifest() (+8 more)

### Community 24 - "web/manifest.json"
Cohesion: 0.08
Nodes (23): cacheKey, defaultFor, description, en, fr, badProtocol, invalidUrl, name (+15 more)

### Community 25 - "ref_path"
Cohesion: 0.13
Nodes (28): fs, os, path, assert, check(), finish(), ok(), path (+20 more)

### Community 26 - "request-origin.js"
Cohesion: 0.39
Nodes (6): defaultPort(), sameOrigin(), STATE_CHANGING, verifyRequestOrigin(), assert, check()

### Community 27 - "en"
Cohesion: 0.06
Nodes (30): client, description, en, fr, busy, cores, idle, load1 (+22 more)

### Community 28 - "docker.test.js"
Cohesion: 0.20
Nodes (12): assert, check(), eacces(), http, pending, ref(), dockerErrorBody(), dockerHostMode() (+4 more)

### Community 29 - "HTTPS with nginx"
Cohesion: 0.17
Nodes (12): 1. Prepare Dashmon, 2. Install nginx and certbot, 3. Configure the HTTP proxy, 4. Add the certificate, 5. Check, Before you start, HTTPS with nginx, Local name: internal certificate (+4 more)

### Community 30 - "speedtest.js"
Cohesion: 0.11
Nodes (27): agentsFor(), check(), crypto, downloadWorker(), endpoints(), errorCode(), failure(), fs (+19 more)

### Community 31 - "en"
Cohesion: 0.11
Nodes (19): error, metric, metricForks, metricForksShort, metricIssues, metricIssuesShort, metricStars, metricStarsShort (+11 more)

### Community 32 - "fr"
Cohesion: 0.11
Nodes (19): error, metric, metricForks, metricForksShort, metricIssues, metricIssuesShort, metricStars, metricStarsShort (+11 more)

### Community 33 - "ref_path"
Cohesion: 0.05
Nodes (32): assert, report, assert, path, { pathToFileURL }, assert, element(), main() (+24 more)

### Community 34 - "agent.test.js"
Cohesion: 0.09
Nodes (20): CAPABILITIES, PROTOCOL, assert, children, crypto, dir, freePort(), fs (+12 more)

### Community 35 - "Dashmon widgets"
Cohesion: 0.12
Nodes (16): Adding your own, AdGuard Home, Dashmon widgets, Docker, Duplicati, Gotify, How failures are displayed, Lichess (+8 more)

### Community 36 - "dashmon-agent"
Cohesion: 0.13
Nodes (14): cap_drop, environment, image, ports, read_only, restart, security_opt, volumes (+6 more)

### Community 37 - "server.js"
Cohesion: 0.09
Nodes (33): AGENT_API_PATHS, agentApiFilter(), apiError(), errorHandler(), notFound(), requestLog(), startServer(), log (+25 more)

### Community 38 - "Dashmon"
Cohesion: 0.13
Nodes (15): Dashmon, Docker Compose, Docker (recommended), Documentation, First steps, From source, Icons, License (+7 more)

### Community 39 - "lib/themes.js"
Cohesion: 0.15
Nodes (23): fs, registerThemeRoutes(), fs, listThemeIds(), normalizeTheme(), OPTIONAL_VARIABLES, path, readTheme() (+15 more)

### Community 40 - "frontend.test.js"
Cohesion: 0.15
Nodes (18): assert, check(), COMPONENT_CSS, contains(), editorSource(), fs, importStateModules(), JS_DIR (+10 more)

### Community 41 - "editor.js"
Cohesion: 0.10
Nodes (32): configConflict, configSaveChain, fetchConfig(), pendingConfigPatch, configImportInput, demoConfigBtn, exportConfigBtn, importConfigBtn (+24 more)

### Community 42 - "settings.test.js"
Cohesion: 0.10
Nodes (24): fs, hostMetricsInterval(), path, readSettings(), fs, path, registerSystemRoutes(), appIsMounted() (+16 more)

### Community 43 - "Dashmon — Docker deployment"
Cohesion: 0.07
Nodes (35): 1. Run, 2. Environment variables, 3. Data, 4. Portainer stacks, 5. nginx (optional), 6. Verification, 7. Monitoring LAN domains (.lan, .local…), 8. Private CA certificates (+27 more)

### Community 44 - "createSpeedtest"
Cohesion: 0.38
Nodes (9): createSpeedtest(), nextAt(), prefs(), report(), run(), runNow(), start(), store() (+1 more)

### Community 45 - "icons.js"
Cohesion: 0.10
Nodes (22): createAuthFailures(), availableFileName(), decodeFileName(), express, fs, path, PNG_SIGNATURE, pngSize() (+14 more)

### Community 46 - "github/manifest.json"
Cohesion: 0.20
Nodes (9): cacheKey, config, hidden, id, interval, probe, server, strings (+1 more)

### Community 47 - "usage-report.js"
Cohesion: 0.28
Nodes (13): activity(), count(), fs, models(), money(), normalizeUsagePeriod(), PERIODS, readUsageReport() (+5 more)

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

### Community 52 - "api-errors.js"
Cohesion: 0.10
Nodes (22): API_ERRORS, resultError(), assert, main(), path, { pathToFileURL }, check(), check() (+14 more)

### Community 53 - "hosts.js"
Cohesion: 0.14
Nodes (30): addCategoryBtn, addDashboardBtn, addHostBtn, addWebLinkBtn, categoryEditor, dashboardEditor, hostEditor, webLinksEditor (+22 more)

### Community 54 - "monitor.js"
Cohesion: 0.39
Nodes (7): createStatusMonitor(), checkService(), isDue(), runCycle(), linkCounterService(), linkCounterServices(), createScheduler()

### Community 56 - "screenshots.js"
Cohesion: 0.10
Nodes (38): CLAUDE_MODELS, compose(), crypto, dataUrl(), downloadIcons(), fakeHostMetrics(), fakeSpeedtest(), fakeStatus() (+30 more)

### Community 57 - "rate-limit.test.js"
Cohesion: 0.28
Nodes (5): createRateLimiter(), middleware(), createRequestLimits(), assert, limiter

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

### Community 67 - "supervision.js"
Cohesion: 0.12
Nodes (32): mobilePageBtn, mobilePageMenu, pageSwitchGroup, supervisionPage, activeDashboardId(), applyPage(), button(), closeMobilePageMenu() (+24 more)

### Community 69 - "description"
Cohesion: 0.67
Nodes (3): description, en, fr

### Community 70 - "label"
Cohesion: 0.67
Nodes (3): label, en, fr

### Community 71 - "supervision/format.js"
Cohesion: 0.33
Nodes (14): bytesText(), handshakeAge(), handshakeText(), isMissing(), metricSeverity(), percentText(), temperatureSeverity(), temperatureText() (+6 more)

### Community 79 - "directories/client.mjs"
Cohesion: 0.09
Nodes (28): aptUpdatesCard(), element(), aptHealth(), SOURCE, directoryCard(), directoryError(), directoryItem(), element() (+20 more)

### Community 87 - "Install Dashmon and its agents"
Cohesion: 0.20
Nodes (10): 1. Prepare the secrets, 2. Install the primary, 3. Install an agent, 4. Add WireGuard, SMART, APT or usage statistics, 5. Upgrade and back up, Changing the sync token, Choose your installation, Install Dashmon and its agents (+2 more)

### Community 88 - "fortune-bar.js"
Cohesion: 0.16
Nodes (24): scheduleMidnight(), showFortuneAgain(), updateFortuneBar(), fortuneBar, fortuneCloseBtn, fortuneText, asKey(), closeFortune() (+16 more)

### Community 89 - "APT updates"
Cohesion: 0.40
Nodes (5): APT updates, Bind mount variant, Dashmon supervision, Installation, Schedule and reboot

### Community 90 - "SMART supervision"
Cohesion: 0.40
Nodes (5): Dashmon configuration, Installation, Scheduling, Security, SMART supervision

### Community 91 - "services.js"
Cohesion: 0.21
Nodes (22): addServiceBtn, serviceEditor, setIconButton(), categorySelect(), deleteButton(), getEditorHostNames(), hostSelect(), iconElement() (+14 more)

### Community 92 - "plugin-card.js"
Cohesion: 0.17
Nodes (22): supervisionList, cardKey(), EXPANDABLE_CARDS, isExpanded(), setAllSmartDetails(), setExpanded(), toggleAllSmartDetails(), updateSmartCollapseButton() (+14 more)

### Community 93 - "apt-updates/manifest.json"
Cohesion: 0.08
Nodes (25): client, description, en, fr, files, report, guide, icon (+17 more)

### Community 94 - "opencode-widget.test.js"
Cohesion: 0.05
Nodes (51): Add a widget or a Supervision card, Before opening a pull request, Contributing to Dashmon, Conventions, Public repository: no personal data, Set up, client.mjs, client.mjs (+43 more)

### Community 95 - "dom.js"
Cohesion: 0.06
Nodes (58): cancelBtn, closeBtn, closeImageLibraryBtn, collapseAllBtn, dashboard, deleteThemeBtn, editorCategoryFilter, editorHostFilter (+50 more)

### Community 96 - "Dashmon architecture"
Cohesion: 0.33
Nodes (6): Browser, Checks, Dashmon architecture, Extension points, Overview, Server

### Community 97 - "host/metrics.js"
Cohesion: 0.11
Nodes (23): fs, outdatedScripts(), path, readInstalledVersions(), scriptVersion(), fs, nonnegativeInteger(), readAptUpdatesReport() (+15 more)

### Community 98 - "SessionStore"
Cohesion: 0.27
Nodes (3): crypto, fs, SessionStore

### Community 99 - "browser.test.js"
Cohesion: 0.08
Nodes (26): assert, children, crypto, dir, freePort(), fs, loopback, main() (+18 more)

### Community 100 - "ref_fs"
Cohesion: 0.10
Nodes (23): crypto, DEFAULT_WEB_LINKS, ensureAgentLocalHost(), ensureHostIds(), fs, path, prepareDataDir(), runStartupMigrations() (+15 more)

### Community 101 - "pairing-list.js"
Cohesion: 0.26
Nodes (16): listField(), render(), moveButtons(), agentHostSelect(), agentUrlInput(), button(), createPairingList(), render() (+8 more)

### Community 102 - "Themes"
Cohesion: 0.17
Nodes (11): Creating a theme, Dashmon — Customization guide, Example, File format, Font Awesome icons (categories, hosts, web links), Fortune Cookie, Icons, Images (services) (+3 more)

### Community 103 - "config-parity.test.js"
Cohesion: 0.16
Nodes (16): assert, check(), FIXTURES, main(), pairing, path, { pathToFileURL }, PLUGIN_SETTINGS (+8 more)

### Community 104 - "store.js"
Cohesion: 0.23
Nodes (8): ConfigStore, crypto, fs, parseConfig(), path, readValid(), syncFolder(), writeDurably()

### Community 105 - "directories/manifest.json"
Cohesion: 0.08
Nodes (25): client, description, en, fr, files, report, guide, icon (+17 more)

### Community 106 - "js/config/normalize.js"
Cohesion: 0.12
Nodes (31): DEFAULT_CATEGORIES, DEFAULT_DASHBOARDS, HOST_MONITORING_TYPES, LINK_COUNTER_TYPES, normalizeCollapsed(), normalizeConfig(), normalizeDashboards(), normalizeExpandedKeys() (+23 more)

### Community 107 - "auth.test.js"
Cohesion: 0.11
Nodes (23): createAuth(), closeSession(), cookieValue(), openSession(), parseCookie(), setCookie(), sign(), validBasicAuth() (+15 more)

### Community 108 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): arrowParens, printWidth, trailingComma

### Community 109 - "host/metrics.js"
Cohesion: 0.26
Nodes (10): createHostMetrics(), collect(), handle(), hostReport(), scriptVersions(), withPlugins(), localHostOf(), path (+2 more)

### Community 110 - "claude-stats.test.js"
Cohesion: 0.06
Nodes (26): assert, dir, fs, now, old, os, path, projects (+18 more)

### Community 111 - "speedtest-card.js"
Cohesion: 0.30
Nodes (13): applyHostColor(), rateText(), relativeAge(), dateText(), details(), figure(), graph(), health() (+5 more)

### Community 112 - "updates"
Cohesion: 0.13
Nodes (14): default-days, dependency-type, dev-tools, dependency-name, versions, interval, updates, cooldown (+6 more)

### Community 113 - "replication-config.test.js"
Cohesion: 0.24
Nodes (7): createReplicationConfig(), sanitizeReplication(), associated(), sanitizeSyncUrl(), assert, result, { sanitizeReplication, sanitizeSyncUrl }

### Community 115 - "js/metrics.js"
Cohesion: 0.39
Nodes (8): init(), refreshBar, manualRefresh(), pageHidden(), refreshStatus(), setRefreshPending(), setupVisibilityPause(), startStatusLoop()

### Community 116 - "Speed test"
Cohesion: 0.40
Nodes (5): Data used, How a test is measured, Settings, Speed test, Your own server: LibreSpeed

### Community 117 - "OpenCode statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Enable or hide the card, Installation, On an application tile, OpenCode statistics, Schedule

### Community 119 - "Claude Code statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Claude Code statistics, Enable or hide the card, Installation, Schedule, What is counted

### Community 120 - "usage-card.js"
Cohesion: 0.24
Nodes (22): element(), smartNumberText(), activityChart(), activityDetails(), costText(), dailyActivity(), figures(), locale() (+14 more)

### Community 121 - "columns-layout.js"
Cohesion: 0.25
Nodes (16): board(), clear(), GAP, layoutColumns(), place(), placeColumns(), rowSpan(), schedule() (+8 more)

### Community 123 - "ping/server.js"
Cohesion: 0.31
Nodes (6): check(), dns, net, parseTarget(), resolveTarget(), tcpConnect()

### Community 124 - "t"
Cohesion: 0.16
Nodes (28): SPEEDTEST_INTERVALS, choicesField(), renderChoices(), field(), frequencyList(), generalSection(), guideLink(), help() (+20 more)

### Community 125 - "smart/report.js"
Cohesion: 0.30
Nodes (9): fs, normalizeSmartDisk(), readSmartDump(), smartAttribute(), smartNumber(), collect(), assert, disk (+1 more)

### Community 126 - "client.js"
Cohesion: 0.22
Nodes (14): open(), apiRequest(), blockedAddressError(), dns, getMaxBody(), getTimeout(), http, httpProbe() (+6 more)

### Community 127 - "wireguard/report.js"
Cohesion: 0.26
Nodes (10): byteCount(), fs, handshakeSeconds(), normalizePeer(), normalizeWireguard(), readWireguardDump(), collect(), assert (+2 more)

### Community 128 - "devDependencies"
Cohesion: 0.08
Nodes (26): unused, dependencies, express@^5.3.0, devDependencies, eslint@10.13.0, @eslint/js@10.0.1, globals@17.13.0, prettier@3.9.10 (+18 more)

### Community 129 - "secrets.test.js"
Cohesion: 0.29
Nodes (6): assert, codec, crypto, encrypted, unconfigured, value

### Community 131 - "Host scripts"
Cohesion: 0.20
Nodes (10): Automatic update, Cron in short, For contributors, Host scripts, Moving from the former locations, Quick start: dashmon-setup, Schedules, Update everything at once (+2 more)

### Community 133 - "registerConfigRoutes"
Cohesion: 0.36
Nodes (6): countsOf(), registerConfigRoutes(), flushUsage(), usageKey(), assert, main()

### Community 134 - "confirm.js"
Cohesion: 0.50
Nodes (3): createConfirmDialog(), cancel(), open()

### Community 135 - "render.js"
Cohesion: 0.18
Nodes (25): sanitizeTileColor(), tileColorFor(), groupLabel(), searchQuery(), createSection(), announceSearch(), categoryDashboardId(), createWelcome() (+17 more)

### Community 136 - "security-headers.test.js"
Cohesion: 0.38
Nodes (5): CONTENT_SECURITY_POLICY, securityHeaders(), assert, headers(), plain

### Community 137 - "smart/manifest.json"
Cohesion: 0.08
Nodes (24): client, description, en, fr, default, env, files, dump (+16 more)

### Community 138 - "Directory sizes"
Cohesion: 0.40
Nodes (5): Directory sizes, Installation and selection, Permissions, Scheduling, Without Docker

### Community 139 - "demo.js"
Cohesion: 0.50
Nodes (4): RFC-5737, demoData(), LABELS, withDemo()

### Community 140 - "wireguard/manifest.json"
Cohesion: 0.08
Nodes (24): client, description, en, fr, default, env, files, dump (+16 more)

### Community 141 - "claude/manifest.json"
Cohesion: 0.08
Nodes (23): client, description, en, fr, files, report, guide, icon (+15 more)

### Community 142 - "identity.js"
Cohesion: 0.40
Nodes (4): crypto, fs, loadAgentIdentity(), path

### Community 143 - "supervisions/opencode/manifest.json"
Cohesion: 0.08
Nodes (23): client, description, en, fr, files, report, guide, icon (+15 more)

### Community 145 - "i18n.js"
Cohesion: 0.18
Nodes (12): DEFAULT_TAB_ICON, ICON_OPTIONS, createAgentSettings(), renderForm(), request(), UI_TEXT, serviceMatchesSearch(), state (+4 more)

### Community 147 - "ref_fs"
Cohesion: 0.07
Nodes (23): os, assert, bin, dir, fs, os, path, { spawnSync } (+15 more)

### Community 148 - "dashboard/cards.js"
Cohesion: 0.35
Nodes (11): bumpUsage(), appendTileIcon(), applyWidgetStatus(), createCard(), statusTitle(), updateStatusIndicators(), serviceUsageKey(), effectiveStatus() (+3 more)

### Community 149 - "js/config/plugin-prefs.js"
Cohesion: 0.28
Nodes (15): normalizeHostMonitoring(), pluginMonitoring(), cleanPath(), FIELD_KEY_PATTERN, fieldValue(), hasValue(), LEGACY_KEYS, listValue() (+7 more)

### Community 150 - "Registry"
Cohesion: 0.15
Nodes (11): Registry, checkClient(), fs, kindOf(), main(), os, path, { pathToFileURL } (+3 more)

### Community 152 - "manifest.js"
Cohesion: 0.45
Nodes (9): bounded(), plain(), textKey(), validateFiles(), validateSettingField(), validateSettings(), validateSubField(), validateSupervisionManifest() (+1 more)

### Community 153 - "lib/config/plugin-prefs.js"
Cohesion: 0.44
Nodes (9): cleanPath(), fieldValue(), hasValue(), LEGACY_KEYS, listValue(), plain(), preservePrefs(), sanitizePluginSettings() (+1 more)

### Community 155 - "preserve.js"
Cohesion: 0.40
Nodes (9): cardIdentity(), find(), keysOf(), locate(), restore(), selectionInside(), snapshot(), typeOf() (+1 more)

### Community 156 - "opencode-report.test.js"
Cohesion: 0.20
Nodes (9): assert, bin, dir, fs, os, path, period, report (+1 more)

### Community 157 - "dashboard/web-links.js"
Cohesion: 0.29
Nodes (10): compactCount(), linkCounterValue(), safeHref(), linkCounterText(), renderWebLinks(), updateWebLinkCounters(), updateWebLinksAppearance(), webLinksEnabledSelect (+2 more)

### Community 159 - "supervision-registry.js"
Cohesion: 0.36
Nodes (6): assetUrl(), injectStyles(), listSupervisionPlugins(), loadSupervisionRegistry(), metas, renderers

## Knowledge Gaps
- **3 isolated node(s):** `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1372 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Extend Dashmon` connect `opencode-widget.test.js` to `README.md`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `sanitizeText()` (e.g. with `createHostMetrics()` and `lib/sanitize.js`) actually correct?**
  _`sanitizeText()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `WidgetCore` be split into smaller, more focused modules?**
  _Cohesion score 0.10638297872340426 - nodes in this community are weakly interconnected._
- **Why does `t()` connect `pairing-list.js` to `app.js`, `render.js`, `widget-registry.js`, `i18n.js`, `dashboard/cards.js`, `js/themes.js`, `dashboard/web-links.js`, `editor.js`, `hosts.js`, `supervision.js`, `supervision/format.js`, `fortune-bar.js`, `services.js`, `plugin-card.js`, `dom.js`, `speedtest-card.js`, `js/metrics.js`, `usage-card.js`, `t`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11265969802555169 - nodes in this community are weakly interconnected._
- **Why does `client.mjs` connect `opencode-widget.test.js` to `createSpeedtest`, `speedtest-card.js`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._