# CI setup: Android builds and releases

The workflow in `.github/workflows/android-release.yml` builds a signed Android APK entirely on GitHub Actions (no EAS or other third-party builder).

- Push to `main`: builds and replaces the `latest-main` pre-release.
- Push a tag like `v1.0.0`: builds and creates a full GitHub Release with generated notes.

You only need to do the steps below once.

## 1. Prerequisites

- Admin access to the GitHub repo (KuyaGit/ja1-uno).
- JDK 17 locally, only to run `keytool`:
  ```bash
  brew install --cask temurin@17
  keytool -help   # should print usage
  ```

## 2. Generate the release keystore

```bash
keytool -genkeypair -v -keystore release.keystore -alias ja1uno \
  -keyalg RSA -keysize 2048 -validity 10000
```

Prompts:
1. Keystore password: choose a strong one and write it down. This is `ANDROID_KEYSTORE_PASSWORD`.
2. Name, organization, city, country: anything reasonable.
3. Key password: press Enter to reuse the keystore password, or choose another. This is `ANDROID_KEY_PASSWORD`.

The alias (`ja1uno` above) is `ANDROID_KEY_ALIAS`.

## 3. Back up the keystore

Store `release.keystore` and both passwords in a password manager or private cloud storage. If you lose them, installed apps can never be updated in place. Never commit the keystore (`*.keystore` is in `.gitignore`).

## 4. Encode the keystore as base64

```bash
base64 -i release.keystore | pbcopy
```

The clipboard now holds the value for `ANDROID_KEYSTORE_BASE64`.

## 5. Add the repository secrets

GitHub repo > Settings > Secrets and variables > Actions > New repository secret.

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 output from step 4 |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password from step 2 |
| `ANDROID_KEY_ALIAS` | `ja1uno` (or the alias you chose) |
| `ANDROID_KEY_PASSWORD` | Key password from step 2 |

## 6. Allow Actions to create releases

Settings > Actions > General > Workflow permissions > select "Read and write permissions" > Save.

## 7. Confirm the default branch and Android package id

- Settings > Branches: the default branch should be `main`.
- `app.json` has `expo.android.package` set to `com.kuyagit.ja1uno`. This id is permanent once testers install the app, so change it now if you want a different one.

## 8. Trigger a test build

```bash
git push origin main
```

Watch the Actions tab. When it is green, the Releases page shows a `latest-main` pre-release with the APK attached. Every later push to `main` replaces it.

## 9. Cut a public release

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tag sets the app version, and a release named `v1.0.0` appears with generated notes and the APK.

## 10. How testers install the app

1. On the Android phone, open the repo's Releases page and download the `.apk`.
2. Allow "Install unknown apps" for the browser or file manager when prompted.
3. Open the file and install. Newer builds install over older ones because the versionCode rises on every run and the signing key stays the same.

## 11. Troubleshooting

- **"Missing secret for ..."**: a secret from step 5 is absent or misspelled.
- **apksigner fails or "Keystore was tampered with"**: wrong password or alias, or the base64 value was truncated. Re-run steps 4 and 5.
- **`expo prebuild` complains about the package name**: `expo.android.package` is missing in `app.json`.
- **"Resource not accessible by integration"**: step 6 is not done.
- **Gradle out-of-memory**: add `org.gradle.jvmargs=-Xmx4g` via `expo-build-properties` or a gradle.properties patch step.
- **Install blocked on the phone**: enable installs from unknown sources for the app you used to open the APK.
