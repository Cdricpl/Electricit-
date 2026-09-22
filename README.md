# Décompte — électricité prosumer

Application web installable (PWA) qui estime le **décompte annuel d'électricité**
d'un prosumer wallon : index HP/HC, compensation nette prélèvement − injection,
tarifs Luminus / ELIA / RESA / taxes, acomptes et solde.

Une fois installée sur le téléphone, elle s'ouvre en plein écran, **fonctionne
sans connexion**, et garde les données en local (rien n'est envoyé sur Internet).

## Les quatre onglets

| Onglet | Ce qu'il fait |
|---|---|
| **Décompte** | Saisie des index, prélèvement net de l'année en cours, total du décompte et solde. Une date règle le début de l'année contractuelle (par défaut le 01/07/2026) ; tout ce qui précède sert de point de départ. |
| **Suivi** | Deux graphiques mensuels seulement : année en cours et année précédente. |
| **Acomptes** | Les douze mois de l'année contractuelle, chacun modifiable, avec le total et le solde. |
| **Tarifs** | Le décompte détaillé poste par poste, puis tous les tarifs unitaires. |

## Surplus par plage

Ventile prélèvement et injection entre heures pleines et heures creuses, avec
l'écart de chaque plage et un détail mois par mois. Négatif = injecté en trop.

La facture n'additionne que la somme des deux plages, donc cette ventilation ne
change pas le net — elle dit **quand** le surplus se produit, c'est-à-dire quand
il y a de l'énergie à absorber.

Sur l'année 2025-2026 : **+247 kWh en HP** (prélevé en trop, semaine en journée)
et **−31 kWh en HC** (injecté en trop). L'injection est plus forte en heures
creuses (1 684 kWh) qu'en heures pleines (1 431 kWh) alors que les panneaux ne
produisent qu'en journée : chez RESA le week-end entier compte en heures creuses.

## L'onglet Équilibrer

Un simulateur compare les trois leviers à volume égal, avec les tarifs saisis :

| Levier | Effet sur le net | Ce qu'il rapporte |
|---|---|---|
| Déplacer de la nuit vers la journée | **aucun** | frais de réseau évités (≈ 11 c€/kWh) |
| Consommer moins au total | −1 kWh par kWh | énergie + taxes + frais de réseau (≈ 35 c€/kWh) |
| Produire plus | −1 kWh par kWh | énergie + taxes + ristorno (≈ 25 c€/kWh) |

Les montants s'adaptent à la position du net : une fois passé sous zéro, couper
la consommation ne rapporte plus l'énergie (déjà à zéro), seulement le réseau et
le rachat du surplus — d'où une chute de 35 à 16 c€/kWh. Viser **zéro** et non le
négatif : au-delà, un kWh injecté n'est racheté que ~2 c€ au lieu des ~22 c€
qu'il vaut en compensation.

## Ce que l'app dit sur heures pleines / heures creuses

La compensation additionne les deux plages : **déplacer une consommation des
heures creuses vers les heures pleines ne change pas le net.** Une machine
lancée le jour est alimentée par les panneaux — le prélèvement baisse, mais
l'injection baisse d'autant, et leur différence reste identique.

Ce qui change réellement le coût, c'est l'**autoconsommation** : chaque kWh
consommé pendant la production plutôt qu'injecté puis re-prélevé évite les frais
de réseau assis sur le prélèvement brut (transport, distribution, services,
taxes), moins le ristorno perdu sur l'injection. L'onglet Décompte calcule ce
gain depuis les tarifs saisis — de l'ordre de 11 c€/kWh avec les valeurs par
défaut, contre 22 c€/kWh pour un kWh de net.

Pour faire baisser le net lui-même, il n'y a que deux leviers : consommer moins
au total, ou produire plus.

## Périodes

La période d'un décompte est bornée à **douze mois** à partir de la date de
départ : des relevés plus récents alimentent le suivi, mais pas le décompte de
l'année écoulée. En cours d'année, les volumes sont ramenés à douze mois
(× 365 / nombre de jours) ; sous 150 jours l'app signale que l'estimation ignore
les saisons et reste peu fiable.

## Installer sur le GSM

L'app doit être publiée en HTTPS — ici via **GitHub Pages**.

1. **Settings → Pages** → *Source : **GitHub Actions***
2. Le workflow `.github/workflows/pages.yml` déploie à chaque push sur
   `claude/gsm-installation-2wop8x`

Adresse : `https://cdricpl.github.io/Electricit-/`

| Téléphone | Manip |
|---|---|
| **Android / Chrome** | menu ⋮ → *Installer l'application* — ou le bouton dans l'onglet *Tarifs* |
| **iPhone / Safari** | bouton **Partager** → *Sur l'écran d'accueil* (depuis Safari, pas Chrome) |

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | structure et styles |
| `app.js` | calculs, rendu, stockage local |
| `sw.js` | service worker : mise en cache pour le hors-ligne |
| `manifest.webmanifest` | nom, icônes, mode plein écran |
| `icons/` | icônes 192 / 512 / maskable / apple-touch |

## Mettre à jour l'app

1. Modifier `index.html` ou `app.js`
2. **Incrémenter `APP_VERSION`** en haut de `app.js` — sans ça, les téléphones
   déjà équipés gardent leur ancien cache
3. Pousser : GitHub Pages redéploie tout seul

Le bouton **Vérifier les mises à jour** (onglet *Tarifs*) force le rafraîchissement.

## Sauvegarde

Onglet *Tarifs* → **Application → Sauvegarder mes données** : export/import d'un
fichier `.json` contenant relevés, tarifs et acomptes. Utile avant de changer de
téléphone — effacer les données du site supprime tout.

## Tarifs par défaut

Calés sur le décompte réel **05/07/2025 → 30/06/2026 (503,62 € TVAC)** : régler
la date de départ sur le 01/07/2025 redonne 504 €. La réduction promo de 24 %
court jusqu'au 04/07/2026 ; la passer à 0 pour projeter l'année suivante.
