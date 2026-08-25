# Décompte — électricité prosumer

Application web installable (PWA) qui estime le **décompte annuel d'électricité**
d'un prosumer wallon : relevés d'index HP/HC, compensation nette
prélèvement − injection, tarifs Luminus / ELIA / RESA / taxes, total TVAC.

Une fois installée sur le téléphone, elle s'ouvre en plein écran, **fonctionne
sans connexion**, et garde les données en local (rien n'est envoyé sur Internet).

## Installer sur le GSM

L'app doit d'abord être publiée en HTTPS. Le plus simple : **GitHub Pages**.

### 1. Publier (à faire une fois)

1. Sur GitHub : **Settings → Pages**
2. *Build and deployment* → **Source : GitHub Actions**
3. Le workflow `.github/workflows/pages.yml` déploie à chaque push sur
   `claude/gsm-installation-2wop8x`. Le premier déploiement peut être lancé à la
   main via **Actions → Déployer sur GitHub Pages → Run workflow**.

L'adresse est alors : `https://cdricpl.github.io/Electricit-/`

### 2. Ajouter à l'écran d'accueil

Ouvrir cette adresse dans le navigateur du téléphone, puis :

| Téléphone | Manip |
|---|---|
| **Android / Chrome** | menu ⋮ → *Installer l'application* — ou le bouton **Installer sur l'écran d'accueil** dans l'onglet *Tarifs* |
| **iPhone / Safari** | bouton **Partager** → *Sur l'écran d'accueil* (à faire depuis Safari, pas Chrome) |

Après l'installation, l'app peut être ouverte hors connexion.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | l'application entière (interface, calculs, stockage local) |
| `sw.js` | service worker : mise en cache pour le hors-ligne |
| `manifest.webmanifest` | nom, icônes, mode plein écran |
| `icons/` | icônes 192 / 512 / maskable / apple-touch |

## Mettre à jour l'app

1. Modifier `index.html`
2. **Incrémenter `APP_VERSION`** (en haut du `<script>`) — sans ça, les téléphones
   déjà équipés gardent leur ancien cache
3. Pousser : GitHub Pages redéploie tout seul

Sur le téléphone, l'app récupère la nouvelle version au prochain lancement avec
du réseau. Le bouton **Vérifier les mises à jour** (onglet *Tarifs*) force le
rafraîchissement.

## Sauvegarde

Onglet *Tarifs* → **Application → Sauvegarder mes données** : export/import d'un
fichier `.json` contenant relevés et tarifs. Utile avant de changer de téléphone —
effacer les données du site supprime tout.

## Tarifs par défaut

Calés sur le décompte réel **05/07/2025 → 30/06/2026 (503,62 € TVAC)**.
La réduction promo de 24 % court jusqu'au 04/07/2026 : la passer à 0 pour projeter
l'année suivante.
