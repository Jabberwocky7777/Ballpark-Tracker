# Deploying (placeholder version)

This is the committed, sanitized walkthrough. The version with real paths, ports, and hostnames is `docs/private/deploy.md`, which is gitignored and never leaves the machine.

Placeholders used below: `<POOL>`, `<CONFIG_DATASET>`, `<MEDIA_DATASET>`, `<APP_PORT>`, `<PUBLIC_HOSTNAME>`, `<APPS_USER_ID>`, `<PROXY_IP>`.

---

## 1. Create the datasets first

The Custom App wizard will **not** create them, and fixing paths after install is miserable.

In Storage → Datasets, create:

- `<POOL>/apps/ballpark` — config and the SQLite database
- `<POOL>/<MEDIA_DATASET>/Ballpark/originals` — write-once originals
- `<POOL>/<MEDIA_DATASET>/Ballpark/derived` — regenerable derivatives

Real datasets only. A folder created through an SMB share gets the wrong ownership and will block the container.

## 2. Set ACLs on each dataset

Custom Apps do not handle permissions automatically. `chmod` and `setfacl` are no-ops on ZFS NFSv4 ACLs — this has to happen in the UI.

For each of the three datasets: Storage → Datasets → Edit Permissions → add an entry with **ID Type = User**, **ID = `<APPS_USER_ID>`**, **Full Control**. Check **Apply recursively** and **Apply to child datasets**.

The image runs as that same uid on purpose. If the ACL grants a different id, the container starts, fails to write to `/config`, and dies applying migrations — which reads like a database fault rather than a permissions one.

## 3. Build and push the image

Handled by `.github/workflows/build.yml` on push to `main`. The image lands in GHCR. It contains no secrets — every value arrives as runtime env — so a public package is fine.

## 4. Install via the Custom App wizard

Apps → Discover Apps → Custom App.

- **Image:** the GHCR tag
- **Port:** container `3000` → node `<APP_PORT>`
- **Timezone:** use the wizard's TZ selector. Do **not** set a `TZ` env var.
- **PUID/PGID:** do not set. TrueNAS assigns them.

Storage — three host path mounts, each with **Enable ACL** checked:

| Host path | Mount |
|---|---|
| `<POOL>/apps/ballpark/data` | `/config` |
| `<POOL>/<MEDIA_DATASET>/Ballpark/originals` | `/photos/originals` |
| `<POOL>/<MEDIA_DATASET>/Ballpark/derived` | `/photos/derived` |

Environment — see `.env.example`. The only one you must set is `ADMIN_PASSWORD`: type a password straight into the field and the app hashes it with argon2id at startup. `SESSION_SECRET` can stay empty; the app generates one on first boot and keeps it in `DATA_DIR`, so logins survive restarts and updates.

## 5. Reverse proxy

New proxy host for `<PUBLIC_HOSTNAME>` → the NAS IP on `<APP_PORT>`. Request a Let's Encrypt cert and force SSL.

Because uploads go over Tailscale rather than through the proxy, the usual `client_max_body_size` and timeout tuning is not strictly required. Set it anyway as insurance — the values are in the private doc.

## 6. Verify before calling it done

- [ ] `https://<PUBLIC_HOSTNAME>/api/health` returns `{"ok":true,...}` with a non-zero venue count — that proves the config mount is writable and migrations ran
- [ ] `https://<PUBLIC_HOSTNAME>/` loads the map from a device **off** the tailnet
- [ ] `https://<PUBLIC_HOSTNAME>/admin` returns **404** from that same device
- [ ] `https://<PUBLIC_HOSTNAME>/api/upload` returns **404** from that same device
- [ ] `http://<nas-or-tailscale-address>:<APP_PORT>/admin` reaches the login from **on** the tailnet
- [ ] `exiftool` on any publicly served derivative shows no GPS and no timestamp
- [ ] A test upload writes to `/photos/originals` and the file is readable back
- [ ] The export endpoint produces a zip that opens

## 7. Then, immediately: backups

Do not import the photo backlog before this is done.

- Periodic snapshot tasks on the config and media datasets — hourly retain 48, daily retain 30
- Cloud sync task for the originals dataset plus a nightly DB dump
- Confirm a restore actually works before trusting it
