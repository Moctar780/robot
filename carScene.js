let havokInstance = null;
let tyreMaterial;
let scene;
let engine;

// Références pour le changement d'environnement
let envMeshes = [];
let envObstacles = [];
let currentEnvIndex = 0;

// ── API globale pour Blockly ──
let targetSpeed = 0;
let targetSteeringAngle = 0;
let vehicleType = 'car'; // 'car' | 'rover'

window.getVehicleType = () => vehicleType;
window.setVehicleType = (t) => { vehicleType = t; };

window.setRobotSpeed = function (speed) {
    targetSpeed = speed;
};

window.getRobotSpeed = function () {
    return targetSpeed;
};

window.setRobotSteering = function (angle) {
    targetSteeringAngle = angle;
};

// Suivi de position/direction pour les blocs distance et angle
window._carMesh = null;

window.robotAccumulatedDistance = 0;
window.robotAccumulatedAngle = 0;
window.robotLastPos = { x: 0, z: 0 };
window.robotLastAngle = 0;
window.robotTrackingInitialized = false;

/** Retourne la distance parcourue depuis le dernier reset */
window.robotGetDistanceTraveled = function () {
    return window.robotAccumulatedDistance || 0;
};

/** Retourne l'angle parcouru depuis le dernier reset */
window.robotGetAngleTurned = function () {
    return window.robotAccumulatedAngle || 0;
};

/** Réinitialise les compteurs de distance/angle */
window.robotResetTracking = function () {
    if (!window._carMesh) return;
    
    let currentAngle = 0;
    if (window._carMesh.rotationQuaternion) {
        const euler = window._carMesh.rotationQuaternion.toEulerAngles();
        currentAngle = euler.y;
    } else {
        currentAngle = window._carMesh.rotation.y;
    }
    
    window.robotAccumulatedDistance = 0;
    window.robotAccumulatedAngle = 0;
    window.robotLastPos = { x: window._carMesh.position.x, z: window._carMesh.position.z };
    window.robotLastAngle = currentAngle;
    window.robotTrackingInitialized = true;
};
// ──────────────────────────────

const debugColours = [];
debugColours[0] = new BABYLON.Color3(1, 0, 1);
debugColours[1] = new BABYLON.Color3(1, 0, 0);
debugColours[2] = new BABYLON.Color3(0, 1, 0);
debugColours[3] = new BABYLON.Color3(1, 1, 0);
debugColours[4] = new BABYLON.Color3(0, 1, 1);
debugColours[5] = new BABYLON.Color3(0, 0, 1);
const FILTERS = { CarParts: 1, Environment: 2 }

import { ENVIRONMENTS } from './environments.js';

async function createScene(canvas) {
    engine = new BABYLON.Engine(canvas);
    scene = new BABYLON.Scene(engine);

    havokInstance = new BABYLON.HavokPlugin(false);
    scene.enablePhysics(new BABYLON.Vector3(0, -240, 0), havokInstance);
    scene.getPhysicsEngine().setTimeStep(1 / 500);
    scene.getPhysicsEngine().setSubTimeStep(4.5);

    // Appliquer l'environnement initial (après activation de la physique)
    applyEnvironment(0);

    const camera = new BABYLON.FollowCamera("FollowCam", new BABYLON.Vector3(0, 10, -10), scene);
    camera.radius = 50;
    camera.heightOffset = 20;
    camera.rotationOffset = 180;
    camera.cameraAcceleration = 0.035;
    camera.maxCameraSpeed = 10;

    const hemisphericLight = new BABYLON.HemisphericLight("Hemispheric Light", new BABYLON.Vector3(1, 1, 0), scene);
    hemisphericLight.intensity = 0.7;

    InitTyreMaterial();
    const vehicle = CreateVehicle('car');
    camera.lockedTarget = vehicle;

    engine.runRenderLoop(() => {
        if (scene && scene.activeCamera) {
            scene.render();
        }
    });

    return scene;
}

// ── Création de véhicule (voiture ou rover) ──
function CreateVehicle(type) {
    if (type === 'rover') return CreateRover();
    return CreateCar();
}

// ── Création du rover (modèle simplifié à 1 seul corps physique) ──
function CreateRover() {
    const group = new BABYLON.TransformNode('RoverGroup');

    // Corps
    const body = BABYLON.MeshBuilder.CreateBox('Body', { height: 1.2, width: 6, depth: 10 });
    body.position = new BABYLON.Vector3(0, 0.6, 0);
    body.parent = group;

    // Panneau solaire
    const panel = BABYLON.MeshBuilder.CreateBox('Panel', { height: 0.1, width: 7, depth: 11 });
    panel.position = new BABYLON.Vector3(0, 1.25, 0);
    panel.parent = group;

    // Mât + capteur
    const mast = BABYLON.MeshBuilder.CreateCylinder('Mast', { height: 2, diameter: 0.2 });
    mast.position = new BABYLON.Vector3(0, 2.3, 0);
    mast.parent = group;
    const sensor = BABYLON.MeshBuilder.CreateSphere('Sensor', { diameter: 0.6 });
    sensor.position = new BABYLON.Vector3(0, 3.4, 0);
    sensor.parent = group;

    // 6 roues
    const wPos = [
        [3.5, 3.5], [-3.5, 3.5], [3.5, 0],
        [-3.5, 0], [3.5, -3.5], [-3.5, -3.5],
    ];
    for (const [x, z] of wPos) {
        const w = BABYLON.MeshBuilder.CreateCylinder('W', { height: 1, diameter: 2.5 });
        w.rotation = new BABYLON.Vector3(0, 0, Math.PI / 2);
        w.bakeCurrentTransformIntoVertices();
        w.position = new BABYLON.Vector3(x, 0, z);
        w.parent = group;
    }

    // Fusion en un seul mesh
    const merged = BABYLON.Mesh.MergeMeshes(group.getChildMeshes(), true, true);
    merged.position = new BABYLON.Vector3(0, 1.5, 0);
    merged.name = 'Rover';

    // Physique boîte simple
    const physicsShape = new BABYLON.PhysicsShapeBox(
        new BABYLON.Vector3(0, 0, 0),
        BABYLON.Quaternion.Identity(),
        new BABYLON.Vector3(6, 1.5, 10),
        scene
    );
    const physicsBody = new BABYLON.PhysicsBody(merged, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    physicsBody.setMassProperties({ mass: 600 });
    physicsShape.material = { restitution: 0.1, friction: 50 };
    physicsBody.shape = physicsShape;

    window._carMesh = merged;
    window.robotResetTracking();

    return merged;
}

// ── Changement d'environnement ──
function applyEnvironment(index) {
    // Nettoyer l'ancien environnement
    for (const m of envMeshes) {
        m.physicsBody?.dispose();
        m.dispose();
    }
    for (const m of envObstacles) {
        m.physicsBody?.dispose();
        m.dispose();
    }
    envMeshes = [];
    envObstacles = [];

    const env = ENVIRONMENTS[index];
    currentEnvIndex = index;

    // Fond
    scene.clearColor = new BABYLON.Color3(...env.skyColor);

    // Sol
    const groundMat = new BABYLON.StandardMaterial('GroundMat', scene);
    groundMat.diffuseColor = new BABYLON.Color3(...env.groundColor);
    if (env.groundTexture) {
        const tex = new BABYLON.Texture(env.groundTexture, scene);
        tex.uScale = env.groundTextureScale;
        tex.vScale = env.groundTextureScale;
        groundMat.diffuseTexture = tex;
    }
    const ground = BABYLON.MeshBuilder.CreateGround('Ground', { height: 500, width: 500 });
    ground.material = groundMat;
    ground.position = new BABYLON.Vector3(0, -10, 0);
    AddStaticPhysics(ground, env.friction, env.restitution);
    envMeshes.push(ground);

    // Murs
    const wallMat = new BABYLON.StandardMaterial('WallMat', scene);
    wallMat.diffuseColor = new BABYLON.Color3(...env.wallColor);
    const wallDefs = [
        { x: 0, z: 250, w: 500, d: 1 },
        { x: 0, z: -250, w: 500, d: 1 },
        { x: 250, z: 0, w: 1, d: 500 },
        { x: -250, z: 0, w: 1, d: 500 },
    ];
    for (const wd of wallDefs) {
        const wall = BABYLON.MeshBuilder.CreateBox('Wall', { height: 20, width: wd.w, depth: wd.d });
        wall.position = new BABYLON.Vector3(wd.x, 0, wd.z);
        wall.material = wallMat;
        AddStaticPhysics(wall, env.friction, env.restitution);
        envMeshes.push(wall);
    }

    // Obstacles
    for (const obs of env.obstacles) {
        if (obs.type === 'bump') {
            const bump = BABYLON.MeshBuilder.CreateCylinder('Bump', {
                height: obs.height, diameter: obs.size * 2,
            });
            bump.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
            AddStaticPhysics(bump, env.friction, env.restitution);
            envObstacles.push(bump);
        } else if (obs.type === 'ramp') {
            const ramp = BABYLON.MeshBuilder.CreateBox('Ramp', {
                width: obs.width, height: obs.height, depth: obs.depth,
            });
            ramp.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
            ramp.rotation.x = 0.3;
            ramp.bakeCurrentTransformIntoVertices();
            AddStaticPhysics(ramp, env.friction, env.restitution);
            envObstacles.push(ramp);
        } else if (obs.type === 'box') {
            const box = BABYLON.MeshBuilder.CreateBox('ObsBox', {
                width: obs.width, height: obs.height, depth: obs.depth,
            });
            box.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
            AddStaticPhysics(box, env.friction, env.restitution);
            envObstacles.push(box);
        }
    }
}

// Fonction publique pour changer d'environnement
window.switchEnvironment = function (index) {
    if (!scene || index < 0 || index >= ENVIRONMENTS.length) return;
    applyEnvironment(index);
};

// ── Création de la voiture (existante) ──
function CreateCar() {
    const carFrame = BABYLON.MeshBuilder.CreateBox("Frame", { height: 1, width: 12, depth: 24, faceColors: debugColours });
    carFrame.position = new BABYLON.Vector3(0, 0.3, 0);
    carFrame.visibility = 0.5;
    const carFrameBody = AddDynamicPhysics(carFrame, 1000, 0, 0);
    FilterMeshCollisions(carFrame);

    const flWheel = CreateWheel(new BABYLON.Vector3(5, 0, 8));
    const flAxle = CreateAxle(new BABYLON.Vector3(5, 0, 8));
    const frWheel = CreateWheel(new BABYLON.Vector3(-5, 0, 8));
    const frAxle = CreateAxle(new BABYLON.Vector3(-5, 0, 8));
    const rlWheel = CreateWheel(new BABYLON.Vector3(5, 0, -8));
    const rlAxle = CreateAxle(new BABYLON.Vector3(5, 0, -8));
    const rrWheel = CreateWheel(new BABYLON.Vector3(-5, 0, -8));
    const rrAxle = CreateAxle(new BABYLON.Vector3(-5, 0, -8));

    for (const mesh of [flAxle, frAxle, rlAxle, rrAxle]) {
        carFrame.addChild(mesh);
        AddAxlePhysics(mesh, 100, 0, 0);
        FilterMeshCollisions(mesh);
    }

    for (const mesh of [flWheel, frWheel, rlWheel, rrWheel]) {
        AddWheelPhysics(mesh, 100, 0.1, 50);
        FilterMeshCollisions(mesh);
    }

    const poweredWheelMotorA = CreatePoweredWheelJoint(flAxle, flWheel);
    const poweredWheelMotorB = CreatePoweredWheelJoint(frAxle, frWheel);
    CreateWheelJoint(rlAxle, rlWheel);
    CreateWheelJoint(rrAxle, rrWheel);

    const steerWheelA = AttachAxleToFrame(flAxle.physicsBody, carFrameBody, true);
    const steerWheelB = AttachAxleToFrame(frAxle.physicsBody, carFrameBody, true);
    AttachAxleToFrame(rlAxle.physicsBody, carFrameBody);
    AttachAxleToFrame(rrAxle.physicsBody, carFrameBody);

    InitKeyboardControls(poweredWheelMotorA, poweredWheelMotorB, steerWheelA, steerWheelB);

    // Exposer le mesh de la voiture pour le tracking Blockly
    window._carMesh = carFrame;
    window.robotResetTracking();

    return carFrame;
}

function CreateAxle(position) {
    const axleMesh = BABYLON.MeshBuilder.CreateBox("Axle", { height: 1, width: 2.5, depth: 1, faceColors: debugColours });
    axleMesh.position = position;

    return axleMesh;
}

function CreateWheel(position) {
    const faceUVforArrowTexture = [
        new BABYLON.Vector4(0, 0, 0, 0),
        new BABYLON.Vector4(0, 1, 1, 0),
        new BABYLON.Vector4(0, 0, 0, 0),
    ]

    const wheelMesh = BABYLON.MeshBuilder.CreateCylinder("Wheel", { height: 1.6, diameter: 4, faceUV: faceUVforArrowTexture });
    wheelMesh.rotation = new BABYLON.Vector3(0, 0, Math.PI / 2);
    // 
    // NOTE: The rotation of the wheel is baked here so that future rotations 
    // get a clean slate (makes setting up constraints much easier)
    //
    wheelMesh.bakeCurrentTransformIntoVertices();
    wheelMesh.position = position;

    wheelMesh.material = tyreMaterial;

    return wheelMesh;
}

function AttachAxleToFrame(axle, frame, hasSteering) {
    const aPos = axle.transformNode.position;

    const joint = new BABYLON.Physics6DoFConstraint(
        {
            pivotA: new BABYLON.Vector3(0, 0, 0),
            pivotB: new BABYLON.Vector3(aPos.x, aPos.y, aPos.z),
        },
        //
        // NOTE: The following limit settings provide suspension (axis LINEAR_Y), some angular leeway (ANGULAR_X, ANGULAR_Z), 
        // and freedom to steer if required (ANGULAR_Y)
        //
        [
            {
                axis: BABYLON.PhysicsConstraintAxis.LINEAR_X,
                minLimit: 0,
                maxLimit: 0,
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.LINEAR_Y,
                minLimit: -0.15,
                maxLimit: 0.15,
                stiffness: 100000,
                damping: 5000
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.LINEAR_Z,
                minLimit: 0,
                maxLimit: 0,
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_X,
                minLimit: -0.25,
                maxLimit: 0.25,
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Y,
                minLimit: hasSteering ? null : 0,
                maxLimit: hasSteering ? null : 0,
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
                minLimit: -0.05,
                maxLimit: 0.05,
            },
        ],
        scene
    );

    axle.addConstraint(frame, joint);

    if (hasSteering)
        AttachSteering(joint);

    return joint;
}

function CreateWheelJoint(axle, wheel) {
    const motorJoint = new BABYLON.Physics6DoFConstraint(
        {},
        [
            {
                axis: BABYLON.PhysicsConstraintAxis.LINEAR_DISTANCE,
                minLimit: 0,
                maxLimit: 0,
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Y,
                minLimit: 0,
                maxLimit: 0,
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
                minLimit: 0,
                maxLimit: 0,
            },
        ],
        scene
    );

    axle.addChild(wheel);
    axle.physicsBody.addConstraint(wheel.physicsBody, motorJoint);

    return motorJoint;
}

function CreatePoweredWheelJoint(axle, wheel) {
    const motorJoint = CreateWheelJoint(axle, wheel);

    motorJoint.setAxisMotorType(BABYLON.PhysicsConstraintAxis.ANGULAR_X, BABYLON.PhysicsConstraintMotorType.VELOCITY);
    //
    // NOTE: setAxisMotorMaxForce acts as torque here (strength of wheel getting to target speed)
    //
    motorJoint.setAxisMotorMaxForce(BABYLON.PhysicsConstraintAxis.ANGULAR_X, 180000);
    motorJoint.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_X, 0);

    return motorJoint;
}

function AttachSteering(joint) {
    joint.setAxisMotorType(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, BABYLON.PhysicsConstraintMotorType.POSITION);
    //
    // NOTE: setAxisMotorMaxForce acts like power steering here (strength of wheel getting to target steering angle)
    //
    joint.setAxisMotorMaxForce(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, 30000000);
    joint.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, 0);

    return joint;
}

function InitKeyboardControls(motorWheelA, motorWheelB, steerWheelA, steerWheelB) {
    let forwardPressed = false;
    let backPressed = false;
    let leftPressed = false;
    let rightPressed = false;
    let brakePressed = false;

    const maxSpeed = 150;
    const maxSteeringAngle = Math.PI / 6;

    scene.onKeyboardObservable.add(e => {
        switch (e.event.key) {
            case "w": case "W": case "ArrowUp": forwardPressed = e.type == BABYLON.KeyboardEventTypes.KEYDOWN ? true : false;
                break;
            case "s": case "S": case "ArrowDown": backPressed = e.type == BABYLON.KeyboardEventTypes.KEYDOWN ? true : false;
                break;
            case "a": case "A": case "ArrowLeft": leftPressed = e.type == BABYLON.KeyboardEventTypes.KEYDOWN ? true : false;
                break;
            case "d": case "D": case "ArrowRight": rightPressed = e.type == BABYLON.KeyboardEventTypes.KEYDOWN ? true : false;
                break;
            case " ": brakePressed = e.type == BABYLON.KeyboardEventTypes.KEYDOWN ? true : false;
                break;
        }
    });

    scene.onBeforeRenderObservable.add(() => {
        // Si une touche clavier est active, le clavier prend le contrôle
        if (leftPressed || rightPressed || forwardPressed || backPressed || brakePressed) {
            if (leftPressed && targetSteeringAngle < maxSteeringAngle) {
                targetSteeringAngle += 0.01;
            } else if (rightPressed && targetSteeringAngle > -maxSteeringAngle) {
                targetSteeringAngle -= 0.01;
            } else if (!leftPressed && !rightPressed) {
                targetSteeringAngle *= 0.98;
            }

            if (brakePressed) {
                targetSpeed = 0;
            } else if (forwardPressed && targetSpeed < maxSpeed) {
                targetSpeed += 8;
            } else if (backPressed && targetSpeed > -maxSpeed * 0.5) {
                targetSpeed -= 8;
            } else if (!forwardPressed && !backPressed) {
                targetSpeed *= 0.99;
            }
        }
        // Aucune touche active → les valeurs restent telles quelles
        // (Blockly ou dernière commande clavier)

        const [innerAngle, outerAngle] = CalculateWheelAngles(targetSteeringAngle);
        // Correction de la direction Ackermann : La roue gauche (A) est la roue intérieure quand on tourne à gauche, 
        // et la roue droite (B) est la roue extérieure. L'ancien code les avait inversées.
        steerWheelA.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, innerAngle);
        steerWheelB.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, outerAngle);

        motorWheelA.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_X, targetSpeed);
        motorWheelB.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_X, targetSpeed);

        // Mettre à jour le suivi de distance et d'angle si initialisé
        if (window._carMesh && window.robotTrackingInitialized) {
            let currentAngle = 0;
            if (window._carMesh.rotationQuaternion) {
                const euler = window._carMesh.rotationQuaternion.toEulerAngles();
                currentAngle = euler.y;
            } else {
                currentAngle = window._carMesh.rotation.y;
            }

            // Calculer delta angle et l'accumuler
            let deltaAngle = currentAngle - window.robotLastAngle;
            while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
            while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
            window.robotAccumulatedAngle += Math.abs(deltaAngle);
            window.robotLastAngle = currentAngle;

            // Calculer delta distance et l'accumuler (distance curviligne le long du trajet)
            const dx = window._carMesh.position.x - window.robotLastPos.x;
            const dz = window._carMesh.position.z - window.robotLastPos.z;
            const deltaDist = Math.sqrt(dx * dx + dz * dz);
            window.robotAccumulatedDistance += deltaDist;
            window.robotLastPos.x = window._carMesh.position.x;
            window.robotLastPos.z = window._carMesh.position.z;
        }
    });
}

function InitTyreMaterial() {
    tyreMaterial = new BABYLON.StandardMaterial("Tyre", scene);
    const upTexture = new BABYLON.Texture("textures/up.png", scene);
    upTexture.wAng = -Math.PI / 2;
    upTexture.vScale = 0.4;
    tyreMaterial.diffuseTexture = upTexture;
}

function CreateGroundAndWalls() {
    const groundMaterial = new BABYLON.StandardMaterial("Ground Material", scene);
    const checkerboard = new BABYLON.Texture("textures/amiga.jpg", scene);
    checkerboard.uScale = 20;
    checkerboard.vScale = 20;
    groundMaterial.diffuseTexture = checkerboard;

    const ground = BABYLON.MeshBuilder.CreateGround("Ground", { height: 500, width: 500 });
    ground.material = groundMaterial;
    ground.position = new BABYLON.Vector3(0, -10, 0);
    AddStaticPhysics(ground, 300);

    const wallA = BABYLON.MeshBuilder.CreateBox("Wall", { height: 20, width: 500, depth: 1 });
    wallA.position = new BABYLON.Vector3(0, 0, 250);
    AddStaticPhysics(wallA, 300);

    const wallB = BABYLON.MeshBuilder.CreateBox("Wall", { height: 20, width: 500, depth: 1 });
    wallB.position = new BABYLON.Vector3(0, 0, -250);
    AddStaticPhysics(wallB, 300);

    const wallC = BABYLON.MeshBuilder.CreateBox("Wall", { height: 20, width: 1, depth: 500 });
    wallC.position = new BABYLON.Vector3(250, 0, 0);
    AddStaticPhysics(wallC, 300);

    const wallD = BABYLON.MeshBuilder.CreateBox("Wall", { height: 20, width: 1, depth: 500 });
    wallD.position = new BABYLON.Vector3(-250, 0, 0);
    AddStaticPhysics(wallD, 300);
}

function AddWheelPhysics(mesh, mass, bounce, friction) {
    const physicsShape = new BABYLON.PhysicsShapeCylinder(new BABYLON.Vector3(-0.8, 0, 0), new BABYLON.Vector3(0.8, 0, 0), 2, scene);
    const physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    physicsBody.setMassProperties({ mass: mass });
    physicsShape.material = { restitution: bounce, friction: friction };
    physicsBody.shape = physicsShape;

    return physicsBody;
}

function AddAxlePhysics(mesh, mass, bounce, friction) {
    //
    // NOTE: Making the axle shape similar dimensions to the wheel shape increases stability of the joint when it is added
    //
    const physicsShape = new BABYLON.PhysicsShapeCylinder(new BABYLON.Vector3(-0.8, 0, 0), new BABYLON.Vector3(0.8, 0, 0), 1.8, scene);
    const physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    physicsBody.setMassProperties({ mass: mass });
    physicsShape.material = { restitution: bounce, friction: friction };
    physicsBody.shape = physicsShape;

    return physicsBody;
}

function AddDynamicPhysics(mesh, mass, bounce, friction) {
    const physicsShape = new BABYLON.PhysicsShapeMesh(mesh, scene);
    const physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    physicsBody.setMassProperties({ mass: mass });
    physicsShape.material = { restitution: bounce, friction: friction };
    physicsBody.shape = physicsShape;

    return physicsBody;
}

function AddStaticPhysics(mesh, friction, restitution) {
    const physicsShape = new BABYLON.PhysicsShapeMesh(mesh, scene);
    const physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.STATIC, false, scene);
    physicsShape.material = { restitution: restitution || 0, friction: friction };
    physicsBody.shape = physicsShape;

    return physicsBody;
}

function FilterMeshCollisions(mesh) {
    mesh.physicsBody.shape.filterMembershipMask = FILTERS.CarParts,
    mesh.physicsBody.shape.filterCollideMask = FILTERS.Environment
}

function CalculateWheelAngles(averageAngle) {
    //
    // NOTE: This is needed because of https://en.wikipedia.org/wiki/Ackermann_steering_geometry
    //
    const wheelbase = 16;
    const trackWidth = 11;

    const avgRadius = wheelbase / Math.tan(averageAngle);
    const innerRadius = avgRadius - trackWidth / 2;
    const outerRadius = avgRadius + trackWidth / 2;
    const innerAngle = Math.atan(wheelbase / innerRadius);
    const outerAngle = Math.atan(wheelbase / outerRadius);

    return [innerAngle, outerAngle];
}
export default createScene
