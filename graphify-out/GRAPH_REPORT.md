# Graph Report - dashmon  (2026-11-26)

## Corpus Check
- 316 files · ~185,532 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: .css 11, (none) 8, .example 2)

## Summary
- 3211 nodes · 6321 edges · 171 communities (147 shown, 24 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 384 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3cf94dd8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- WidgetCore
- js/themes.js
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
- widgets/_template/manifest.json
- opencode-widget.test.js
- sanitizeText
- gotify/manifest.json
- with
- environment
- agent-pairing.test.js
- en
- registry.js
- web/manifest.json
- ref_path
- apiError
- en
- manifest.js
- HTTPS with nginx
- speedtest.js
- en
- fr
- ref_url
- agent.test.js
- Dashmon widgets
- dashmon-agent
- server.js
- Dashmon
- lib/themes.js
- frontend.test.js
- app.js
- settings.test.js
- Dashmon — Docker deployment
- createSpeedtest
- ref_fs
- github/manifest.json
- usage-report.js
- AGENTS.md
- lichess/server.js
- youtube/server.js
- docker.js
- api-errors.js
- host-settings.js
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
- js/pages.js
- github/client.mjs
- description
- label
- supervision/cards.js
- metube/client.mjs
- ping/client.mjs
- qbittorrent/client.mjs
- web/server.js
- smart-dump.sh
- directories/client.mjs
- Install Dashmon and its agents
- config-parity.test.js
- APT updates
- SMART supervision
- services.js
- plugin-card.js
- apt-updates/manifest.json
- auth.test.js
- dom.js
- Dashmon architecture
- version.js
- session-routes.test.js
- browser.test.js
- config-repository.test.js
- en
- claude-team.test.js
- speedtest-card.js
- t
- directories/manifest.json
- js/config/normalize.js
- ref_crypto
- .prettierrc.json
- Extend Dashmon
- js/config/plugin-prefs.js
- lib/config/plugin-prefs.js
- updates
- replication-config.test.js
- widgets/opencode/client.mjs
- i18n.js
- Speed test
- OpenCode statistics
- opencode-stats.sh
- Claude Code statistics
- usage-card.js
- createAuth
- claude-stats.sh
- supervision-registry.js
- host-monitoring-draft.js
- script-versions.test.js
- client.js
- wireguard/report.js
- package.json
- dockerfile.test.js
- Host scripts
- directory-sizes.sh
- registerConfigRoutes
- createConfirmDialog
- render.js
- request-origin.js
- smart/manifest.json
- Directory sizes
- fr
- wireguard/manifest.json
- claude/manifest.json
- claude-team/manifest.json
- supervisions/opencode/manifest.json
- import-cycles.test.js
- editor.js
- createAgentPairing
- ref_os
- smart/report.js
- AgentTokenStore
- Registry
- ref_assert
- icons-routes.test.js
- js/format.js
- apt-updates/report.js
- supervision.js
- ping/server.js
- claude-team.sh
- duplicati/server.js
- demo.js
- browser-paths.mjs
- Dashmon — règles du projet
- Claude team
- Vision produit — Dashmon
- Tile widgets
- Testing
- report
- token-store.js
- identity.js
- adr/README.md
- État du projet — Dashmon

## God Nodes (most connected - your core abstractions)
1. `t()` - 123 edges
2. `sanitizeText()` - 40 edges
3. `fr` - 37 edges
4. `en` - 37 edges
5. `apiError()` - 36 edges
6. `WidgetCore` - 35 edges
7. `state` - 32 edges
8. `Registry` - 27 edges
9. `applyEditorChanges()` - 27 edges
10. `main()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `Host settings` --references--> `help()`  [INFERRED]
  docs/EXTENDING.md → public/js/editor/host-settings.js
- `client.mjs` --references--> `prefs()`  [INFERRED]
  docs/EXTENDING.md → lib/host/speedtest.js
- `server.js` --references--> `prefs()`  [INFERRED]
  docs/EXTENDING.md → lib/host/speedtest.js
- `client.mjs` --references--> `details()`  [INFERRED]
  docs/EXTENDING.md → public/js/supervision/speedtest-card.js
- `client.mjs` --references--> `card()`  [INFERRED]
  docs/EXTENDING.md → supervisions/_template/client.mjs

## Import Cycles
- None detected.

## Communities (171 total, 24 thin omitted)

### Community 0 - "WidgetCore"
Cohesion: 0.09
Nodes (22): createSecretCodec(), decryptSecret(), crypto, isEncryptedSecret(), isMaskedSecret(), maskSecret(), secretFingerprint(), localize() (+14 more)

### Community 1 - "js/themes.js"
Cohesion: 0.18
Nodes (22): patchConfig(), themeSelect, allThemes(), applyTheme(), applyThemeLabels(), buildThemeSelect(), currentTheme(), deleteCustomTheme() (+14 more)

### Community 2 - "supervisions.test.js"
Cohesion: 0.17
Nodes (13): SupervisionCore, browserSide(), bundledCards(), core(), fs, HOST, os, path (+5 more)

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

### Community 15 - "widgets/_template/manifest.json"
Cohesion: 0.06
Nodes (34): cacheKey, client, config, description, en, fr, apiToken, apiTokenConfigured (+26 more)

### Community 16 - "opencode-widget.test.js"
Cohesion: 0.13
Nodes (17): createUsageSource(), agentName(), agentOfService(), fromAgent(), usageReport(), KINDS, agents, assert (+9 more)

### Community 17 - "sanitizeText"
Cohesion: 0.21
Nodes (18): HOST_MONITORING_TYPES, sanitizeFortune(), sanitizeHostMonitoring(), sanitizeLinkCounter(), sanitizeSpeedtest(), SPEEDTEST_INTERVALS, WEB_LINK_COUNTER_TYPES, createConfigNormalizer() (+10 more)

### Community 18 - "gotify/manifest.json"
Cohesion: 0.06
Nodes (32): cacheKey, client, config, description, en, fr, empty, error (+24 more)

### Community 19 - "with"
Cohesion: 0.06
Nodes (35): if, needs, runs-on, steps, CHROMIUM_BIN, jobs, docker, test (+27 more)

### Community 20 - "environment"
Cohesion: 0.06
Nodes (32): cap_drop, container_name, dns, environment, image, ports, read_only, restart (+24 more)

### Community 21 - "agent-pairing.test.js"
Cohesion: 0.21
Nodes (15): agentSide(), assert, codec, dashboardSide(), express, fs, main(), metrics() (+7 more)

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
Cohesion: 0.12
Nodes (31): fs, os, path, assert, check(), finish(), ok(), path (+23 more)

### Community 26 - "apiError"
Cohesion: 0.21
Nodes (16): apiError(), crypto, findLocalHost(), registerAgentConfigRoutes(), failureReason(), registerAgentConfigProxy(), agentConfig(), registerAgentRoutes() (+8 more)

### Community 27 - "en"
Cohesion: 0.06
Nodes (30): client, description, en, fr, busy, cores, idle, load1 (+22 more)

### Community 28 - "manifest.js"
Cohesion: 0.45
Nodes (9): bounded(), plain(), textKey(), validateFiles(), validateSettingField(), validateSettings(), validateSubField(), validateSupervisionManifest() (+1 more)

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

### Community 33 - "ref_url"
Cohesion: 0.08
Nodes (17): assert, path, { pathToFileURL }, assert, element(), main(), path, { pathToFileURL } (+9 more)

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
Cohesion: 0.08
Nodes (27): AGENT_API_PATHS, agentApiFilter(), errorHandler(), notFound(), requestLog(), CONTENT_SECURITY_POLICY, securityHeaders(), startServer() (+19 more)

### Community 38 - "Dashmon"
Cohesion: 0.13
Nodes (15): Dashmon, Docker Compose, Docker (recommended), Documentation, First steps, From source, Icons, License (+7 more)

### Community 39 - "lib/themes.js"
Cohesion: 0.15
Nodes (23): fs, registerThemeRoutes(), fs, listThemeIds(), normalizeTheme(), OPTIONAL_VARIABLES, path, readTheme() (+15 more)

### Community 40 - "frontend.test.js"
Cohesion: 0.14
Nodes (18): assert, check(), COMPONENT_CSS, contains(), editorSource(), fs, importStateModules(), JS_DIR (+10 more)

### Community 41 - "app.js"
Cohesion: 0.06
Nodes (56): bumpUsage(), configConflict, configSaveChain, fetchConfig(), pendingConfigPatch, saveConfig(), setConfigRevision(), closeTopMenu() (+48 more)

### Community 42 - "settings.test.js"
Cohesion: 0.15
Nodes (14): fs, hostMetricsInterval(), path, readSettings(), assert, crypto, custom, defaults (+6 more)

### Community 43 - "Dashmon — Docker deployment"
Cohesion: 0.07
Nodes (35): 1. Run, 2. Environment variables, 3. Data, 4. Portainer stacks, 5. nginx (optional), 6. Verification, 7. Monitoring LAN domains (.lan, .local…), 8. Private CA certificates (+27 more)

### Community 44 - "createSpeedtest"
Cohesion: 0.35
Nodes (10): createSpeedtest(), nextAt(), prefs(), report(), run(), runNow(), slotFrom(), start() (+2 more)

### Community 45 - "ref_fs"
Cohesion: 0.11
Nodes (16): fs, path, pluginEnabled(), pluginPrefs(), withTimeout(), fs, path, Storage (+8 more)

### Community 46 - "github/manifest.json"
Cohesion: 0.20
Nodes (9): cacheKey, config, hidden, id, interval, probe, server, strings (+1 more)

### Community 47 - "usage-report.js"
Cohesion: 0.14
Nodes (22): activity(), count(), fs, models(), money(), normalizeUsagePeriod(), PERIODS, readUsageReport() (+14 more)

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
Cohesion: 0.10
Nodes (31): assert, check(), eacces(), http, pending, ref(), cachedResolved(), classifyDockerContainers() (+23 more)

### Community 52 - "api-errors.js"
Cohesion: 0.13
Nodes (17): API_ERRORS, resultError(), assert, main(), path, { pathToFileURL }, check(), check() (+9 more)

### Community 53 - "host-settings.js"
Cohesion: 0.14
Nodes (31): choicesField(), renderChoices(), field(), frequencyList(), generalSection(), guideLink(), help(), helpBox() (+23 more)

### Community 54 - "monitor.js"
Cohesion: 0.39
Nodes (7): createStatusMonitor(), checkService(), isDue(), runCycle(), linkCounterService(), linkCounterServices(), createScheduler()

### Community 56 - "screenshots.js"
Cohesion: 0.10
Nodes (38): CLAUDE_MODELS, compose(), crypto, dataUrl(), downloadIcons(), fakeHostMetrics(), fakeSpeedtest(), fakeStatus() (+30 more)

### Community 57 - "rate-limit.test.js"
Cohesion: 0.24
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

### Community 67 - "js/pages.js"
Cohesion: 0.20
Nodes (20): mobilePageBtn, mobilePageMenu, pageSwitchGroup, renderLive(), activeDashboardId(), applyPage(), button(), closeMobilePageMenu() (+12 more)

### Community 69 - "description"
Cohesion: 0.67
Nodes (3): description, en, fr

### Community 70 - "label"
Cohesion: 0.67
Nodes (3): label, en, fr

### Community 71 - "supervision/cards.js"
Cohesion: 0.19
Nodes (23): supervisionList, cardKey(), EXPANDABLE_CARDS, isExpanded(), setAllSmartDetails(), setExpanded(), toggleAllSmartDetails(), updateSmartCollapseButton() (+15 more)

### Community 79 - "directories/client.mjs"
Cohesion: 0.09
Nodes (28): aptUpdatesCard(), element(), aptHealth(), SOURCE, directoryCard(), directoryError(), directoryItem(), element() (+20 more)

### Community 87 - "Install Dashmon and its agents"
Cohesion: 0.18
Nodes (11): 1. Prepare the secrets, 2. Install the primary, 3. Install an agent, 4. Add WireGuard, SMART, APT or usage statistics, 5. Upgrade and back up, Choose your installation, Install Dashmon and its agents, Moving from a shared token (+3 more)

### Community 88 - "config-parity.test.js"
Cohesion: 0.12
Nodes (21): assert, check(), FIXTURES, main(), pairing, path, { pathToFileURL }, PLUGIN_SETTINGS (+13 more)

### Community 89 - "APT updates"
Cohesion: 0.40
Nodes (5): APT updates, Bind mount variant, Dashmon supervision, Installation, Schedule and reboot

### Community 90 - "SMART supervision"
Cohesion: 0.40
Nodes (5): Dashmon configuration, Installation, Scheduling, Security, SMART supervision

### Community 91 - "services.js"
Cohesion: 0.11
Nodes (43): errorText(), categorySelect(), getEditorHostNames(), hostSelect(), iconElement(), imageButton(), monitorControls(), optionsSelect() (+35 more)

### Community 92 - "plugin-card.js"
Cohesion: 0.26
Nodes (13): applyHostColor(), relativeAge(), reportDateText(), body(), cardContext(), makeExpandable(), pluginCard(), rowList() (+5 more)

### Community 93 - "apt-updates/manifest.json"
Cohesion: 0.08
Nodes (25): client, description, en, fr, files, report, guide, icon (+17 more)

### Community 94 - "auth.test.js"
Cohesion: 0.13
Nodes (11): crypto, fs, SessionStore, assert, dir, file, fs, login() (+3 more)

### Community 95 - "dom.js"
Cohesion: 0.06
Nodes (52): addServiceBtn, cancelBtn, closeBtn, closeImageLibraryBtn, editorCategoryFilter, editorHostFilter, editorSearch, editorTabImages (+44 more)

### Community 96 - "Dashmon architecture"
Cohesion: 0.33
Nodes (6): Browser, Checks, Dashmon architecture, Extension points, Overview, Server

### Community 97 - "version.js"
Cohesion: 0.39
Nodes (7): appIsMounted(), describeVersion(), fs, isMountedPath(), readMountPoints(), releaseLabel(), assert

### Community 98 - "session-routes.test.js"
Cohesion: 0.11
Nodes (22): createAuthFailures(), availableFileName(), decodeFileName(), express, fs, path, PNG_SIGNATURE, pngSize() (+14 more)

### Community 99 - "browser.test.js"
Cohesion: 0.15
Nodes (16): assert, children, crypto, dir, freePort(), fs, loopback, main() (+8 more)

### Community 100 - "config-repository.test.js"
Cohesion: 0.06
Nodes (38): crypto, DEFAULT_WEB_LINKS, ensureAgentLocalHost(), ensureHostIds(), fs, path, prepareDataDir(), runStartupMigrations() (+30 more)

### Community 101 - "en"
Cohesion: 0.05
Nodes (37): active, badge, configured, help, history, idle, inactive, inProgress (+29 more)

### Community 102 - "claude-team.test.js"
Cohesion: 0.06
Nodes (57): Creating a theme, Dashmon — Customization guide, Example, File format, Font Awesome icons (categories, hosts, web links), Fortune Cookie, Icons, Images (services) (+49 more)

### Community 103 - "speedtest-card.js"
Cohesion: 0.35
Nodes (11): rateText(), dateText(), details(), figure(), graph(), health(), msText(), pending (+3 more)

### Community 104 - "t"
Cohesion: 0.33
Nodes (13): agentHostSelect(), agentUrlInput(), button(), createPairingList(), render(), row(), setStatus(), TEST_FAILURES (+5 more)

### Community 105 - "directories/manifest.json"
Cohesion: 0.08
Nodes (25): client, description, en, fr, files, report, guide, icon (+17 more)

### Community 106 - "js/config/normalize.js"
Cohesion: 0.15
Nodes (25): DEFAULT_CATEGORIES, DEFAULT_DASHBOARDS, LINK_COUNTER_TYPES, normalizeCollapsed(), normalizeConfig(), normalizeDashboards(), normalizeExpandedKeys(), normalizeFortune() (+17 more)

### Community 107 - "ref_crypto"
Cohesion: 0.17
Nodes (16): createAgentToken(), current(), paired(), pairHandler(), presented(), saved(), valid(), write() (+8 more)

### Community 108 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): arrowParens, printWidth, trailingComma

### Community 109 - "Extend Dashmon"
Cohesion: 0.12
Nodes (18): Add a widget or a Supervision card, Before opening a pull request, Contributing to Dashmon, Conventions, Public repository: no personal data, Set up, Extend Dashmon, Host settings (+10 more)

### Community 110 - "js/config/plugin-prefs.js"
Cohesion: 0.30
Nodes (13): pluginMonitoring(), cleanPath(), FIELD_KEY_PATTERN, fieldValue(), hasValue(), LEGACY_KEYS, listValue(), plain() (+5 more)

### Community 111 - "lib/config/plugin-prefs.js"
Cohesion: 0.44
Nodes (9): cleanPath(), fieldValue(), hasValue(), LEGACY_KEYS, listValue(), plain(), preservePrefs(), sanitizePluginSettings() (+1 more)

### Community 112 - "updates"
Cohesion: 0.13
Nodes (14): default-days, dependency-type, dev-tools, dependency-name, versions, interval, updates, cooldown (+6 more)

### Community 113 - "replication-config.test.js"
Cohesion: 0.24
Nodes (7): createReplicationConfig(), sanitizeReplication(), associated(), sanitizeSyncUrl(), assert, result, { sanitizeReplication, sanitizeSyncUrl }

### Community 115 - "i18n.js"
Cohesion: 0.18
Nodes (13): init(), resolveLanguage(), refreshBar, UI_TEXT, manualRefresh(), pageHidden(), refreshStatus(), setRefreshPending() (+5 more)

### Community 116 - "Speed test"
Cohesion: 0.33
Nodes (6): Data used, How a test is measured, Settings, Several hosts on one Internet link, Speed test, Your own server: LibreSpeed

### Community 117 - "OpenCode statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Enable or hide the card, Installation, On an application tile, OpenCode statistics, Schedule

### Community 119 - "Claude Code statistics"
Cohesion: 0.33
Nodes (6): Bind mount variant, Claude Code statistics, Enable or hide the card, Installation, Schedule, What is counted

### Community 120 - "usage-card.js"
Cohesion: 0.21
Nodes (25): element(), smartNumberText(), commandLine(), scriptNotice(), activityChart(), activityDetails(), costText(), dailyActivity() (+17 more)

### Community 121 - "createAuth"
Cohesion: 0.36
Nodes (9): createAuth(), closeSession(), cookieValue(), openSession(), parseCookie(), setCookie(), sign(), validBasicAuth() (+1 more)

### Community 123 - "supervision-registry.js"
Cohesion: 0.33
Nodes (7): assetUrl(), injectStyles(), listSupervisionPlugins(), loadSupervisionRegistry(), metas, pluginSettingsSchemas(), renderers

### Community 124 - "host-monitoring-draft.js"
Cohesion: 0.33
Nodes (7): HOST_MONITORING_TYPES, normalizeLinkCounter(), normalizeSpeedtestPrefs(), SPEEDTEST_DEFAULT_INTERVAL, speedtestServer(), prepareEditorDraft(), serializeHostMonitoring()

### Community 125 - "script-versions.test.js"
Cohesion: 0.10
Nodes (28): createHostMetrics(), collect(), handle(), hostReport(), scriptVersions(), withPlugins(), localHostOf(), path (+20 more)

### Community 126 - "client.js"
Cohesion: 0.22
Nodes (14): open(), apiRequest(), blockedAddressError(), dns, getMaxBody(), getTimeout(), http, httpProbe() (+6 more)

### Community 127 - "wireguard/report.js"
Cohesion: 0.26
Nodes (10): byteCount(), fs, handshakeSeconds(), normalizePeer(), normalizeWireguard(), readWireguardDump(), collect(), assert (+2 more)

### Community 128 - "package.json"
Cohesion: 0.08
Nodes (26): unused, fs, path, devDependencies, eslint@10.14.0, @eslint/js@10.0.1, globals@17.14.0, prettier@3.9.10 (+18 more)

### Community 129 - "dockerfile.test.js"
Cohesion: 0.22
Nodes (7): assert, dockerfile, fs, http, path, server, { spawn, spawnSync }

### Community 131 - "Host scripts"
Cohesion: 0.20
Nodes (10): Automatic update, Cron in short, For contributors, Host scripts, Moving from the former locations, Quick start: dashmon-setup, Schedules, Update everything at once (+2 more)

### Community 133 - "registerConfigRoutes"
Cohesion: 0.36
Nodes (6): countsOf(), registerConfigRoutes(), flushUsage(), usageKey(), assert, main()

### Community 134 - "createConfirmDialog"
Cohesion: 0.50
Nodes (3): createConfirmDialog(), cancel(), open()

### Community 135 - "render.js"
Cohesion: 0.06
Nodes (80): compactCount(), linkCounterValue(), sanitizeTileColor(), appendTileIcon(), applyWidgetStatus(), createCard(), safeHref(), statusTitle() (+72 more)

### Community 136 - "request-origin.js"
Cohesion: 0.39
Nodes (6): defaultPort(), sameOrigin(), STATE_CHANGING, verifyRequestOrigin(), assert, check()

### Community 137 - "smart/manifest.json"
Cohesion: 0.08
Nodes (24): client, description, en, fr, default, env, files, dump (+16 more)

### Community 138 - "Directory sizes"
Cohesion: 0.40
Nodes (5): Directory sizes, Installation and selection, Permissions, Scheduling, Without Docker

### Community 139 - "fr"
Cohesion: 0.05
Nodes (37): active, badge, configured, help, history, idle, inactive, inProgress (+29 more)

### Community 140 - "wireguard/manifest.json"
Cohesion: 0.08
Nodes (24): client, description, en, fr, default, env, files, dump (+16 more)

### Community 141 - "claude/manifest.json"
Cohesion: 0.08
Nodes (23): client, description, en, fr, files, report, guide, icon (+15 more)

### Community 142 - "claude-team/manifest.json"
Cohesion: 0.10
Nodes (20): client, css, description, en, fr, guide, icon, id (+12 more)

### Community 143 - "supervisions/opencode/manifest.json"
Cohesion: 0.08
Nodes (23): client, description, en, fr, files, report, guide, icon (+15 more)

### Community 144 - "import-cycles.test.js"
Cohesion: 0.22
Nodes (9): assert, findCycle(), visit(), fs, listFiles(), path, PATTERNS, resolve() (+1 more)

### Community 145 - "editor.js"
Cohesion: 0.07
Nodes (69): DEFAULT_TAB_ICON, ICON_OPTIONS, addCategoryBtn, addDashboardBtn, addHostBtn, addWebLinkBtn, categoryEditor, configImportInput (+61 more)

### Community 146 - "createAgentPairing"
Cohesion: 0.52
Nodes (6): createAgentPairing(), pair(), pairOnce(), token(), withToken(), failure()

### Community 147 - "ref_os"
Cohesion: 0.06
Nodes (25): os, assert, bin, dir, fs, os, path, { spawnSync } (+17 more)

### Community 148 - "smart/report.js"
Cohesion: 0.30
Nodes (9): fs, normalizeSmartDisk(), readSmartDump(), smartAttribute(), smartNumber(), collect(), assert, disk (+1 more)

### Community 150 - "Registry"
Cohesion: 0.16
Nodes (5): extraRoot(), extraRoot(), Registry, loadRegistry(), main()

### Community 151 - "ref_assert"
Cohesion: 0.12
Nodes (13): assert, dir, fs, now, old, os, path, projects (+5 more)

### Community 152 - "icons-routes.test.js"
Cohesion: 0.29
Nodes (7): assert, express, fs, main(), os, path, PNG

### Community 153 - "js/format.js"
Cohesion: 0.53
Nodes (8): client.mjs, client.mjs, formatCompactCount(), formatCompactNumber(), formatDateTime(), formatNumber(), formatters(), localeOf()

### Community 154 - "apt-updates/report.js"
Cohesion: 0.31
Nodes (7): fs, nonnegativeInteger(), readAptUpdatesReport(), collect(), assert, read(), report

### Community 155 - "supervision.js"
Cohesion: 0.11
Nodes (29): supervisionPage, buildText(), HOST_METRICS_INTERVAL, GAP, layoutMasonry(), masonrySpan(), trackCount(), UNIT (+21 more)

### Community 156 - "ping/server.js"
Cohesion: 0.31
Nodes (6): check(), dns, net, parseTarget(), resolveTarget(), tcpConnect()

### Community 157 - "claude-team.sh"
Cohesion: 0.42
Nodes (7): agents(), declared(), last_model(), pick(), sessions(), claude-team.sh script, summary()

### Community 158 - "duplicati/server.js"
Cohesion: 0.39
Nodes (5): check(), computeStatus(), listBackups(), login(), parseDate()

### Community 159 - "demo.js"
Cohesion: 0.50
Nodes (4): RFC-5737, demoData(), LABELS, withDemo()

### Community 161 - "Dashmon — règles du projet"
Cohesion: 0.25
Nodes (7): Dashmon — règles du projet, Environnements, Pile et commandes de contrôle, Produit, Règles spécifiques, Stratégie de tests, Suivi

### Community 162 - "Claude team"
Cohesion: 0.29
Nodes (7): Bind mount variant, Claude team, Enable or hide the card, Hide the task titles, Installation, Schedule, What is shown

### Community 163 - "Vision produit — Dashmon"
Cohesion: 0.29
Nodes (6): Contraintes, Pour qui, Problème résolu, Proposition de valeur, Périmètre, Vision produit — Dashmon

### Community 164 - "Tile widgets"
Cohesion: 0.40
Nodes (5): Keeping a value over time, manifest.json, server.js, Serving a link: `defaultFor: "link"`, Tile widgets

### Community 165 - "Testing"
Cohesion: 0.50
Nodes (4): Testing, card(), duration(), status()

### Community 166 - "report"
Cohesion: 0.50
Nodes (4): files, report, default, env

### Community 167 - "token-store.js"
Cohesion: 0.40
Nodes (4): crypto, fs, importConfigTokens(), path

### Community 168 - "identity.js"
Cohesion: 0.40
Nodes (4): crypto, fs, loadAgentIdentity(), path

### Community 170 - "État du projet — Dashmon"
Cohesion: 0.40
Nodes (4): Dernières livraisons, Fonctionnement convenu (22/11), Prochaine action, État du projet — Dashmon

## Knowledge Gaps
- **3 isolated node(s):** `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1519 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Extend Dashmon` connect `Extend Dashmon` to `Tile widgets`, `Testing`, `README.md`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `sanitizeText()` (e.g. with `createHostMetrics()` and `lib/sanitize.js`) actually correct?**
  _`sanitizeText()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DEBIAN_FRONTEND`, `LC_ALL`, `RFC-5737` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `WidgetCore` be split into smaller, more focused modules?**
  _Cohesion score 0.09098039215686274 - nodes in this community are weakly interconnected._
- **Why does `t()` connect `t` to `js/themes.js`, `js/pages.js`, `render.js`, `supervision/cards.js`, `app.js`, `speedtest-card.js`, `supervision.js`, `editor.js`, `i18n.js`, `host-settings.js`, `usage-card.js`, `services.js`, `plugin-card.js`, `dom.js`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `en` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Why does `client.mjs` connect `js/format.js` to `Extend Dashmon`, `createSpeedtest`, `Testing`, `speedtest-card.js`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._