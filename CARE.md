# CARE.md — guide développeur « IA Pros Santé »

Fork de [Jan](https://github.com/janhq/jan) transformé en assistant de rédaction
pour les professionnels autour de la santé (ergothérapeutes en premier).
Document de référence : `doc-technique_ia-pros-sante.md` (dossier parent du
dépôt, hors git). Branche de travail : `ia-pros-sante`.

Tout le code spécifique est préfixé **care** : `web-app/src/care/`,
`web-app/src/containers/Care*.tsx`, `src-tauri/src/core/care/`. Le reste du
dépôt est du Jan quasi intact — les mises à jour upstream restent faciles.

## Démarrer

```bash
corepack yarn install
corepack yarn dev          # tauri dev (app desktop, hot reload web)
```

Prérequis : Node 20+, Rust (`rustup`), yarn 4 via corepack. Sous Git Bash,
`cargo` n'est pas dans le PATH par défaut : `PATH="$HOME/.cargo/bin:$PATH"`.

Tests et vérifications :

```bash
cd web-app && corepack yarn vitest --run src/care    # tests unitaires care
```

```bash
cd web-app && corepack yarn tsc --noEmit             # typecheck
```

```bash
PATH="$HOME/.cargo/bin:$PATH" cargo check --manifest-path src-tauri/Cargo.toml
```

Échec connu et non lié : `TokenCounter.test.tsx` attend `'1,400'` mais un
Windows en locale française formate `'1 400'`. À ignorer.

## Architecture des fonctionnalités care

| Fonctionnalité | Fichiers clés |
|---|---|
| Activation par code (12 car., PBKDF2 + AES-GCM) | `web-app/src/care/activation.ts`, `useCareActivation.ts`, `containers/CareActivationScreen.tsx`, générateur `web-app/scripts/care-make-activation.mjs` |
| Provider Scaleway verrouillé | `web-app/src/care/lockedProvider.ts` |
| Projets métier (formulaires → thread) | `web-app/src/care/projects.ts`, `types.ts`, `buildPrompt.ts`, `defaults/<slug>/{project.yaml,system.md,template.md}`, `containers/CareProjectsGrid.tsx`, `CareProjectForm.tsx` |
| Projets sur disque (doc § 3) | commande Rust `care_list_projects`, `refreshCareProjects()` dans `projects.ts` |
| Mode avancé caché (UI Jan complète) | `web-app/src/care/useCareAdvancedMode.ts` (Ctrl/Cmd+Maj+A) |
| Export Word (.docx) | `web-app/src/care/exportDocx.ts`, `containers/CareExportButton.tsx`, commande Rust `write_file_base64` |
| Transcription audio locale (whisper.cpp) | `src-tauri/src/core/care/mod.rs` (commandes `care_whisper_status`, `care_provision_whisper`, `care_transcribe`), `web-app/src/care/whisper.ts`, `useWhisperInstall.ts` |
| Import audio + dictée micro | `containers/CareAudioTranscribeButton.tsx`, `CareDictationButton.tsx`, `web-app/src/care/recorder.ts` |

### Transcription : ce qui est téléchargé au premier usage

Dans `<données Jan>/care/whisper/` (en dev :
`%APPDATA%/Jan/data/care/whisper/`) :

- `bin/whisper-cli.exe` + DLL — release officielle
  [ggml-org/whisper.cpp b4938](https://github.com/ggml-org/whisper.cpp/releases/tag/b4938) ;
- `bin/ffmpeg.exe` — build officiel BtbN (lié depuis ffmpeg.org), variante
  LGPL statique ; sert uniquement à convertir le m4a (mémos iPhone) en WAV ;
- `models/ggml-<modèle>.bin` — huggingface.co/ggerganov/whisper.cpp.
  Choix selon la RAM (`whisperModelForRam`) : ≥ 12 Gio → `large-v3-turbo`,
  sinon `large-v3-turbo-q5_0` (~574 Mo, tient sur les postes 8 Go).

Formats acceptés : wav, mp3, ogg, flac (décodés nativement par whisper-cli)
et m4a (converti par ffmpeg). Tout est local, rien ne sort du poste.

## Vendre / activer un poste

1. Créer une clé API Scaleway dédiée au client.
2. Générer le blob et le code :

```bash
cd web-app && node scripts/care-make-activation.mjs --api-key sk-... --profession ergotherapeute --customer "Cabinet X" --out src/care/activation.blob.json
```

3. Le code s'affiche sur stderr — c'est lui qu'on remet au client (il n'est
   stocké nulle part). Builder ensuite l'app avec ce blob embarqué.
4. Au premier lancement, le client saisit le code ; la clé est injectée dans
   le provider verrouillé et vit dans le trousseau OS, jamais en clair.

Le dépôt contient un blob de développement chiffrant le placeholder
`REMPLACER-PAR-VRAIE-CLE-SCALEWAY` — aucune vraie clé n'est commitée.

## Reste à faire (humain)

- [ ] **Vérifier l'identifiant du modèle** dans le catalogue Scaleway :
  `CARE_MODEL_ID = 'deepseek-v4-flash'` dans
  `web-app/src/care/lockedProvider.ts` est un TODO.
- [ ] **Générer un vrai blob d'activation** avec une vraie clé (voir
  ci-dessus) avant tout build client.
- [ ] **Tester la dictée micro en réel** : la demande d'autorisation micro de
  WebView2 ne peut pas être automatisée, le flux n'a été validé que sur
  fichier audio.
- [ ] Packaging : nom produit, icônes, installeur (rebrand léger seulement
  pour l'instant).

## Projets sur disque

Déposer un dossier dans `<données Jan>/care/projects/<slug>/` avec
`project.yaml` (+ `system.md`, `template.md`) l'ajoute au catalogue au
prochain démarrage — même slug qu'un Projet embarqué : le disque gagne.
C'est le mécanisme « changement de config, pas de release » du § 3 de la
doc : on peut ajuster prompts et formulaires chez un client par simple
copie de fichiers. Un YAML invalide est ignoré (jamais d'écran vide).

## Reste à faire (dev, envisagé)

- Export PDF (doc § 2) — le .docx couvre le besoin immédiat.
