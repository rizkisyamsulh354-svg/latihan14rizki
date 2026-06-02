/**
 * ==========================================================================
 * NEURODRONES - EVOLUTION PROGRESS GRAPHICS (chart.js)
 * Fully custom lightweight canvas-based chart renderer. Graphically tracks
 * Maximum Fitness, Average Fitness, and Success Rate history across generations.
 * ==========================================================================
 */

class EvolutionChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        
        // Data series history
        this.generations = [];
        this.maxFitnessData = [];
        this.avgFitnessData = [];
        this.successRateData = []; // represented as percentage (0 to 100)
    }

    /**
     * Insert fresh generation data and redraw graph
     */
    addGenerationData(gen, maxFit, avgFit, successRate) {
        this.generations.push(gen);
        this.maxFitnessData.push(maxFit);
        this.avgFitnessData.push(avgFit);
        this.successRateData.push(successRate);

        this.draw();
    }

    /**
     * Wipe historical logs
     */
    reset() {
        this.generations = [];
        this.maxFitnessData = [];
        this.avgFitnessData = [];
        this.successRateData = [];
        this.draw();
    }

    /**
     * High-DPI render loop for progress graph
     */
    draw() {
        const ctx = this.ctx;
        const canvas = this.canvas;

        // Reset canvas dimensions based on client bounds to support responsive resizing
        const rect = canvas.parentNode.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Scale dimensions for high density screens (Retina displays)
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Core visual style
        ctx.clearRect(0, 0, width, height);

        // Paddings
        const paddingLeft = 40;
        const paddingRight = 35;
        const paddingTop = 15;
        const paddingBottom = 22;

        const graphWidth = width - paddingLeft - paddingRight;
        const graphHeight = height - paddingTop - paddingBottom;

        // If there is no data, render "NO DIAGNOSTIC DATA YET"
        if (this.generations.length === 0) {
            ctx.save();
            ctx.fillStyle = "#475569";
            ctx.font = "bold 0.75rem 'Outfit'";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("TUNGGU EVALUASI GENERASI...", width / 2, height / 2);
            ctx.restore();
            return;
        }

        // Calculate scales
        // 1. Max Y scale for Fitness: auto-scaled based on maximum recorded fitness
        const maxRecordedFitness = Math.max(...this.maxFitnessData);
        const yMaxFitness = Math.max(10, Math.ceil(maxRecordedFitness * 1.15));

        // 2. Max X scale: count of generations
        const xMaxCount = this.generations.length;

        // Draw horizontal grid lines (Grid divisions = 4)
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        ctx.font = "bold 0.65rem 'Fira Code'";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        for (let i = 0; i <= 4; i++) {
            const ratio = i / 4;
            const y = paddingTop + graphHeight * (1 - ratio);
            
            // Draw grid line
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(width - paddingRight, y);
            ctx.stroke();

            // Left label: Fitness value
            const fitnessVal = (yMaxFitness * ratio).toFixed(0);
            ctx.fillText(fitnessVal, paddingLeft - 8, y);

            // Right label: Success rate percentage
            ctx.save();
            ctx.textAlign = "left";
            ctx.fillStyle = "#00ff87";
            const pctVal = (100 * ratio).toFixed(0) + "%";
            ctx.fillText(pctVal, width - paddingRight + 8, y);
            ctx.restore();
        }
        ctx.restore();

        // Draw X-axis bottom label ticks
        ctx.save();
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 0.65rem 'Fira Code'";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Draw up to 5 generation ticks to avoid clutter
        const step = Math.max(1, Math.ceil(xMaxCount / 5));
        for (let i = 0; i < xMaxCount; i += step) {
            const ratio = xMaxCount > 1 ? i / (xMaxCount - 1) : 0.5;
            const x = paddingLeft + graphWidth * ratio;
            ctx.fillText("G" + this.generations[i], x, height - paddingBottom + 5);
        }
        // Always draw the final generation tick
        if (xMaxCount > 1 && (xMaxCount - 1) % step !== 0) {
            const x = paddingLeft + graphWidth;
            ctx.fillText("G" + this.generations[xMaxCount - 1], x, height - paddingBottom + 5);
        }
        ctx.restore();

        // Draw graph border lines
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, paddingTop);
        ctx.lineTo(paddingLeft, height - paddingBottom);
        ctx.lineTo(width - paddingRight, height - paddingBottom);
        ctx.stroke();
        ctx.restore();

        // Helper function to plot lines
        const plotSeries = (data, color, shadowColor, maxValY) => {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            
            // Neon glow effect
            ctx.shadowBlur = 6;
            ctx.shadowColor = shadowColor;

            ctx.beginPath();
            for (let i = 0; i < xMaxCount; i++) {
                const ratioX = xMaxCount > 1 ? i / (xMaxCount - 1) : 0.5;
                const ratioY = data[i] / maxValY;

                const x = paddingLeft + graphWidth * ratioX;
                const y = paddingTop + graphHeight * (1 - ratioY);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.restore();

            // Draw small connector dots if number of points is small
            if (xMaxCount < 40) {
                ctx.save();
                ctx.fillStyle = color;
                ctx.shadowBlur = 4;
                ctx.shadowColor = shadowColor;
                for (let i = 0; i < xMaxCount; i++) {
                    const ratioX = xMaxCount > 1 ? i / (xMaxCount - 1) : 0.5;
                    const ratioY = data[i] / maxValY;
                    const x = paddingLeft + graphWidth * ratioX;
                    const y = paddingTop + graphHeight * (1 - ratioY);
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        };

        // Draw the 3 lines
        // 1. Average Fitness (Purple)
        plotSeries(this.avgFitnessData, "#b927fc", "rgba(185, 39, 252, 0.4)", yMaxFitness);
        
        // 2. Maximum Fitness (Cyan)
        plotSeries(this.maxFitnessData, "#00f2fe", "rgba(0, 242, 254, 0.4)", yMaxFitness);

        // 3. Success Rate (Emerald Green - scales 0..100)
        plotSeries(this.successRateData, "#00ff87", "rgba(0, 255, 135, 0.35)", 100);
    }
}
