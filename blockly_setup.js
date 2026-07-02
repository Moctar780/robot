// ──────────────────────────────────────────────
// 1. Blocs personnalisés
// ──────────────────────────────────────────────
// Blockly est chargé via les balises <script> dans index.html
// (blockly_compressed.js, blocks_compressed.js, javascript_compressed.js)

// Bloc : Avancer / Reculer
Blockly.Blocks['robot_move'] = {
    init: function () {
        this.appendDummyInput()
            .appendField('Faire')
            .appendField(
                new Blockly.FieldDropdown([
                    ['avancer', 'FORWARD'],
                    ['reculer', 'BACKWARD'],
                ]),
                'DIRECTION'
            )
            .appendField('le robot à la vitesse')
            .appendField(new Blockly.FieldNumber(50, 0, 200), 'SPEED');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
        this.setTooltip('Fait avancer ou reculer le robot à la vitesse choisie');
    },
};

// Bloc : Tourner les roues (direction)
Blockly.Blocks['robot_steer'] = {
    init: function () {
        this.appendDummyInput()
            .appendField('Tourner les roues vers la')
            .appendField(
                new Blockly.FieldDropdown([
                    ['gauche', 'LEFT'],
                    ['droite', 'RIGHT'],
                    ['tout droit', 'CENTER'],
                ]),
                'STEER'
            );
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(290);
        this.setTooltip('Oriente les roues directionnelles');
    },
};

// Bloc : Arrêter le robot
Blockly.Blocks['robot_stop'] = {
    init: function () {
        this.appendDummyInput().appendField('🛑 Arrêter le robot');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(0);
        this.setTooltip('Immobilise le robot');
    },
};

// Bloc : Attendre (pause)
Blockly.Blocks['robot_wait'] = {
    init: function () {
        this.appendDummyInput()
            .appendField('Attendre')
            .appendField(new Blockly.FieldNumber(1, 0, 60), 'SECONDS')
            .appendField('secondes');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(120);
        this.setTooltip('Insère une pause dans le programme');
    },
};

// Bloc : Avancer d'une distance (en mètres)
Blockly.Blocks['robot_move_distance'] = {
    init: function () {
        this.appendDummyInput()
            .appendField('Avancer de')
            .appendField(new Blockly.FieldNumber(5, 0.1, 100), 'DISTANCE')
            .appendField('mètres à la vitesse')
            .appendField(new Blockly.FieldNumber(100, 10, 200), 'SPEED');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
        this.setTooltip('Fait avancer le robot d\'une distance donnée');
    },
};

// Bloc : Tourner d'un angle (en degrés)
Blockly.Blocks['robot_turn_angle'] = {
    init: function () {
        this.appendDummyInput()
            .appendField('Tourner à')
            .appendField(
                new Blockly.FieldDropdown([
                    ['gauche', 'LEFT'],
                    ['droite', 'RIGHT'],
                ]),
                'DIRECTION'
            )
            .appendField('de')
            .appendField(new Blockly.FieldNumber(45, 1, 360), 'ANGLE')
            .appendField('degrés');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(290);
        this.setTooltip('Fait tourner le robot d\'un angle donné');
    },
};

// Bloc : Tourner à gauche (direction continue)
Blockly.Blocks['robot_turn_left'] = {
    init: function () {
        this.appendDummyInput()
            .appendField('↰ Tourner à gauche');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(290);
        this.setTooltip('Oriente les roues vers la gauche pour tourner');
    },
};

// Bloc : Tourner à droite (direction continue)
Blockly.Blocks['robot_turn_right'] = {
    init: function () {
        this.appendDummyInput()
            .appendField('↱ Tourner à droite');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(290);
        this.setTooltip('Oriente les roues vers la droite pour tourner');
    },
};

// Bloc : Aller tout droit
Blockly.Blocks['robot_go_straight'] = {
    init: function () {
        this.appendDummyInput()
            .appendField('↑ Aller tout droit');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
        this.setTooltip('Remet les roues en position droite');
    },
};

// ──────────────────────────────────────────────
// 2. Générateurs de code JavaScript
// ──────────────────────────────────────────────
// Note: les générateurs doivent être enregistrés sur .forBlock

Blockly.JavaScript.forBlock['robot_move'] = function (block) {
    const direction = block.getFieldValue('DIRECTION');
    const speed = block.getFieldValue('SPEED');
    const finalSpeed = direction === 'FORWARD' ? speed : -speed;
    return `window.setRobotSpeed(${finalSpeed});\n`;
};

Blockly.JavaScript.forBlock['robot_steer'] = function (block) {
    const steer = block.getFieldValue('STEER');
    let angle = 0;
    if (steer === 'LEFT') angle = 0.5;
    if (steer === 'RIGHT') angle = -0.5;
    return `window.setRobotSteering(${angle});\n`;
};

Blockly.JavaScript.forBlock['robot_stop'] = function () {
    return `window.setRobotSpeed(0); window.setRobotSteering(0);\n`;
};

Blockly.JavaScript.forBlock['robot_wait'] = function (block) {
    const seconds = block.getFieldValue('SECONDS');
    return `await window.robotWait(${seconds});\n`;
};

Blockly.JavaScript.forBlock['robot_move_distance'] = function (block) {
    const distance = block.getFieldValue('DISTANCE');
    const speed = block.getFieldValue('SPEED');
    return [
        `window.setRobotSpeed(${speed});`,
        `await window.robotWaitForDistance(${distance});`,
        `window.setRobotSpeed(0);`,
    ].join('\n');
};

Blockly.JavaScript.forBlock['robot_turn_angle'] = function (block) {
    const direction = block.getFieldValue('DIRECTION');
    const angle = block.getFieldValue('ANGLE');
    const steerAngle = direction === 'LEFT' ? 0.5 : -0.5;
    return [
        `window.setRobotSteering(${steerAngle});`,
        `window.robotResetTracking();`,
        `await window.robotWaitForAngle(${angle * Math.PI / 180});`,
        `window.setRobotSteering(0);`,
    ].join('\n');
};

Blockly.JavaScript.forBlock['robot_turn_left'] = function () {
    return `window.setRobotSteering(0.5);\n`;
};

Blockly.JavaScript.forBlock['robot_turn_right'] = function () {
    return `window.setRobotSteering(-0.5);\n`;
};

Blockly.JavaScript.forBlock['robot_go_straight'] = function () {
    return `window.setRobotSteering(0);\n`;
};

// ──────────────────────────────────────────────
// 3. Exécution Blockly (Run / Stop / Reset)
// ──────────────────────────────────────────────

let workspace = null;
let abortController = null;

export function initBlockly() {
    const blocklyDiv = document.getElementById('blocklyDiv');
    const toolbox = document.getElementById('toolbox');

    workspace = Blockly.inject(blocklyDiv, {
        toolbox: toolbox,
        scrollbars: true,
        trashcan: true,
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2,
        },
        grid: {
            spacing: 20,
            length: 3,
            colour: '#ccc',
            snap: true,
        },
    });
}

export function runBlocklyCode() {
    if (!workspace) return;

    // Fonction d'attente exposée globalement
    window.robotWait = (seconds) => {
        return new Promise((resolve) => {
            const checkAborted = () => {
                if (abortController && abortController.signal.aborted) {
                    resolve();
                    return;
                }
                setTimeout(resolve, seconds * 1000);
            };
            checkAborted();
        });
    };

    // Attendre que le robot ait parcouru une distance (en mètres)
    window.robotWaitForDistance = (targetDistance) => {
        return new Promise((resolve) => {
            window.robotResetTracking();
            const checkDistance = () => {
                if (abortController && abortController.signal.aborted) {
                    resolve();
                    return;
                }
                if (window.robotGetDistanceTraveled() >= targetDistance) {
                    resolve();
                    return;
                }
                requestAnimationFrame(checkDistance);
            };
            checkDistance();
        });
    };

    // Attendre que le robot ait tourné d'un angle (en radians)
    window.robotWaitForAngle = (targetAngle) => {
        return new Promise((resolve) => {
            const checkAngle = () => {
                if (abortController && abortController.signal.aborted) {
                    resolve();
                    return;
                }
                if (window.robotGetAngleTurned() >= targetAngle) {
                    resolve();
                    return;
                }
                requestAnimationFrame(checkAngle);
            };
            checkAngle();
        });
    };

    // Réinitialiser les commandes avant d'exécuter
    if (window.setRobotSpeed) window.setRobotSpeed(0);
    if (window.setRobotSteering) window.setRobotSteering(0);

    const code = Blockly.JavaScript.workspaceToCode(workspace);

    // Créer un signal d'annulation
    abortController = new AbortController();

    // Exécuter le code dans une async IIFE pour supporter await
    (async () => {
        try {
            const wrappedCode = `
                (async () => {
                    ${code}
                })();
            `;
            await eval(wrappedCode);
            console.log('Programme Blockly terminé.');
        } catch (e) {
            if (e.name === 'AbortError' || abortController?.signal.aborted) {
                console.log('Programme Blockly arrêté.');
            } else {
                console.error('Erreur Blockly :', e);
            }
        }
    })();

    console.log('Programme Blockly lancé.');
}

export function stopBlocklyCode() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    if (window.setRobotSpeed) window.setRobotSpeed(0);
    if (window.setRobotSteering) window.setRobotSteering(0);
    console.log('Programme Blockly arrêté.');
}

export function resetBlocklyWorkspace() {
    if (!workspace) return;
    stopBlocklyCode();
    workspace.clear();
}
