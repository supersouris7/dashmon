# Dashmon — maintainer guide

Building and publishing images. **Users don't need this page.**

## Image and tags

Image: `supersouris7/dashmon`

| Tag | When |
| --- | --- |
| `unstable` | every push to `main` |
| `latest` + `vX.Y.Z` | every Git tag `v*.*.*` |

Publishing is automatic: [`.github/workflows/docker.yml`](../.github/workflows/docker.yml)
builds for `linux/amd64` and `linux/arm64` (buildx) and pushes to Docker Hub.
Required repository secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## Local build (test before pushing)

```bash
docker build -t supersouris7/dashmon:unstable .
docker run --rm -p 127.0.0.1:8080:8080 \
  -e DASHMON_PASSWORD=test -e DASHMON_MASTER_KEY="$(openssl rand -hex 32)" \
  supersouris7/dashmon:unstable
```

## Screenshots

The pictures of the README and of `docs/images/` are regenerated from fictional
data, never from a real installation:

```bash
CHROMIUM_BIN=chromium npm run screenshots
```

[`scripts/screenshots.js`](../scripts/screenshots.js) starts a throwaway Dashmon
on a temporary folder with the built-in example, fictional supervision reports
and a widget on each tile. Its only download is the application logos, from
[Dashboard Icons](https://dashboardicons.com/) at a fixed version. The browser answers the status and host metrics
requests itself with made-up values, so nothing of the machine running the
script appears. Check the pictures before committing them. The script needs
Chromium and is never run in CI.

## Manual push (emergency only)

```bash
docker login
docker tag supersouris7/dashmon:unstable supersouris7/dashmon:latest
docker push supersouris7/dashmon:unstable
docker push supersouris7/dashmon:latest
```

This fallback does not recreate the CI multi-architecture manifest or release
metadata. Prefer Git tags and the workflow for releases.
