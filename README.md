# Décompte — électricité prosumer

Application web installable (PWA) qui estime le **décompte annuel d'électricité**
d'un prosumer wallon. Une fois sur l'écran d'accueil, elle s'ouvre en plein écran,
**fonctionne sans connexion**, et garde les données en local.

## Les quatre onglets

| Onglet | |
|---|---|
| **Décompte** | Le solde de fin d'année en tête, la plage où consommer, la saisie des index et la liste des relevés. |
| **Suivi** | Deux graphiques mensuels : année en cours et année précédente. |
| **Acomptes** | Les douze mois, chacun modifiable, avec le total et le solde. |
| **Tarifs** | Le décompte détaillé, puis tous les tarifs unitaires. |

## Fondations visuelles

Encre `#121A17`, papier `#F4F2EC`, accent `#0F5132` ; vert `#3F9A4E` pour le
prélèvement, orange `#E9930F` pour l'injection — assombri à `#B5730A` quand il
sert de texte sur blanc. Les deux se distinguent aussi par la clarté, pas
seulement par la teinte.

Pas de police téléchargée : l'app doit s'ouvrir hors connexion, donc la
hiérarchie tient au poids, à la taille et à la couleur. Chiffres en mono à
chasse tabulaire pour qu'ils ne dansent pas d'un rendu à l'autre. Icônes tracées
en SVG inline plutôt que des glyphes texte. Cartes en rayon 16, champs et
boutons 12, cibles tactiles à 44 px au minimum.

Le canevas de refonte : https://claude.ai/artifact/SELMHA2HL6t6oyz4LKjrYK

## Plages horaires

Réformées par la CWaPE au **1er janvier 2026**, identiques 7 jours sur 7 :

| | |
|---|---|
| Heures pleines | 7h–11h et 17h–22h |
| Heures creuses | 11h–17h et 22h–7h |

Le creux de midi est donc en heures **creuses** : c'est la fenêtre 11h–17h qui
capte le pic de production. L'app compare prélèvement et injection sur chaque
plage et désigne celle où l'injection dépasse le plus — c'est là qu'il y a de
l'énergie à absorber. Une période à cheval sur le 01/01/2026 mélange l'ancien et
le nouveau découpage ; l'app le signale.

La compensation additionne les deux plages : déplacer une consommation de l'une
à l'autre ne change pas le net facturé, mais consommer pendant la production
réduit le prélèvement brut, donc les frais de réseau.

## Périodes

Un décompte couvre **douze mois** à partir de la date de départ. En cours
d'année, les volumes sont ramenés à douze mois (× 365 / jours) ; sous 150 jours
l'app signale que la projection reste une projection.

## Installer sur le GSM

1. **Settings → Pages** → *Source : **GitHub Actions***
2. Le workflow déploie à chaque push sur `claude/gsm-installation-2wop8x`

Adresse : `https://cdricpl.github.io/Electricit-/`

| | |
|---|---|
| **Android / Chrome** | menu ⋮ → *Installer l'application* |
| **iPhone / Safari** | **Partager** → *Sur l'écran d'accueil* (depuis Safari) |

## Fichiers

| | |
|---|---|
| `index.html` | structure et styles ; charge `app.js?v=<version>` |
| `app.js` | calculs, rendu, stockage local ; porte `APP_VERSION` |
| `sw.js` | service worker : cache hors ligne |
| `manifest.webmanifest` | nom, icônes, plein écran |
| `icons/` | 192 / 512 / maskable / apple-touch |

## Mettre à jour

1. Modifier `index.html` ou `app.js`
2. **Incrémenter `APP_VERSION` et le `?v=` du `<script>`** — les deux identiques
3. Pousser

La page et son script sont servis **réseau d'abord** (seuls icônes et manifeste
restent en cache d'abord) : un téléphone en ligne récupère le nouveau code au
rechargement suivant.

## Sauvegarde

*Tarifs → Application → Sauvegarde* : export/import d'un `.json` contenant
relevés, tarifs et acomptes.

## Tarifs par défaut

Calés sur le décompte réel **05/07/2025 → 30/06/2026 (503,62 € TVAC)** : régler
la date de départ au 01/07/2025 redonne 504 €.
