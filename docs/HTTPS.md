# HTTPS with nginx

Dashmon speaks HTTP inside its container. To serve the dashboard over HTTPS, put
**nginx in front of Dashmon**: nginx presents the certificate and forwards the
requests to Dashmon on the loopback interface.

This guide covers the simplest case: nginx installed on the same machine as
Docker. A variant with nginx in Docker is shown at the end of the page.

## Before you start

- Dashmon already runs and answers on port `8080`
  (see [Install Dashmon](DEMARRAGE.md)).
- A DNS name points to the machine:
  - public name: `dashmon.example.com`, usable with Let's Encrypt;
  - local name: `dashmon.exemple.lan`, usable with an internal certificate.
- Ports **80** and **443** are reachable from the devices that must open
  Dashmon. Port `8080` must no longer be exposed to the outside.

Replace `dashmon.example.com` with your real name in every command below. For a
local name, replace it with `dashmon.exemple.lan` and follow the
"Certificate for a local name" section.

## 1. Prepare Dashmon

In the Dashmon stack:

1. Publish the port on the loopback interface only:
   `127.0.0.1:8080:8080` instead of `8080:8080`. nginx, installed on the same
   machine, will be the only one able to reach Dashmon.
2. Add the `TRUST_PROXY` variable with the value `1`. Without it, Dashmon does
   not know the request arrives over HTTPS: the session cookie is not marked
   `Secure` and the real client address is lost.
3. Redeploy the stack.

With Docker Compose, the two lines should look like this:

```yaml
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      TRUST_PROXY: "1"
      # ... your other variables
```

In Portainer, change the **Ports** field and add `TRUST_PROXY` under
**Environment variables**, then **Update the stack**.

Check that Dashmon still answers locally:

```sh
curl http://127.0.0.1:8080/healthz
```

The response must contain `{"ok":true}`. If it fails, fix this first: nginx
cannot do better.

## 2. Install nginx and certbot

On Debian, Ubuntu or Raspberry Pi OS:

```sh
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

If a default site already occupies port 80 and you do not need it:

```sh
sudo rm -f /etc/nginx/sites-enabled/default
```

## 3. Configure the HTTP proxy

Create the file `/etc/nginx/sites-available/dashmon.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dashmon.example.com;

    # PNG icon upload: the limit must stay above 10 MB.
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8080;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

Enable the site and reload nginx:

```sh
sudo ln -sf /etc/nginx/sites-available/dashmon.conf /etc/nginx/sites-enabled/dashmon.conf
sudo nginx -t
sudo systemctl reload nginx
```

Now open `http://dashmon.example.com`: the Dashmon login page must appear. If
you see the "Welcome to nginx" page, the default site is still active: remove
the link shown in step 2.

## 4. Add the certificate

### Public name: Let's Encrypt

With a name that exists in public DNS and a port 80 reachable from the Internet,
certbot does everything: certificate, HTTPS and HTTP → HTTPS redirection.

```sh
sudo certbot --nginx -d dashmon.example.com
```

Answer the questions by choosing the **redirect** to HTTPS. Certbot edits the
nginx file itself. Then check the automatic renewal:

```sh
sudo certbot renew --dry-run
```

Certbot installs a systemd timer; no extra cron job is needed.

### Local name: internal certificate

Let's Encrypt cannot issue a certificate for a name that only exists on your
local network (`.lan`, `.home`, `.local`…). Use a self-signed certificate, or
better, an internal authority (for example `mkcert`) if you want to avoid the
browser warning on several devices.

Self-signed example, to copy as is and adapt the name:

```sh
sudo mkdir -p /etc/nginx/tls
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout /etc/nginx/tls/dashmon-key.pem \
  -out /etc/nginx/tls/dashmon.pem \
  -subj "/CN=dashmon.exemple.lan" \
  -addext "subjectAltName=DNS:dashmon.exemple.lan"
sudo chmod 600 /etc/nginx/tls/dashmon-key.pem
```

Then replace the contents of `/etc/nginx/sites-available/dashmon.conf` with:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dashmon.exemple.lan;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name dashmon.exemple.lan;

    ssl_certificate     /etc/nginx/tls/dashmon.pem;
    ssl_certificate_key /etc/nginx/tls/dashmon-key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8080;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

Reload nginx:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

The browser shows a warning until the certificate is approved. Import
`/etc/nginx/tls/dashmon.pem` on the devices concerned, or use an internal
authority already trusted there. **Do not add a permanent browser exception**
and do not disable TLS verification.

> Do not enable HSTS with a self-signed certificate: the browser would then
> force HTTPS for this name, with no simple way back. HSTS is only useful when
> the certificate is valid and renewed automatically, for example with Let's
> Encrypt.

## 5. Check

1. Open `https://dashmon.example.com`: the padlock must appear.
2. Sign in: the session must stay active after a reload.
3. In the browser tools, check that the session cookie carries the `Secure`
   attribute.
4. From the server:

   ```sh
   curl -I https://dashmon.example.com
   sudo ss -ltnp | grep 8080
   ```

   The first command must answer `200` or `302`. The second must show
   `127.0.0.1:8080`, not `0.0.0.0:8080`.

## Using Dashmon with HTTPS agents

The primary reaches an agent from **its server**, not from the browser. If the
agent is also served over HTTPS:

- in **Settings → Pairing**, enter the full address, for example
  `https://agent.exemple.lan:8443`; without a scheme, Dashmon adds `http://`;
- the agent certificate must be trusted by the **primary**. For an internal
  authority, mount its certificate and set `NODE_EXTRA_CA_CERTS`
  (see [Private CA certificates](../deploy/DEPLOYMENT.md#7-private-ca-certificates));
- avoid `DASHBOARD_INSECURE_TLS=1`, which disables verification for all
  outgoing traffic from the primary.

An agent reachable only on a trusted network may stay on HTTP. Never expose it
directly to the Internet.

## Variant: nginx in Docker

If you prefer to keep nginx in Docker, put it on the same network as Dashmon and
stop publishing the Dashmon port:

```yaml
services:
  dashmon:
    image: supersouris7/dashmon:unstable
    container_name: dashmon
    restart: unless-stopped
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    expose:
      - "8080"
    environment:
      DASHMON_PASSWORD: ${DASHMON_PASSWORD:?Set DASHMON_PASSWORD}
      TRUST_PROXY: "1"
    volumes:
      - dashmon-data:/app/data

  nginx:
    image: nginx:alpine
    container_name: dashmon-nginx
    restart: unless-stopped
    depends_on:
      - dashmon
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./dashmon.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro

volumes:
  dashmon-data:
```

In `./dashmon.conf`, use the same `server` block as above, replacing
`proxy_pass http://127.0.0.1:8080;` with:

```nginx
        proxy_pass http://dashmon:8080;
```

The certificates stay managed on the host (existing Let's Encrypt or internal
authority): mount the folder that contains them, then adapt the
`ssl_certificate` and `ssl_certificate_key` paths in `./dashmon.conf`. After a
renewal, reload nginx in the container:

```sh
docker exec dashmon-nginx nginx -s reload
```

The simplest first move to HTTPS, however, remains nginx installed directly on
the host: certbot manages the certificate and the renewal there without any
extra mount.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `502 Bad Gateway` | Is Dashmon running? `curl http://127.0.0.1:8080/healthz`. Is the published port really `127.0.0.1:8080:8080`? |
| `413 Request Entity Too Large` | Increase `client_max_body_size` in nginx (12 MB recommended for PNG icons). |
| Login loop or cookie not `Secure` | `TRUST_PROXY=1` is missing, or `X-Forwarded-Proto $scheme` is missing in nginx. Redeploy Dashmon after adding the variable. |
| "Welcome to nginx" page | The default site is still active: `sudo rm -f /etc/nginx/sites-enabled/default`, then reload nginx. |
| Certbot fails | The name must point to the server and port 80 must be reachable from the Internet. Check the DNS and the firewall. |
| Local certificate warning | The self-signed certificate is not trusted on this device. Import the certificate or use an internal authority. |
| The HTTPS agent is rejected | The primary does not trust the agent authority. Mount the certificate and use `NODE_EXTRA_CA_CERTS`; do not disable verification. |
| The renewal does not take effect | Reload nginx: `sudo systemctl reload nginx`, or `docker exec dashmon-nginx nginx -s reload` if nginx runs in a container. |

For the other environment variables, local DNS and private authority
certificates, see [deploy/DEPLOYMENT.md](../deploy/DEPLOYMENT.md).
