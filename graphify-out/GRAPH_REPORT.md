# Graph Report - dashmon  (2026-11-14)

## Corpus Check
- 281 files · ~166,655 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 10, (none) 7, .example 2)

## Summary
- 2733 nodes · 5687 edges · 144 communities (123 shown, 21 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 331 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0e142e38`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- WidgetCore
- js/pages.js
- ref_fs
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
- services.js
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
- import-cycles.test.js
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
- supervision/cards.js
- Install Dashmon and its agents
- fortune-bar.js
- APT updates
- SMART supervision
- services.js
- plugin-card.js
- ref_assert
- opencode-widget.test.js
- dom.js
- Dashmon architecture
- host/metrics.js
- session-routes.test.js
- browser.test.js
- ref_fs
- pairing-list.js
- Themes
- config-parity.test.js
- registerAgentRoutes
- directory-card.js
- render.js
- auth.test.js
- .prettierrc.json
- version.js
- ref_os
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
- store.js
- t
- smart-report.js
- client.js
- wireguard-report.js
- devDependencies
- duplicati/server.js
- Host scripts
- directory-sizes.sh
- registerConfigRoutes
- confirm.js
- docker.test.js
- security-headers.test.js
- ping/server.js
- Directory sizes
- demo.js
- scripts
- ref_crypto
- identity.js
- system.js

## God Nodes (most connected - your core abstractions)
1. `t()` - 135 edges
2. `apiError()` - 36 edges
3. `WidgetCore` - 35 edges
4. `state` - 34 edges
5. `sanitizeText()` - 33 edges
6. `element()` - 30 edges
7. `applyEditorChanges()` - 27 edges
8. `renderSupervision()` - 27 edges
9. `main()` - 26 edges
10. `install_one()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `client.mjs` --references--> `details()`  [INFERRED]
  docs/EXTENDING.md → public/js/supervision/speedtest-card.js
- `Add a widget or a Supervision card` --references--> `ctx()`  [INFERRED]
  CONTRIBUTING.md → test/opencode-widget.test.js
- `Quick start` --references--> `ctx()`  [INFERRED]
  docs/EXTENDING.md → test/opencode-widget.test.js
- `Testing` --references--> `core()`  [INFERRED]
  docs/EXTENDING.md → test/supervisions.test.js
- `client.mjs` --references--> `formatDateTime()`  [INFERRED]
  docs/EXTENDING.md → public/js/format.js

## Import Cycles
- None detected.

## Communities (144 total, 21 thin omitted)

### Community 0 - "WidgetCore"
Cohesion: 0.11
Nodes (16): createSecretCodec(), decryptSecret(), crypto, isEncryptedSecret(), isMaskedSecret(), maskSecret(), secretFingerprint(), extraRoot() (+8 more)

### Community 1 - "js/pages.js"
Cohesion: 0.10
Nodes (40): loadConfig(), setOpenMode(), setSearchOpen(), setToolbarHeight(), setGroupMode(), updateGroupModeMenu(), updateIconsButton(), updateOpenModeMenu() (+32 more)

### Community 2 - "ref_fs"
Cohesion: 0.06
Nodes (28): extraRoot(), fs, path, pluginEnabled(), SupervisionCore, withTimeout(), fs, path (+20 more)

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

### Community 16 - "services.js"
Cohesion: 0.05
Nodes (63): Add a widget or a Supervision card, Before opening a pull request, Contributing to Dashmon, Conventions, Public repository: no personal data, Set up, client.mjs, client.mjs (+55 more)

### Community 17 - "sanitizeText"
Cohesion: 0.22
Nodes (18): HOST_MONITORING_TYPES, sanitizeFortune(), sanitizeHostMonitoring(), sanitizeLinkCounter(), sanitizePluginPrefs(), sanitizeSpeedtest(), SPEEDTEST_INTERVALS, WEB_LINK_COUNTER_TYPES (+10 more)

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
Cohesion: 0.11
Nodes (30): configConflict, configSaveChain, fetchConfig(), patchConfig(), pendingConfigPatch, saveConfig(), setConfigRevision(), loadDemo() (+22 more)

### Community 22 - "en"
Cohesion: 0.04
Nodes (46): cacheKey, client, config, description, en, fr, cost, days30 (+38 more)

### Community 23 - "registry.js"
Cohesion: 0.21
Nodes (13): asLocalized(), FIELD_TYPES, fs, isPlainObject(), path, { pathToFileURL }, validateField(), validateManifest() (+5 more)

### Community 24 - "web/manifest.json"
Cohesion: 0.08
Nodes (23): cacheKey, defaultFor, description, en, fr, badProtocol, invalidUrl, name (+15 more)

### Community 25 - "ref_path"
Cohesion: 0.09
Nodes (35): Registry, fs, main(), os, path, assert, check(), finish() (+27 more)

### Community 26 - "request-origin.js"
Cohesion: 0.39
Nodes (6): defaultPort(), sameOrigin(), STATE_CHANGING, verifyRequestOrigin(), assert, check()

### Community 27 - "en"
Cohesion: 0.06
Nodes (30): client, description, en, fr, busy, cores, idle, load1 (+22 more)

### Community 28 - "import-cycles.test.js"
Cohesion: 0.22
Nodes (9): assert, findCycle(), visit(), fs, listFiles(), path, PATTERNS, resolve() (+1 more)

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
Cohesion: 0.06
Nodes (23): assert, path, { pathToFileURL }, assert, element(), main(), path, { pathToFileURL } (+15 more)

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
Cohesion: 0.10
Nodes (23): errorHandler(), notFound(), requestLog(), startServer(), log, registerHostMetricsRoutes(), express, fs (+15 more)

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
Nodes (34): resolveLanguage(), cancelBtn, closeBtn, configImportInput, demoConfigBtn, editorTitle, exportConfigBtn, importConfigBtn (+26 more)

### Community 42 - "settings.test.js"
Cohesion: 0.15
Nodes (14): fs, hostMetricsInterval(), path, readSettings(), assert, crypto, custom, defaults (+6 more)

### Community 43 - "Dashmon — Docker deployment"
Cohesion: 0.07
Nodes (35): 1. Run, 2. Environment variables, 3. Data, 4. Portainer stacks, 5. nginx (optional), 6. Verification, 7. Monitoring LAN domains (.lan, .local…), 8. Private CA certificates (+27 more)

### Community 44 - "createSpeedtest"
Cohesion: 0.38
Nodes (9): createSpeedtest(), nextAt(), prefs(), report(), run(), runNow(), start(), store() (+1 more)

### Community 45 - "icons.js"
Cohesion: 0.14
Nodes (18): availableFileName(), decodeFileName(), express, fs, path, PNG_SIGNATURE, pngSize(), registerIconRoutes() (+10 more)

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

### Community 52 - "api-errors.js"
Cohesion: 0.13
Nodes (17): API_ERRORS, resultError(), assert, main(), path, { pathToFileURL }, check(), check() (+9 more)

### Community 53 - "hosts.js"
Cohesion: 0.14
Nodes (39): DEFAULT_TAB_ICON, ICON_OPTIONS, createAgentSettings(), renderForm(), request(), renderCategoryEditor(), closeColorPalette(), createColorPicker() (+31 more)

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
Cohesion: 0.15
Nodes (22): supervisionList, supervisionPage, HOST_METRICS_INTERVAL, pageHidden(), cardIdentity(), find(), keysOf(), locate() (+14 more)

### Community 69 - "description"
Cohesion: 0.67
Nodes (3): description, en, fr

### Community 70 - "label"
Cohesion: 0.67
Nodes (3): label, en, fr

### Community 71 - "supervision/format.js"
Cohesion: 0.29
Nodes (17): bytesText(), handshakeAge(), handshakeText(), isMissing(), metricSeverity(), percentText(), relativeAge(), temperatureSeverity() (+9 more)

### Community 79 - "supervision/cards.js"
Cohesion: 0.27
Nodes (16): aptUpdatesCard(), aptHealth(), applyHostColor(), cardKey(), EXPANDABLE_CARDS, isExpanded(), setAllSmartDetails(), setExpanded() (+8 more)

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
Cohesion: 0.15
Nodes (22): addServiceBtn, editorCategoryFilter, editorHostFilter, editorSearch, serviceEditor, categorySelect(), hostSelect(), iconElement() (+14 more)

### Community 92 - "plugin-card.js"
Cohesion: 0.17
Nodes (17): reportDateText(), body(), cardContext(), pluginCard(), rowList(), cardView(), LEVELS, rows() (+9 more)

### Community 93 - "ref_assert"
Cohesion: 0.11
Nodes (13): assert, read(), report, assert, assert, config, normalize, assert (+5 more)

### Community 94 - "opencode-widget.test.js"
Cohesion: 0.13
Nodes (17): createUsageSource(), agentName(), agentOfService(), fromAgent(), usageReport(), KINDS, agents, assert (+9 more)

### Community 95 - "dom.js"
Cohesion: 0.05
Nodes (69): closeTopMenu(), gridSelects, headerObserver, openSettings(), PHONE, positionTopMenu(), searchBox, toolbar (+61 more)

### Community 96 - "Dashmon architecture"
Cohesion: 0.33
Nodes (6): Browser, Checks, Dashmon architecture, Extension points, Overview, Server

### Community 97 - "host/metrics.js"
Cohesion: 0.11
Nodes (30): fs, nonnegativeInteger(), readAptUpdatesReport(), ERRORS, fs, readDirectoryReport(), createHostMetrics(), collect() (+22 more)

### Community 98 - "session-routes.test.js"
Cohesion: 0.14
Nodes (12): createAuthFailures(), SessionStore, registerSessionRoutes(), recordFailure(), requireAuth(), tooManyAttempts(), assert, express (+4 more)

### Community 99 - "browser.test.js"
Cohesion: 0.14
Nodes (17): assert, children, crypto, dir, freePort(), fs, loopback, main() (+9 more)

### Community 100 - "ref_fs"
Cohesion: 0.11
Nodes (22): crypto, DEFAULT_WEB_LINKS, ensureAgentLocalHost(), ensureHostIds(), fs, path, prepareDataDir(), runStartupMigrations() (+14 more)

### Community 101 - "pairing-list.js"
Cohesion: 0.30
Nodes (12): agentHostSelect(), agentUrlInput(), button(), createPairingList(), render(), row(), setStatus(), TEST_FAILURES (+4 more)

### Community 102 - "Themes"
Cohesion: 0.17
Nodes (11): Creating a theme, Dashmon — Customization guide, Example, File format, Font Awesome icons (categories, hosts, web links), Fortune Cookie, Icons, Images (services) (+3 more)

### Community 103 - "config-parity.test.js"
Cohesion: 0.24
Nodes (9): assert, check(), FIXTURES, main(), pairing, path, { pathToFileURL }, SAME_KEYS (+1 more)

### Community 104 - "registerAgentRoutes"
Cohesion: 0.23
Nodes (12): AGENT_API_PATHS, agentApiFilter(), apiError(), crypto, findLocalHost(), registerAgentConfigRoutes(), registerAgentRoutes(), agentConfig() (+4 more)

### Community 105 - "directory-card.js"
Cohesion: 0.30
Nodes (12): directoryCard(), directoryError(), directoryItem(), head(), healthLine(), verdictOf(), directoryErrorKey(), directoryHealth() (+4 more)

### Community 106 - "render.js"
Cohesion: 0.06
Nodes (87): bumpUsage(), compactCount(), DEFAULT_CATEGORIES, DEFAULT_DASHBOARDS, HOST_MONITORING_TYPES, LINK_COUNTER_TYPES, linkCounterValue(), normalizeAptUpdatesPrefs() (+79 more)

### Community 107 - "auth.test.js"
Cohesion: 0.10
Nodes (25): createAuth(), closeSession(), cookieValue(), openSession(), parseCookie(), setCookie(), sign(), validBasicAuth() (+17 more)

### Community 108 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): arrowParens, printWidth, trailingComma

### Community 109 - "version.js"
Cohesion: 0.39
Nodes (7): appIsMounted(), describeVersion(), fs, isMountedPath(), readMountPoints(), releaseLabel(), assert

### Community 110 - "ref_os"
Cohesion: 0.05
Nodes (33): os, assert, bin, dir, fs, os, path, { spawnSync } (+25 more)

### Community 111 - "speedtest-card.js"
Cohesion: 0.35
Nodes (11): rateText(), dateText(), details(), figure(), graph(), health(), msText(), pending (+3 more)

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

### Community 123 - "store.js"
Cohesion: 0.12
Nodes (16): ConfigStore, crypto, fs, parseConfig(), path, readValid(), syncFolder(), writeDurably() (+8 more)

### Community 124 - "t"
Cohesion: 0.17
Nodes (30): SPEEDTEST_INTERVALS, directorySection(), field(), filterSection(), renderChoices(), frequencyList(), generalSection(), guideLink() (+22 more)

### Community 125 - "smart-report.js"
Cohesion: 0.36
Nodes (8): fs, normalizeSmartDisk(), readSmartDump(), smartAttribute(), smartNumber(), assert, disk, filesystem

### Community 126 - "client.js"
Cohesion: 0.22
Nodes (14): open(), apiRequest(), blockedAddressError(), dns, getMaxBody(), getTimeout(), http, httpProbe() (+6 more)

### Community 127 - "wireguard-report.js"
Cohesion: 0.29
Nodes (9): byteCount(), fs, handshakeSeconds(), normalizePeer(), normalizeWireguard(), readWireguardDump(), assert, filesystem (+1 more)

### Community 128 - "devDependencies"
Cohesion: 0.17
Nodes (14): unused, devDependencies, eslint@10.13.0, @eslint/js@10.0.1, globals@17.13.0, prettier@3.9.10, name, overrides (+6 more)

### Community 129 - "duplicati/server.js"
Cohesion: 0.39
Nodes (5): check(), computeStatus(), listBackups(), login(), parseDate()

### Community 131 - "Host scripts"
Cohesion: 0.20
Nodes (10): Automatic update, Cron in short, For contributors, Host scripts, Moving from the former locations, Quick start: dashmon-setup, Schedules, Update everything at once (+2 more)

### Community 133 - "registerConfigRoutes"
Cohesion: 0.36
Nodes (6): countsOf(), registerConfigRoutes(), flushUsage(), usageKey(), assert, main()

### Community 134 - "confirm.js"
Cohesion: 0.50
Nodes (3): createConfirmDialog(), cancel(), open()

### Community 135 - "docker.test.js"
Cohesion: 0.20
Nodes (12): assert, check(), eacces(), http, pending, ref(), dockerErrorBody(), dockerHostMode() (+4 more)

### Community 136 - "security-headers.test.js"
Cohesion: 0.38
Nodes (5): CONTENT_SECURITY_POLICY, securityHeaders(), assert, headers(), plain

### Community 137 - "ping/server.js"
Cohesion: 0.31
Nodes (6): check(), dns, net, parseTarget(), resolveTarget(), tcpConnect()

### Community 138 - "Directory sizes"
Cohesion: 0.40
Nodes (5): Directory sizes, Installation and selection, Permissions, Scheduling, Without Docker

### Community 139 - "demo.js"
Cohesion: 0.50
Nodes (4): RFC-5737, demoData(), LABELS, withDemo()

### Community 140 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, format, format:check, lint, plugin:check, screenshots, start, test (+1 more)

### Community 141 - "ref_crypto"
Cohesion: 0.29
Nodes (6): assert, codec, crypto, encrypted, unconfigured, value

### Community 142 - "identity.js"
Cohesion: 0.40
Nodes (4): crypto, fs, loadAgentIdentity(), path

### Community 143 - "system.js"
Cohesion: 0.50
Nodes (3): fs, path, version

## Knowledge Gaps
- **3 isolated node(s):** `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1242 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `t()` connect `hosts.js` to `js/pages.js`, `supervision.js`, `pairing-list.js`, `supervision/format.js`, `editor.js`, `render.js`, `directory-card.js`, `usage-card.js`, `supervision/cards.js`, `services.js`, `speedtest-card.js`, `js/metrics.js`, `js/themes.js`, `fortune-bar.js`, `services.js`, `t`, `dom.js`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `WidgetCore` be split into smaller, more focused modules?**
  _Cohesion score 0.10520487264673312 - nodes in this community are weakly interconnected._
- **Why does `Extend Dashmon` connect `services.js` to `README.md`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `js/pages.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09936575052854123 - nodes in this community are weakly interconnected._
- **Why does `client.mjs` connect `services.js` to `speedtest-card.js`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `ref_fs` be split into smaller, more focused modules?**
  _Cohesion score 0.06485671191553545 - nodes in this community are weakly interconnected._