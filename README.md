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

## Graphique mensuel

Onglet **Suivi** : prélèvement (vert, vers le haut) et injection (orange, vers le
bas) mois par mois, sur le modèle de l'app du fournisseur. Fenêtre **6 mois /
12 mois / Tout**, navigation ‹ › dans le temps, et détail HP/HC sous le
graphique. Toucher une barre isole le détail de ce mois.

Chaque barre est l'écart entre deux relevés consécutifs, étiquetée par son mois
d'arrivée — les totaux du graphique correspondent donc exactement aux volumes du
décompte.

## Acomptes et solde

Onglet **Acomptes** : les mensualités versées au fournisseur. Deux montants par
défaut (premier acompte, acompte mensuel) remplissent la liste, et **chaque mois
reste modifiable individuellement** si le montant prélevé a changé — un mois
corrigé est signalé, avec un ↺ pour revenir au montant par défaut.

Le total alimente le **solde** affiché en bas du décompte et dans l'en-tête :

    décompte annuel estimé − acomptes versés = reste à payer (ou à rembourser)

Valeurs de départ : **45 €** le premier mois (juillet 2025), puis **60 €/mois**
sur 12 mois, soit 705 € — face à un décompte estimé de 504 €.

## Sauvegarde

Onglet *Tarifs* → **Application → Sauvegarder mes données** : export/import d'un
fichier `.json` contenant relevés, tarifs et acomptes. Utile avant de changer de téléphone —
effacer les données du site supprime tout.

## Tarifs par défaut

Calés sur le décompte réel **05/07/2025 → 30/06/2026 (503,62 € TVAC)**.
La réduction promo de 24 % court jusqu'au 04/07/2026 : la passer à 0 pour projeter
l'année suivante.
