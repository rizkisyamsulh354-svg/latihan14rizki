/**
 * ==========================================================================
 * NEURODRONES - AGENT MECHANICS & PHYSICS (agent.js)
 * Implements agent kinemantics, sensory feedback processing, and custom vector
 * rendering routines for three unique customizable skins: Drone, Spaceship, and Ant.
 * ==========================================================================
 */

class Agent {
    constructor(x, y, skinType = "drone", brain = null, rayCount = 7, raySpread = Math.PI * 0.75, hiddenLayers = [8, 6]) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.angularVelocity = 0;
        
        this.skinType = skinType;
        this.radius = 11; // collision boundary radius
        
        this.dead = false;
        this.completed = false;
        this.lifespanSteps = 0;
        this.reachedTargetTime = 0;
        
        // Sensor system
        this.sensor = new Sensor(this, rayCount, raySpread);
        
        // Setup Neural Network
        // Input counts = rayCount + 4 (ray signals + target SinAngle + target CosAngle + speed + angularVelocity)
        const inputCount = rayCount + 4;
        const outputCount = 2; // two outputs for thrusters/steering forces
        
        if (brain) {
            this.brain = brain;
        } else {
            const layers = [inputCount, ...hiddenLayers, outputCount];
            this.brain = new NeuralNetwork(layers);
        }

        // Active neural outputs for visualizer/thruster animation
        this.outputs = [0, 0];
        
        // Track coordinate trace path behind agents
        this.path = [];
        this.maxPathLength = 15;
        
        // Traveled distances trackers
        this.initialDistance = 0;
        this.minDistanceToTarget = Infinity;
        this.latestDistance = Infinity;
    }

    /**
     * Compute sensor updates, run feedforward through neural network, and update agent physics
     */
    update(obstacles, target, mapWidth, mapHeight, airFriction = 0.05) {
        if (this.dead) return;

        this.lifespanSteps++;

        // 1. Update distance parameters
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.latestDistance = dist;

        if (this.initialDistance === 0) {
            this.initialDistance = dist;
        }
        if (dist < this.minDistanceToTarget) {
            this.minDistanceToTarget = dist;
        }

        // 2. Track trace path coordinates
        if (this.lifespanSteps % 4 === 0) {
            this.path.push({ x: this.x, y: this.y });
            if (this.path.length > this.maxPathLength) {
                this.path.shift();
            }
        }

        // 3. Check Target Reach
        const targetRadius = 15;
        if (dist < (this.radius + targetRadius)) {
            this.completed = true;
            this.dead = true;
            this.reachedTargetTime = this.lifespanSteps;
            return;
        }

        // 4. Update Raycast Sensors
        this.sensor.update(obstacles, mapWidth, mapHeight);

        // 5. Gather Brain Inputs
        // Primary inputs: normalized sensor readings (0 when clear, 1 when touching obstacle)
        const inputs = new Float32Array(this.sensor.rayCount + 4);
        for (let i = 0; i < this.sensor.rayCount; i++) {
            const reading = this.sensor.readings[i];
            inputs[i] = reading ? 1 - reading.offset : 0;
        }

        // Auxiliary inputs: angle to target relative to agent heading
        // Standard heading in our model: 0 is UP (-sin, -cos)
        const angleToTarget = Math.atan2(target.y - this.y, target.x - this.x);
        const relativeAngle = normalizeAngle(angleToTarget - (this.angle - Math.PI / 2));
        
        inputs[this.sensor.rayCount] = Math.sin(relativeAngle);
        inputs[this.sensor.rayCount + 1] = Math.cos(relativeAngle);

        // Speed dynamics inputs
        const currentSpeed = Math.hypot(this.vx, this.vy);
        inputs[this.sensor.rayCount + 2] = currentSpeed / 5; // normalized around max speed 5
        inputs[this.sensor.rayCount + 3] = this.angularVelocity / 0.1; // normalized around max angular vel

        // 6. Think! Activate Brain
        this.outputs = this.brain.feedForward(inputs);

        // 7. Physics Integrations based on skin dynamics
        this.#applyKinematics(this.outputs, airFriction);

        // 8. Collision Boundaries and Obstacles Detections
        this.#checkCollisions(obstacles, mapWidth, mapHeight);
    }

    /**
     * Map neural signals (-1 to 1) into forces based on agent skin type
     */
    #applyKinematics(outputs, friction) {
        // Shared constraints
        const maxThrust = 0.35;
        const maxTorque = 0.08;
        const angularDamping = 0.12;

        if (this.skinType === "drone") {
            // Drone Style: Left & Right thruster forces
            const leftForce = (outputs[0] + 1) / 2;  // Map to 0..1
            const rightForce = (outputs[1] + 1) / 2; // Map to 0..1

            const totalThrust = (leftForce + rightForce) * maxThrust;
            const torque = (leftForce - rightForce) * maxTorque;

            // Update rotation
            this.angularVelocity += torque - this.angularVelocity * angularDamping;
            this.angle += this.angularVelocity;

            // Apply forward force vectors
            const ax = -Math.sin(this.angle) * totalThrust;
            const ay = -Math.cos(this.angle) * totalThrust;
            
            this.vx += ax;
            this.vy += ay;
            
            // Apply drag/friction
            this.vx *= (1 - friction);
            this.vy *= (1 - friction);
            
            this.x += this.vx;
            this.y += this.vy;
            
        } else if (this.skinType === "spaceship") {
            // Spaceship: Main engine + side thruster RCS steering
            const mainEngine = (outputs[0] + 1) / 2; // Map to 0..1
            const steer = outputs[1];                // Map to -1..1 (Steer)

            // Update rotation
            this.angularVelocity += steer * maxTorque - this.angularVelocity * angularDamping;
            this.angle += this.angularVelocity;

            // Apply forward thrust
            const ax = -Math.sin(this.angle) * mainEngine * maxThrust * 1.2;
            const ay = -Math.cos(this.angle) * mainEngine * maxThrust * 1.2;
            
            this.vx += ax;
            this.vy += ay;
            
            this.vx *= (1 - friction);
            this.vy *= (1 - friction);
            
            this.x += this.vx;
            this.y += this.vy;
            
        } else if (this.skinType === "ant") {
            // Ant Style: Crawling kinematics (no inertia, quick steering)
            const speed = (outputs[0] + 1) / 2 * 2.2; // max speed 2.2 pixels/frame
            const steer = outputs[1] * 0.08;          // max steer angle 0.08 radians/frame

            this.angle += steer;
            this.vx = -Math.sin(this.angle) * speed;
            this.vy = -Math.cos(this.angle) * speed;
            
            this.x += this.vx;
            this.y += this.vy;
        }
    }

    /**
     * Verify boundary overflows or obstacle penetrations
     */
    #checkCollisions(obstacles, mapWidth, mapHeight) {
        // Map walls boundaries
        if (this.x - this.radius < 0 || this.x + this.radius > mapWidth ||
            this.y - this.radius < 0 || this.y + this.radius > mapHeight) {
            this.dead = true;
            return;
        }

        // Obstacles intersections
        for (let i = 0; i < obstacles.length; i++) {
            if (obstacles[i].intersectsCircle(this.x, this.y, this.radius)) {
                this.dead = true;
                break;
            }
        }
    }

    /**
     * Render the active agent skin on canvas
     * @param {CanvasRenderingContext2D} ctx - Main simulation canvas
     * @param {boolean} isBest - True if this is the best performing agent in the generation
     */
    draw(ctx, isBest = false) {
        // 1. Draw trace path trailing lines
        if (this.path.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.path[0].x, this.path[0].y);
            for (let i = 1; i < this.path.length; i++) {
                ctx.lineTo(this.path[i].x, this.path[i].y);
            }
            ctx.strokeStyle = isBest ? "rgba(0, 242, 254, 0.25)" : "rgba(255, 255, 255, 0.06)";
            ctx.lineWidth = isBest ? 2 : 1;
            ctx.stroke();
            ctx.restore();
        }

        // Skip full skin renderings if dead
        if (this.dead && !this.completed) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Core glow for best performing agent
        if (isBest) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#00f2fe";
        }

        const primaryColor = isBest ? "#00f2fe" : "rgba(255, 255, 255, 0.75)";
        const secondaryColor = isBest ? "#00ff87" : "rgba(255, 255, 255, 0.4)";

        // 2. Draw specific skins
        if (this.skinType === "drone") {
            this.#drawDrone(ctx, primaryColor, secondaryColor, isBest);
        } else if (this.skinType === "spaceship") {
            this.#drawSpaceship(ctx, primaryColor, secondaryColor, isBest);
        } else if (this.skinType === "ant") {
            this.#drawAnt(ctx, primaryColor, secondaryColor, isBest);
        }

        ctx.restore();
    }

    /**
     * Quadcopter drone skin rendering
     */
    #drawDrone(ctx, primaryColor, secondaryColor, isBest) {
        // Central body frame (glowing cyan orb/core)
        ctx.beginPath();
        ctx.arc(0, -2, 5, 0, Math.PI * 2);
        ctx.fillStyle = isBest ? "#00f2fe" : "rgba(0, 242, 254, 0.7)";
        ctx.fill();

        // Dual side metal arms/booms
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Camera head nose
        ctx.beginPath();
        ctx.rect(-2, -7, 4, 3);
        ctx.fillStyle = isBest ? "#00ff87" : "#ff2e93";
        ctx.fill();

        // Left thruster engine/rotor housing
        ctx.beginPath();
        ctx.rect(-14, -2, 4, 4);
        ctx.fillStyle = "#334155";
        ctx.fill();

        // Right thruster engine/rotor housing
        ctx.beginPath();
        ctx.rect(10, -2, 4, 4);
        ctx.fillStyle = "#334155";
        ctx.fill();

        // Left / Right Rotor Blades spinning animation
        const leftForce = (this.outputs[0] + 1) / 2;
        const rightForce = (this.outputs[1] + 1) / 2;
        
        const time = Date.now() * 0.05;
        const leftSpeed = 0.5 + leftForce * 1.5;
        const rightSpeed = 0.5 + rightForce * 1.5;

        // Left Rotor
        ctx.save();
        ctx.translate(-12, -2);
        ctx.rotate(time * leftSpeed);
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 1.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
        ctx.restore();

        // Right Rotor
        ctx.save();
        ctx.translate(12, -2);
        ctx.rotate(-time * rightSpeed);
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 1.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
        ctx.restore();
    }

    /**
     * Delta-wing rocket spaceship skin rendering
     */
    #drawSpaceship(ctx, primaryColor, secondaryColor, isBest) {
        // Delta wing ship plate
        ctx.beginPath();
        ctx.moveTo(0, -12); // nose cone
        ctx.lineTo(-8, 8);  // left wing
        ctx.lineTo(0, 4);   // rear bulkhead
        ctx.lineTo(8, 8);   // right wing
        ctx.closePath();
        ctx.fillStyle = isBest ? "rgba(0, 242, 254, 0.8)" : "rgba(30, 41, 59, 0.9)";
        ctx.fill();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glowing glass cockpit canopy
        ctx.beginPath();
        ctx.ellipse(0, -3, 2, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = isBest ? "#00ff87" : "#00c6ff";
        ctx.fill();

        // Main rear thruster exhaust fire plume
        const mainEngine = (this.outputs[0] + 1) / 2;
        if (mainEngine > 0.05) {
            ctx.beginPath();
            ctx.moveTo(-3, 5);
            ctx.lineTo(0, 5 + mainEngine * 15 * (0.8 + Math.random() * 0.4));
            ctx.lineTo(3, 5);
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(0, 5, 0, 20);
            grad.addColorStop(0, "#fff");
            grad.addColorStop(0.3, "#ffb800");
            grad.addColorStop(1, "rgba(255, 46, 147, 0)");
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Side RCS thrusters sparks (during rotations)
        const steer = this.outputs[1];
        if (Math.abs(steer) > 0.1) {
            ctx.beginPath();
            if (steer > 0) {
                // Steering right: spray left thruster nose nozzle
                ctx.moveTo(-4, -6);
                ctx.lineTo(-10 - Math.random() * 5, -6);
                ctx.lineTo(-4, -4);
            } else {
                // Steering left: spray right thruster nose nozzle
                ctx.moveTo(4, -6);
                ctx.lineTo(10 + Math.random() * 5, -6);
                ctx.lineTo(4, -4);
            }
            ctx.closePath();
            ctx.fillStyle = "rgba(0, 242, 254, 0.8)";
            ctx.fill();
        }
    }

    /**
     * Segmented ant crawling bug skin rendering
     */
    #drawAnt(ctx, primaryColor, secondaryColor, isBest) {
        const speed = Math.hypot(this.vx, this.vy);
        const wiggle = speed > 0.1 ? Math.sin(this.lifespanSteps * 0.5) * 0.4 : 0;

        // Abdomen (rear segment)
        ctx.beginPath();
        ctx.arc(0, 8, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isBest ? "#7000ff" : "#475569";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.stroke();

        // Thorax (middle segment)
        ctx.beginPath();
        ctx.arc(0, 1, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = isBest ? "#00f2fe" : "#334155";
        ctx.fill();

        // Head (front segment)
        ctx.beginPath();
        ctx.arc(0, -6, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isBest ? "#00ff87" : "#1e293b";
        ctx.fill();

        // Animated wiggling legs (6 legs)
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1;

        // Pair 1 (Front legs)
        ctx.beginPath();
        ctx.moveTo(-2, -4);
        ctx.lineTo(-7, -8 + wiggle * 3);
        ctx.moveTo(2, -4);
        ctx.lineTo(7, -8 - wiggle * 3);
        
        // Pair 2 (Middle legs)
        ctx.moveTo(-2, 1);
        ctx.lineTo(-9, 1 - wiggle * 3);
        ctx.moveTo(2, 1);
        ctx.lineTo(9, 1 + wiggle * 3);

        // Pair 3 (Back legs)
        ctx.moveTo(-2, 5);
        ctx.lineTo(-8, 9 + wiggle * 3);
        ctx.moveTo(2, 5);
        ctx.lineTo(8, 9 - wiggle * 3);
        ctx.stroke();

        // Antennae (Sensors whiskers)
        ctx.beginPath();
        ctx.moveTo(-1, -8);
        ctx.quadraticCurveTo(-4, -12, -5, -15);
        ctx.moveTo(1, -8);
        ctx.quadraticCurveTo(4, -12, 5, -15);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }
}

/**
 * Normalizes an angle in radians between -PI and PI
 */
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}
