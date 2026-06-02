/**
 * ==========================================================================
 * NEURODRONES - RAYCAST SENSOR ENGINE (sensor.js)
 * Implements 2D raycasting sensors that measure distances to walls, boundaries, 
 * and circular obstacles. Outputs distance offsets to serve as neural network inputs.
 * ==========================================================================
 */

class Sensor {
    constructor(agent, rayCount = 7, raySpread = Math.PI * 0.75) {
        this.agent = agent;
        this.rayCount = rayCount;
        this.raySpread = raySpread;
        this.rayRange = 220; // Maximum sensing distance

        this.rays = [];
        this.readings = [];
    }

    /**
     * Update the ray sensor lines and calculate obstacle intersections
     */
    update(obstacles, mapWidth, mapHeight) {
        this.#castRays();
        this.readings = [];
        
        for (let i = 0; i < this.rays.length; i++) {
            this.readings.push(
                this.#getReading(this.rays[i], obstacles, mapWidth, mapHeight)
            );
        }
    }

    /**
     * Recalculate ray start and end positions relative to agent's heading
     */
    #castRays() {
        this.rays = [];
        for (let i = 0; i < this.rayCount; i++) {
            // Determine ray angle relative to the agent's current rotation angle
            // Center ray (spread = 0) aligns with agent's forward direction
            const rayAngle = this.agent.angle + (
                this.rayCount === 1 ? 0 : (i / (this.rayCount - 1) - 0.5) * this.raySpread
            );

            // In standard coordinate systems where 0 is UP:
            // Forward is (-sin(angle), -cos(angle))
            const start = { x: this.agent.x, y: this.agent.y };
            const end = {
                x: this.agent.x - Math.sin(rayAngle) * this.rayRange,
                y: this.agent.y - Math.cos(rayAngle) * this.rayRange
            };

            this.rays.push([start, end]);
        }
    }

    /**
     * Compute the closest intersection point for a single ray
     */
    #getReading(ray, obstacles, mapWidth, mapHeight) {
        let touches = [];

        // 1. Boundary Intersections (Map borders)
        const borders = [
            // Top border
            [{ x: 0, y: 0 }, { x: mapWidth, y: 0 }],
            // Bottom border
            [{ x: 0, y: mapHeight }, { x: mapWidth, y: mapHeight }],
            // Left border
            [{ x: 0, y: 0 }, { x: 0, y: mapHeight }],
            // Right border
            [{ x: mapWidth, y: 0 }, { x: mapWidth, y: mapHeight }]
        ];

        borders.forEach(border => {
            const touch = getLineIntersection(ray[0], ray[1], border[0], border[1]);
            if (touch) touches.push(touch);
        });

        // 2. Obstacle Intersections (User drawn or presets)
        obstacles.forEach(obstacle => {
            if (obstacle.type === "rect") {
                // Rectangles have 4 line segments
                const segments = [
                    [{ x: obstacle.x, y: obstacle.y }, { x: obstacle.x + obstacle.w, y: obstacle.y }],
                    [{ x: obstacle.x + obstacle.w, y: obstacle.y }, { x: obstacle.x + obstacle.w, y: obstacle.y + obstacle.h }],
                    [{ x: obstacle.x + obstacle.w, y: obstacle.y + obstacle.h }, { x: obstacle.x, y: obstacle.y + obstacle.h }],
                    [{ x: obstacle.x, y: obstacle.y + obstacle.h }, { x: obstacle.x, y: obstacle.y }]
                ];

                segments.forEach(segment => {
                    const touch = getLineIntersection(ray[0], ray[1], segment[0], segment[1]);
                    if (touch) touches.push(touch);
                });
            } else if (obstacle.type === "circle") {
                // Ray-Circle intersection
                const touch = getRayCircleIntersection(ray[0], ray[1], obstacle);
                if (touch) touches.push(touch);
            }
        });

        // If no obstacle was touched by the ray, return null
        if (touches.length === 0) {
            return null;
        }

        // Return the closest intersection touch point (minimum offset value)
        const offsets = touches.map(t => t.offset);
        const minOffset = Math.min(...offsets);
        return touches.find(t => t.offset === minOffset);
    }

    /**
     * Renders sensory rays on the canvas
     * Unobstructed rays are faint; intersected parts are colored dynamically
     */
    draw(ctx, showRays) {
        if (!showRays) return;
        
        ctx.save();
        for (let i = 0; i < this.rayCount; i++) {
            let end = this.rays[i][1];
            const reading = this.readings[i];
            
            if (reading) {
                end = reading;
            }

            // Draw clean active section (Greenish/Cyan when clear, red/pink at intersection)
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.strokeStyle = reading ? "rgba(255, 46, 147, 0.45)" : "rgba(0, 242, 254, 0.15)";
            ctx.moveTo(this.rays[i][0].x, this.rays[i][0].y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Draw remaining obstructed section if it collided
            if (reading) {
                ctx.beginPath();
                ctx.lineWidth = 0.5;
                ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
                ctx.moveTo(end.x, end.y);
                ctx.lineTo(this.rays[i][1].x, this.rays[i][1].y);
                ctx.stroke();

                // Draw glowing node point at intersection impact
                ctx.beginPath();
                ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255, 46, 147, 0.8)";
                ctx.shadowBlur = 4;
                ctx.shadowColor = "#ff2e93";
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

/**
 * Line Segment - Line Segment intersection math
 * Returns intersection point {x, y, offset} or null
 */
function getLineIntersection(A, B, C, D) {
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);

    if (bottom !== 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: A.x + t * (B.x - A.x),
                y: A.y + t * (B.y - A.y),
                offset: t
            };
        }
    }
    return null;
}

/**
 * Analytical Ray - Circle intersection math
 * Returns closest intersection point {x, y, offset} or null
 */
function getRayCircleIntersection(A, B, circle) {
    const V = { x: B.x - A.x, y: B.y - A.y };
    const W = { x: A.x - circle.x, y: A.y - circle.y };

    const a = V.x * V.x + V.y * V.y;
    const b = 2 * (V.x * W.x + V.y * W.y);
    const c = W.x * W.x + W.y * W.y - circle.r * circle.r;

    const discriminant = b * b - 4 * a * c;

    if (discriminant >= 0) {
        // Compute the two intersection fractions t1 and t2
        const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);

        let t = null;
        if (t1 >= 0 && t1 <= 1) t = t1;
        if (t2 >= 0 && t2 <= 1 && (t === null || t2 < t)) t = t2;

        if (t !== null) {
            return {
                x: A.x + t * V.x,
                y: A.y + t * V.y,
                offset: t
            };
        }
    }
    return null;
}
