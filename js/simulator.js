/**
 * ==========================================================================
 * NEURODRONES - SIMULATION ENVIRONMENT CORE (simulator.js)
 * Manages the physics space, maps boundaries, launch pads, dynamic targets,
 * presets generation, mouse interactive drawings, and eraser brushes.
 * ==========================================================================
 */

class SimulationEnvironment {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        // Maintain fixed internal viewport coords to make physics maps identical on all monitors
        this.canvas.width = 850;
        this.canvas.height = 530;

        // Core points
        this.startX = 100;
        this.startY = 265;
        this.target = { x: 750, y: 265 };
        this.targetRadius = 13;

        // Interactive states
        this.obstacles = [];
        this.isDraggingTarget = false;
        
        // Drawing tools
        this.isDrawing = false;
        this.drawStartPoint = { x: 0, y: 0 };
        this.mousePos = { x: 0, y: 0 };
        this.currentTool = "rect"; // "rect", "circle", "erase"

        // Target behaviors
        this.targetMode = "static"; // "static", "patrol", "follow"
        this.patrolAngle = 0;

        // Map Preset Initializer
        this.loadPreset("columns");

        // Initialize mouse handlers
        this.#initMouseEvents();
    }

    /**
     * Resets target to initial location and loads map template
     */
    reset(presetName = "columns") {
        this.target = { x: 750, y: 265 };
        this.isDraggingTarget = false;
        this.isDrawing = false;
        this.loadPreset(presetName);
    }

    /**
     * Generate pre-configured obstacle maps
     */
    loadPreset(presetName) {
        this.obstacles = [];
        const w = this.canvas.width;
        const h = this.canvas.height;

        switch (presetName) {
            case "columns":
                // Staggered vertical pillars forcing a zigzag pathway
                // Col 1
                this.obstacles.push(new RectObstacle(240, 0, 45, 180));
                this.obstacles.push(new RectObstacle(240, h - 180, 45, 180));
                
                // Col 2 (center pillar)
                this.obstacles.push(new RectObstacle(440, 130, 45, h - 260));

                // Col 3
                this.obstacles.push(new RectObstacle(640, 0, 40, 170));
                this.obstacles.push(new RectObstacle(640, h - 170, 40, 170));
                break;

            case "maze":
                // Labyrinth walls with narrow corridors
                this.obstacles.push(new RectObstacle(200, 0, 30, h - 130));
                this.obstacles.push(new RectObstacle(360, 130, 30, h - 130));
                this.obstacles.push(new RectObstacle(520, 0, 30, h - 160));
                this.obstacles.push(new RectObstacle(680, 160, 30, h - 160));
                
                // Horizontal divider caps
                this.obstacles.push(new RectObstacle(230, h - 160, 80, 30));
                this.obstacles.push(new RectObstacle(390, 130, 80, 30));
                this.obstacles.push(new RectObstacle(550, h - 190, 80, 30));
                break;

            case "funnel":
                // Staggered narrow bottleneck funnel in the center
                this.obstacles.push(new RectObstacle(320, 0, 60, h / 2 - 60));
                this.obstacles.push(new RectObstacle(320, h / 2 + 60, 60, h / 2 - 60));
                
                // Additional rings blocking linear flight
                this.obstacles.push(new CircleObstacle(500, 120, 45));
                this.obstacles.push(new CircleObstacle(500, h - 120, 45));
                break;

            case "empty":
            default:
                this.obstacles = [];
                break;
        }
    }

    /**
     * Update target coordinates based on current behavior modes
     */
    updateTarget() {
        if (this.targetMode === "patrol" && !this.isDraggingTarget) {
            // Sweeps smoothly up and down using a sine wave
            this.patrolAngle += 0.02;
            this.target.y = 265 + Math.sin(this.patrolAngle) * 170;
        } else if (this.targetMode === "follow" && !this.isDraggingTarget) {
            // Target drifts gently towards current mouse coordinates
            const dx = this.mousePos.x - this.target.x;
            const dy = this.mousePos.y - this.target.y;
            this.target.x += dx * 0.05;
            this.target.y += dy * 0.05;

            // clamp coordinates inside canvas boundary
            this.target.x = Math.max(20, Math.min(this.canvas.width - 20, this.target.x));
            this.target.y = Math.max(20, Math.min(this.canvas.height - 20, this.target.y));
        }
    }

    /**
     * Mouse pointer event configurations
     */
    #initMouseEvents() {
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Scale screen coordinates back to match internal 850x530 coordinates grid
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        this.canvas.addEventListener("mousedown", (e) => {
            const coords = getCanvasCoords(e);
            
            // 1. Check target drag clicks
            const distToTarget = Math.hypot(coords.x - this.target.x, coords.y - this.target.y);
            if (distToTarget < this.targetRadius + 8) {
                this.isDraggingTarget = true;
                return;
            }

            // 2. Otherwise start obstacle painting
            this.isDrawing = true;
            this.drawStartPoint = { x: coords.x, y: coords.y };
            this.mousePos = { x: coords.x, y: coords.y };

            // Quick eraser action on click
            if (this.currentTool === "erase") {
                this.#eraseObstaclesAt(coords.x, coords.y);
            }
        });

        this.canvas.addEventListener("mousemove", (e) => {
            const coords = getCanvasCoords(e);
            this.mousePos = { x: coords.x, y: coords.y };

            if (this.isDraggingTarget) {
                // Drag target
                this.target.x = Math.max(20, Math.min(this.canvas.width - 20, coords.x));
                this.target.y = Math.max(20, Math.min(this.canvas.height - 20, coords.y));
            } else if (this.isDrawing && this.currentTool === "erase") {
                // Erase dragging
                this.#eraseObstaclesAt(coords.x, coords.y);
            }
        });

        const stopDrawing = (e) => {
            if (this.isDraggingTarget) {
                this.isDraggingTarget = false;
                return;
            }

            if (!this.isDrawing) return;
            this.isDrawing = false;
            
            const coords = getCanvasCoords(e);

            if (this.currentTool === "rect") {
                // Math box calculations to support dragging in reverse directions
                const x = Math.min(this.drawStartPoint.x, coords.x);
                const y = Math.min(this.drawStartPoint.y, coords.y);
                const w = Math.abs(coords.x - this.drawStartPoint.x);
                const h = Math.abs(coords.y - this.drawStartPoint.y);

                // Ignore extremely small click clicks
                if (w > 12 && h > 12) {
                    this.obstacles.push(new RectObstacle(x, y, w, h));
                }
            } else if (this.currentTool === "circle") {
                const r = Math.hypot(coords.x - this.drawStartPoint.x, coords.y - this.drawStartPoint.y);
                if (r > 6) {
                    this.obstacles.push(new CircleObstacle(this.drawStartPoint.x, this.drawStartPoint.y, r));
                }
            }
        };

        this.canvas.addEventListener("mouseup", stopDrawing);
        this.canvas.addEventListener("mouseleave", stopDrawing);
    }

    /**
     * Removes any obstacle touched by eraser pointer coords
     */
    #eraseObstaclesAt(x, y) {
        this.obstacles = this.obstacles.filter(obstacle => !obstacle.containsPoint(x, y));
    }

    /**
     * Core environment painter loop
     */
    draw() {
        const ctx = this.ctx;
        ctx.save();

        // 1. Draw glowing grid system
        ctx.fillStyle = "#05060b";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.015)";
        ctx.lineWidth = 1;
        const gridSpacing = 40;
        
        ctx.beginPath();
        for (let x = 0; x < this.canvas.width; x += gridSpacing) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
        }
        for (let y = 0; y < this.canvas.height; y += gridSpacing) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
        }
        ctx.stroke();

        // 2. Draw Start/Launchpad plate
        ctx.beginPath();
        ctx.arc(this.startX, this.startY, 22, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 242, 254, 0.03)";
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 242, 254, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]); // clear dash

        // Draw start core symbol
        ctx.beginPath();
        ctx.arc(this.startX, this.startY, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#00f2fe";
        ctx.fill();

        // 3. Draw All Active Obstacles
        this.obstacles.forEach(obstacle => obstacle.draw(ctx));

        // 4. Draw Temporary construction/drag outlines
        if (this.isDrawing) {
            ctx.save();
            ctx.strokeStyle = "rgba(185, 39, 252, 0.55)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);

            if (this.currentTool === "rect") {
                const x = Math.min(this.drawStartPoint.x, this.mousePos.x);
                const y = Math.min(this.drawStartPoint.y, this.mousePos.y);
                const w = Math.abs(this.mousePos.x - this.drawStartPoint.x);
                const h = Math.abs(this.mousePos.y - this.drawStartPoint.y);
                ctx.strokeRect(x, y, w, h);
            } else if (this.currentTool === "circle") {
                const r = Math.hypot(this.mousePos.x - this.drawStartPoint.x, this.mousePos.y - this.drawStartPoint.y);
                ctx.beginPath();
                ctx.arc(this.drawStartPoint.x, this.drawStartPoint.y, r, 0, Math.PI * 2);
                ctx.stroke();
            } else if (this.currentTool === "erase") {
                ctx.beginPath();
                ctx.arc(this.mousePos.x, this.mousePos.y, 8, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255, 46, 147, 0.8)";
                ctx.stroke();
            }
            ctx.restore();
        }

        // 5. Draw Glowing target goal orb
        // Dynamic pulsating ripples
        const pulseTime = Date.now() * 0.002;
        const pulseRadius = this.targetRadius + 3 + (Math.sin(pulseTime) * 3);

        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00ffd2";

        // Outer pulse circle
        ctx.beginPath();
        ctx.arc(this.target.x, this.target.y, pulseRadius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 255, 210, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner solid core orb
        ctx.beginPath();
        ctx.arc(this.target.x, this.target.y, this.targetRadius, 0, Math.PI * 2);
        ctx.fillStyle = "linear-gradient(to right, #00ffd2, #00ff87)";
        
        // Canvas gradient for target
        const grad = ctx.createRadialGradient(this.target.x, this.target.y, 2, this.target.x, this.target.y, this.targetRadius);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.4, "#00ffd2");
        grad.addColorStop(1, "#00ff87");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Small tech reticles
        ctx.beginPath();
        ctx.arc(this.target.x, this.target.y, this.targetRadius - 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.stroke();

        ctx.restore();
    }
}
