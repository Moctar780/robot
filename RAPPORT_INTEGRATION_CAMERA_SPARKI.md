# Rapport d'intégration — Contrôle par caméra du robot Sparki

## Projet : `sparki_djelia`

Dépôt : `/home/moctar/Desktop/projets/arduino/sparki_djelia`  
Version : `0.1.0`  
Langage : Python 3.10+  
Dépendances clés : `opencv-python`, `mediapipe`, `pyserial`

---

## 1. Vue d'ensemble

Le module de contrôle par caméra (fichier `sparki_djelia/camera_control.py`) permet de piloter un robot **Sparki** via la reconnaissance de la main en temps réel à l'aide de **MediaPipe Hands**. La caméra du PC détecte l'index de l'utilisateur et convertit sa position ou direction en commandes série envoyées au robot sur port USB.

```
┌──────────────────┐    USB ( /dev/ttyACM0 )    ┌──────────────┐
│   Webcam PC      │                            │   Robot      │
│   MediaPipe ◄────┼──── OpenCV ───► série ────►│   Sparki     │
│   Mains → Index  │                            │              │
└──────────────────┘                            └──────────────┘
```

---

## 2. Architecture du module caméra

### 2.1 Structure des fichiers

```
sparki_djelia/
├── __init__.py              # Version 0.1.0
├── __main__.py              # Point d'entrée CLI (argparse)
├── camera_control.py        # Module de contrôle par caméra (⭐ cœur)
├── config.py                # Configuration (port, baud, clé API)
├── sparki.py                # Client série Sparki (connect/send/close)
├── commands.py              # Parsing des commandes vocales → Sparki
├── djelia_client.py         # Client HTTP API Djelia (transcription)
├── audio.py                 # Enregistrement et filtrage audio
├── similarity.py            # Dictionnaire de ressemblance (fuzzy matching)
└── data/
    └── word_similarity.json  # Intentions, mots et phrases multilingues
```

### 2.2 Modes de contrôle

Le module expose **deux modes** de contrôle par caméra, sélectionnables via `--control-mode` :

| Mode | Option CLI | Description |
|---|---|---|
| **Boutons virtuels** | `buttons` (défaut) | L'écran affiche des boutons ; placer l'index sur un bouton déclenche la commande |
| **Pointage directionnel** | `pointing` | La direction du doigt pointé (haut/bas/gauche/droite) détermine la commande |

### 2.3 Commandes disponibles

| Bouton / Direction | Commande série | Effet |
|---|---|---|
| `AVANCE` / Haut | `w` | Avance en continu |
| `RECULE` / Bas | `x` | Recule en continu |
| `GAUCHE` | `a` | Pivot gauche continu |
| `DROITE` | `d` | Pivot droit continu |
| `STOP` / Doigt absent | `s` | Arrêt immédiat |
| `OUVRIR` | `GO 1` | Ouvrir la pince (petits pas répétés) |
| `FERMER` | `GC 1` | Fermer la pince (petits pas répétés) |
| `STOP PINCE` | `GS` | Arrêter la pince |

---

## 3. Détail du pipeline de traitement image

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐
│ Capture  │───►│ Miroir (opt) │───►│ MediaPipe    │───►│ Boutons   │
│ Webcam   │    │ --mirror     │    │ Hands        │    │ ou        │
│ OpenCV   │    │              │    │ (21 landmarks)│   │ Pointage  │
└──────────┘    └──────────────┘    └──────────────┘    └─────┬─────┘
                                                              │
                                                              ▼
┌───────────┐    ┌──────────────┐    ┌───────────────────────┐
│ Robot     │◄───│ Série USB    │◄───│ Logique d'envoi       │
│ Sparki    │    │ (sparki.py)  │    │ (_send_if_needed)     │
└───────────┘    └──────────────┘    └───────────────────────┘
```

### 3.1 Capture et prétraitement

- Capture via `cv2.VideoCapture(camera_index)` (défaut : caméra 0)
- Miroir horizontal optionnel (`--mirror`) pour un contrôle naturel face à l'écran
- Conversion BGR → RGB pour MediaPipe
- Résolution native de la webcam (non modifiée par le script)

### 3.2 Détection de la main (MediaPipe Hands)

- **Paramètres** : `max_num_hands=1`, `model_complexity=0` (modèle léger), `min_detection_confidence=0.6` (configurable via `--min-confidence`)
- **Landmarks** : 21 points 3D par main
- **Performance** : Le modèle `model_complexity=0` privilégie la vitesse (~30 FPS sur CPU) au détriment d'une précision moindre par rapport à `model_complexity=1`

### 3.3 Classification de la direction

#### Mode boutons virtuels (`classify_button_direction`)

1. Les boutons sont disposés sur la partie droite de l'écran (croix directionnelle + STOP au centre), et sur la partie gauche (contrôle pince).
2. La position pixel de `landmarks[8]` (extrémité de l'index) est projetée sur l'image.
3. Si le point tombe dans un rectangle de bouton, la direction correspondante est renvoyée.
4. Si la main est absente (`landmarks is None`), renvoie `STOP`.

#### Mode pointage (`classify_pointing_direction`)

1. Vérifie d'abord que l'index est bien tendu via `is_index_pointing()` :
   - L'index doit être suffisamment long par rapport au poignet
   - L'index doit être plus long que sa phalange proximale
   - Au maximum 1 autre doigt peut être tendu (poing fermé avec index seulement)
2. Calcule l'angle du vecteur poignet → index par rapport à l'axe horizontal
3. Compare aux directions cardinales (droite=0°, haut=90°, gauche=180°, bas=-90°)
4. Applique une zone morte angulaire (`--dead-angle`, défaut 25°) : si l'angle s'écarte de plus de 25° de l'axe le plus proche, retourne `STOP`
5. Distance minimale poignet-index de 0.12 (en coordonnées normalisées) pour éviter les faux positifs

### 3.4 Logique d'envoi des commandes (`_send_if_needed`)

C'est le cœur intelligent de l'intégration :

| Condition | Action |
|---|---|
| La direction change (ex: AVANCE → GAUCHE) | Envoie la nouvelle commande |
| La direction reste identique (mouvement continu `w`/`x`/`a`/`d`) | N'envoie rien (évite de flooder le port série) |
| L'index est sur OUVRIR/FERMER | Envoie `GO 1`/`GC 1` toutes les 350 ms (petits pas répétés) |
| L'index **quitte** OUVRIR/FERMER | Envoie `GS` (arrêt pince) immédiatement |
| Main absente ou index hors bouton | Renvoie `STOP` (commande `s`) |

**Principe clé** : Le robot reçoit une nouvelle commande de déplacement **seulement quand la direction change**, ce qui évite les répétitions inutiles sur le port série.

### 3.5 Overlay visuel

Le module affiche en temps réel sur la fenêtre OpenCV :
- Les **landmarks** de la main avec les connexions MediaPipe
- Les **boutons virtuels** (mode `buttons`) avec surbrillance verte sur le bouton actif
- Une **flèche** du poignet vers l'index (couleur cyan)
- Le **texte de la commande** en cours en haut à gauche
- Un **texte d'aide** en bas (raccourcis clavier)

### 3.6 Raccourcis clavier

- `q` ou `Esc` : quitte la fenêtre et envoie `STOP` au robot (via le `session` context manager qui exécute `send("s")` dans son `finally`)

---

## 4. Interface de configuration

### 4.1 CLI (argparse)

```
python main.py camera [options]

Options:
  --camera INDEX        Index de la webcam (défaut: 0)
  --mirror              Image miroir (recommandé pour contrôle face à l'écran)
  --control-mode        buttons (défaut) | pointing
  --dead-angle DEG      Tolérance angulaire pour le pointage (défaut: 25°)
  --min-confidence VAL  Confiance MediaPipe (défaut: 0.6)
  --dry-run             Analyse sans envoyer au robot
  --no-sparki           Ne pas connecter le robot
```

### 4.2 Configuration robot (`.env`)

```
SPARKI_PORT=/dev/ttyACM0
SPARKI_BAUD=9600
```

---

## 5. Schémas de communication

### 5.1 Boucle principale (simplifiée)

```python
while True:
    ok, frame = cap.read()
    if mirror:
        frame = cv2.flip(frame, 1)

    # MediaPipe
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb)

    if results.multi_hand_landmarks:
        landmarks = hand_landmarks.landmark
        if mode == BUTTONS:
            direction = classify_button_direction(landmarks, frame_shape=frame.shape)
        else:
            direction = classify_pointing_direction(landmarks, dead_angle_deg=dead_angle)

    command = direction_to_sparki_cmd(direction)
    last_command, _ = _send_if_needed(sparki, direction=direction, command=command, ...)

    _draw_overlay(frame, landmarks, direction, command, mode)
    cv2.imshow("sparki_djelia camera", frame)
    # quit on 'q' or Esc
```

### 5.2 Protocole série

- **Port** : `/dev/ttyACM0` (par défaut)
- **Débit** : 9600 bauds
- **Format** : commande texte suivie de `\n`
- **Timeout lecture** : 10 secondes
- **Temps d'établissement** : 2 secondes après `serial.Serial()`
- **Flush** : `reset_input_buffer()` avant chaque envoi
- **Commandes sans réponse** : `w`, `x`, `a`, `d`, `s` (mouvements continus) — `expect_reply=False`

---

## 6. Dépendances et installation

### 6.1 Dépendances Python

```
pyserial>=3.5          # Communication USB avec le robot
opencv-python>=4.8.0   # Capture vidéo et overlay
mediapipe==0.10.21     # Détection de la main (version fixée)
numpy>=1.24.0          # Calculs matriciels
```

### 6.2 Installation

```bash
cd ~/Desktop/projets/arduino/sparki_djelia
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 6.3 Configuration minimale

```bash
cp .env.example .env
# Éditer SPARKI_PORT si nécessaire (ex: /dev/ttyUSB0)
```

---

## 7. Utilisation / exemples

```bash
# Mode boutons virtuels (défaut) + miroir
python main.py camera --mirror

# Test sans robot
python main.py camera --dry-run --mirror

# Mode pointage directionnel
python main.py camera --control-mode pointing --mirror

# Webcam différente + sensibilité plus élevée
python main.py camera --camera 1 --mirror --min-confidence 0.5

# Sans connexion au robot (overlay seulement)
python main.py camera --no-sparki --mirror
```

---

## 8. Détection de l'index (mode pointage)

La fonction `is_index_pointing()` utilise une heuristique géométrique sur les 21 landmarks MediaPipe :

```python
def is_index_pointing(landmarks) -> bool:
    wrist = landmarks[0]
    index_mcp = landmarks[5]   # Base de l'index
    index_pip = landmarks[6]   # Phalange intermédiaire
    index_tip = landmarks[8]   # Extrémité de l'index

    # 1. Longueur index > 12% de l'espace image
    # 2. Index tendu (distance poignet-tip > poignet-pip * 1.08)
    # 3. Phalange distale étendue (pip-tip > mcp-pip * 0.75)
    # 4. Au max 1 autre doigt tendu (poing fermé)
```

**Seuils ajustés empiriquement :**
- Longueur minimale : 0.12 (coordonnées normalisées [0,1])
- Rapport extension : 1.08× entre poignet-tip et poignet-pip
- Rapport phalange : 0.75× entre pip-tip et mcp-pip
- Autres doigts : max 1 doigt supplémentaire tendu (majeur, annulaire, auriculaire)

---

## 9. Disposition des boutons virtuels

```
┌──────────────────────────────────┐
│                                  │
│  ┌──────────┐      ┌───┐        │
│  │ OUVRIR   │      │ ▲ │        │
│  │          │   ┌──┼───┼──┐     │
│  │ FERMER   │   │ ◄│STO│ ►│     │
│  │          │   └──┼───┼──┘     │
│  │STOP PINCE │     │ ▼ │        │
│  └──────────┘      └───┘        │
│                                  │
│  [Boutons pince à gauche]        │
│  [Croix directionnelle à droite] │
│                                  │
└──────────────────────────────────┘
```

La taille des boutons s'adapte à la résolution de la webcam : `max(72, min(width, height) // 7)`.

---

## 10. Gestion des erreurs et cas limites

| Cas | Comportement |
|---|---|
| **Main absente** | `STOP` est envoyé (commande `s`) |
| **Index hors bouton** (mode buttons) | `STOP` |
| **Index trop court** (mode pointing) | `STOP` |
| **Angle hors zone morte** (mode pointing) | `STOP` |
| **Caméra inaccessible** | Message d'erreur et code retour 1 |
| **Dépendances manquantes** | Message d'installation, retour 1 |
| **Robot débranché** | Exception `RuntimeError` levée par `sparki.send()` |
| **Quitter (q/Esc)** | `STOP` automatique via context manager, `cap.release()` et `cv2.destroyAllWindows()` |

---

## 11. Performance et latence

| Facteur | Impact |
|---|---|
| `model_complexity=0` | Détection rapide (~30 FPS CPU), précision moindre |
| `min_confidence=0.6` | Bon équilibre détection/faux positifs |
| `_GRIPPER_REPEAT_SECONDS=0.35` | Intervalle de répétition des mouvements pince |
| Résolution webcam native | Plus la résolution est élevée, plus MediaPipe est lent |
| `cv2.flip()` miroir | Coût négligeable |

---

## 12. Points d'intégration avec le projet `hakilidia_bot`

| Point d'intégration | Description |
|---|---|
| **`packages/ai-service/`** | Le flux caméra pourrait être redirigé vers le service IA du bot pour analyse (YOLO, détection d'objets) |
| **`packages/sensor-service/`** | Les commandes caméra pourraient être enrichies par des données capteurs (IMU, distance) |
| **`packages/blockly-static/`** | Les blocs Blockly pourraient inclure un bloc « contrôle par caméra » générant du code Python compatible |
| **`BlocklyDuino-v2-react/`** | Interface React pour lancer/arrêter le mode caméra et visualiser le flux |

---

## 13. Limitations connues

| Limitation | Détail |
|---|---|
| **Résolution fixe** | Utilise la résolution native de la webcam — pas de configuration via l'API |
| **Single hand** | `max_num_hands=1` — une seule main détectée |
| **Modèle léger** | `model_complexity=0` peut rater des mains dans des conditions de faible éclairage |
| **Pas de tracking multi-doigts** | Seul l'index est utilisé pour le contrôle |
| **Latence pince** | Les "petits pas" à 350 ms peuvent sembler lents pour une fermeture complète |
| **Port série bloquant** | `serial.Serial` avec `timeout=10` — une perte de connexion peut bloquer 10 s |
| **Pas de calibration automatique** | Les seuils de détection (angles, distances) sont fixes dans le code |
| **MediaPipe version fixée** | `mediapipe==0.10.21` — une mise à jour pourrait casser l'API des landmarks |

---

## 14. Recommandations

1. **Ajouter un mode « fluage »** : remplacer les commandes discrètes `w`/`x`/`a`/`d` par des commandes proportionnelles (`M <vitesse> <vitesse>`) basées sur la distance doigt-bouton.
2. **Support multi-mains** : détecter main gauche pour la pince et main droite pour les déplacements.
3. **Intégration YOLO** : combiner MediaPipe (contrôle gestuel) avec YOLO (détection d'obstacles) pour une navigation semi-autonome.
4. **Configuration des seuils** : externaliser `dead_angle`, `min_confidence`, `gripper_repeat_seconds` dans le fichier `.env`.
5. **Calibration interactive** : guider l'utilisateur pour ajuster les seuils de pointage en fonction de la distance à la caméra.
6. **Flux réseau pour mobile** : exposer le flux caméra traité via HTTP (MJPEG) pour contrôle depuis l'interface React (SensaGram-like).

---

## 15. Références

| Fichier | Rôle |
|---|---|
| `sparki_djelia/camera_control.py` | Module principal de contrôle caméra (321 lignes) |
| `sparki_djelia/sparki.py` | Client série Sparki (connexion, envoi, session) |
| `sparki_djelia/__main__.py` | CLI — parsing des arguments, dispatch des modes |
| `sparki_djelia/config.py` | Configuration via `.env` |
| `sparki_djelia/commands.py` | Parsing des commandes vocales en séries |
| `sparki_djelia/similarity.py` | Dictionnaire de ressemblance fuzzy |
| `sparki_djelia/data/word_similarity.json` | Intentions et mots clés (FR + Bambara) |
| `README.md` | Documentation utilisateur |
| `requirements.txt` | Dépendances Python |
