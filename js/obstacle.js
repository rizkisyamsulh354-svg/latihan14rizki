/**
 * ==========================================================================
 * NEURODRONES - OBSTACLE GEOMETRY ENGINE (obstacle.js)
 * Implements interactive obstacles (rectangles and circles) that can be drawn
 * by the user and intersected by sensor rays or hit by agents.
 * ==========================================================================
 */

class RectObstacle {
    constructor(x, y, w, h) {
        this.type = "rect";
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    /**
     * Draw the glowing neon rectangular wall
     */
    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        
        // Translucent cyber-dark body
        ctx.fillStyle = "rgba(13, 11, 25, 0.75)";
        ctx.fillRect(this.x, this.y, this.w, this.h);
        
        // Neon outer stroke
        ctx.strokeStyle = "#b927fc";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(185, 39, 252, 0.6)";
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        
        // Inner tech details (diagonal stripes inside larger walls)
        if (this.w > 30 && this.h > 30) {
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.rect(this.x, this.y, this.w, this.h);
            ctx.clip();
            
            ctx.beginPath();
            ctx.strokeStyle = "rgba(185, 39, 252, 0.08)";
            ctx.lineWidth = 1;
            for (let offset = -this.h; offset < this.w; offset += 15) {
                ctx.moveTo(this.x + offset, this.y);
                ctx.lineTo(this.x + offset + this.h, this.y + this.h);
            }
            ctx.stroke();
        }
        
        ctx.restore();
    }

    /**
     * Check if a specific point is inside the rectangle (used by Eraser tool)
     */
    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
    }

    /**
     * Check if a circular agent overlaps with this rectangle (Collision detection)
     */
    intersectsCircle(cx, cy, radius) {
        // Find the closest point on the rectangle to the circle's center
        const closestX = Math.max(this.x, Math.min(cx, this.x + this.w));
        const closestY = Math.max(this.y, Math.min(cy, this.y + this.h));

        // Calculate the distance squared between this closest point and the circle's center
        const distanceX = cx - closestX;
        const distanceY = cy - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;

        // If the distance is less than the circle's radius squared, they intersect
        return distanceSquared < radius * radius;
    }
}

class CircleObstacle {
    constructor(x, y, r) {
        this.type = "circle";
        this.x = x;
        this.y = y;
        this.r = r;
    }

    /**
     * Draw the glowing circular pillar
     */
    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        
        // Translucent interior
        ctx.fillStyle = "rgba(13, 11, 25, 0.75)";
        ctx.fill();
        
        // Neon outer stroke
        ctx.strokeStyle = "#b927fc";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(185, 39, 252, 0.6)";
        ctx.stroke();
        
        // Dynamic futuristic details (concentric rings)
        if (this.r > 15) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(185, 39, 252, 0.12)";
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Draw crosshairs
            ctx.beginPath();
            ctx.moveTo(this.x - this.r * 0.4, this.y);
            ctx.lineTo(this.x + this.r * 0.4, this.y);
            ctx.moveTo(this.x, this.y - this.r * 0.4);
            ctx.lineTo(this.x, this.y + this.r * 0.4);
            ctx.strokeStyle = "rgba(185, 39, 252, 0.2)";
            ctx.stroke();
        }
        
        ctx.restore();
    }

    /**
     * Check if a specific point is inside the circle (used by Eraser tool)
     */
    containsPoint(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        return (dx * dx + dy * dy) < this.r * this.r;
    }

    /**
     * Check if a circular agent overlaps with this circle (Collision detection)
     */
    intersectsCircle(cx, cy, radius) {
        const dx = cx - this.x;
        const dy = cy - this.y;
        const distanceSquared = dx * dx + dy * dy;
        const minDistance = this.r + radius;
        return distanceSquared < minDistance * minDistance;
    }
}
