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
docker run --rm -p 8080:8080 supersouris7/dashmon:unstable
```

## Manual push (only if the workflow is unavailable)

```bash
docker login
docker tag supersouris7/dashmon:unstable supersouris7/dashmon:latest
docker push supersouris7/dashmon:unstable
docker push supersouris7/dashmon:latest
```

Prefer Git tags + the workflow for releases, so the multi-arch build stays correct.