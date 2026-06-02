/**
 * ==========================================================================
 * NEURODRONES - ACTIVE BRAIN DIAGNOSTIC VISUALIZER (brain-vis.js)
 * Visualizes the neural network structure of a selected agent in real-time.
 * Features glowing active nodes, weight-sign connection styling, and animated
 * light pulse signals representing active information flow.
 * ==========================================================================
 */

class BrainVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        
        // Timer for connection light pulses animation
        this.pulseTime = 0;
    }

    /**
     * Renders the neural network diagnostic graph
     * @param {NeuralNetwork} network - Brain to visualize
     * @param {string} skinType - Selected agent skin for output labels
     */
    draw(network, skinType = "drone") {
        const ctx = this.ctx;
        const canvas = this.canvas;

        // Reset dimensions for responsive sizing
        const rect = canvas.parentNode.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        if (!network || !network.levels || network.levels.length === 0) {
            ctx.save();
            ctx.fillStyle = "#475569";
            ctx.font = "bold 0.75rem 'Outfit'";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("TIDAK ADA AGEN TERPILIH...", width / 2, height / 2);
            ctx.restore();
            return;
        }

        // Space settings
        const marginLeft = 40;
        const marginRight = 40;
        const marginTop = 30;
        const marginBottom = 20;

        const netWidth = width - marginLeft - marginRight;
        const netHeight = height - marginTop - marginBottom;

        // Structure counts
        const layersCount = network.neuronCounts.length;

        // 1. Compute node center coordinate grids
        const nodeCoords = [];
        for (let l = 0; l < layersCount; l++) {
            const nodesInLayer = network.neuronCounts[l];
            const layerX = marginLeft + (l / (layersCount - 1)) * netWidth;
            const layerArr = [];

            for (let n = 0; n < nodesInLayer; n++) {
                // Space nodes vertically
                let nodeY = 0;
                if (nodesInLayer === 1) {
                    nodeY = marginTop + netHeight / 2;
                } else {
                    nodeY = marginTop + (n / (nodesInLayer - 1)) * netHeight;
                }
                layerArr.push({ x: layerX, y: nodeY });
            }
            nodeCoords.push(layerArr);
        }

        // Update animation time step (flows pulse signals)
        this.pulseTime = (Date.now() * 0.0006) % 1.0;

        // 2. Draw Synapses / Connections (Weights)
        ctx.save();
        for (let l = 0; l < network.levels.length; l++) {
            const level = network.levels[l];
            const startNodes = nodeCoords[l];
            const endNodes = nodeCoords[l + 1];

            for (let i = 0; i < level.inputs.length; i++) {
                for (let j = 0; j < level.outputs.length; j++) {
                    const start = startNodes[i];
                    const end = endNodes[j];
                    const weight = level.weights[i][j];

                    // Width represents absolute magnitude of the weight
                    const wWidth = Math.max(0.25, Math.abs(weight) * 2.2);

                    // Connection Color: Cyan for positive weight (excitatory), Pink for negative weight (inhibitory)
                    const opacity = 0.08 + Math.abs(weight) * 0.22;
                    const wColor = weight >= 0 
                        ? `rgba(0, 242, 254, ${opacity})`  // Positive connection
                        : `rgba(255, 46, 147, ${opacity})`; // Negative connection

                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                    ctx.lineWidth = wWidth;
                    ctx.strokeStyle = wColor;
                    ctx.stroke();

                    // 3. Draw flowing connection signal pulses (only if weight represents a strong pathway)
                    if (Math.abs(weight) > 0.3) {
                        ctx.save();
                        // Pulse position lerped along line segment
                        // A slight delay added based on connection indices to scatter pulses
                        const offsetTime = (this.pulseTime + (i * 0.05) + (j * 0.03)) % 1.0;
                        const px = lerp(start.x, end.x, offsetTime);
                        const py = lerp(start.y, end.y, offsetTime);

                        ctx.beginPath();
                        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
                        ctx.fillStyle = weight >= 0 ? "#00ffd2" : "#ff2e93";
                        ctx.shadowBlur = 4;
                        ctx.shadowColor = weight >= 0 ? "#00f2fe" : "#ff2e93";
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
        }
        ctx.restore();

        // 4. Draw Neuron Nodes with active activation flows
        const nodeRadius = 8.5;
        for (let l = 0; l < layersCount; l++) {
            const nodesInLayer = network.neuronCounts[l];
            const level = l > 0 ? network.levels[l - 1] : null;

            for (let n = 0; n < nodesInLayer; n++) {
                const coord = nodeCoords[l][n];
                
                // Get node activation value
                let val = 0;
                if (l === 0) {
                    // Input Layer values read from first level inputs
                    val = network.levels[0].inputs[n];
                } else {
                    // Hidden/Output layer values read from previous level outputs
                    val = level.outputs[n];
                }

                ctx.save();
                ctx.beginPath();
                ctx.arc(coord.x, coord.y, nodeRadius, 0, Math.PI * 2);
                
                // Set glowing color based on node firing value
                // Positive activation firing (Cyan glow), Negative firing (Magenta glow)
                const nodeFiringGlow = val >= 0 
                    ? `rgba(0, 242, 254, ${0.1 + Math.abs(val) * 0.6})`
                    : `rgba(255, 46, 147, ${0.1 + Math.abs(val) * 0.6})`;

                ctx.fillStyle = "rgba(10, 15, 30, 0.9)";
                ctx.fill();

                // Draw solid border glowing with firing intensity
                ctx.strokeStyle = val >= 0 
                    ? `rgba(0, 242, 254, ${0.3 + Math.abs(val) * 0.7})` 
                    : `rgba(255, 46, 147, ${0.3 + Math.abs(val) * 0.7})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Draw central core that grows with value
                if (Math.abs(val) > 0.05) {
                    ctx.beginPath();
                    ctx.arc(coord.x, coord.y, nodeRadius * Math.abs(val) * 0.7, 0, Math.PI * 2);
                    ctx.fillStyle = val >= 0 ? "rgba(0, 242, 254, 0.85)" : "rgba(255, 46, 147, 0.85)";
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = val >= 0 ? "#00f2fe" : "#ff2e93";
                    ctx.fill();
                }
                ctx.restore();

                // 5. Draw node labels for Input (Left) and Output (Right) layers
                if (l === 0) {
                    // INPUT labels
                    ctx.save();
                    ctx.fillStyle = "#64748b";
                    ctx.font = "bold 0.65rem 'Fira Code'";
                    ctx.textAlign = "right";
                    ctx.textBaseline = "middle";
                    
                    const label = getInputLabel(n, network.neuronCounts[0] - 4);
                    ctx.fillText(label, coord.x - 13, coord.y);
                    ctx.restore();
                } else if (l === layersCount - 1) {
                    // OUTPUT labels
                    ctx.save();
                    ctx.fillStyle = "#00ff87";
                    ctx.font = "bold 0.65rem 'Fira Code'";
                    ctx.textAlign = "left";
                    ctx.textBaseline = "middle";
                    
                    const label = getOutputLabel(n, skinType);
                    ctx.fillText(label, coord.x + 13, coord.y);
                    ctx.restore();
                }
            }
        }
    }
}

/**
 * Returns descriptive labels for Neural Input Neurons
 */
function getInputLabel(index, rayCount) {
    if (index < rayCount) {
        return "S" + (index + 1); // Raycast sensors
    }
    
    // Auxiliary inputs index starting after rays
    const auxIndex = index - rayCount;
    const labels = [
        "T_SIN",  // sin relative angle to target
        "T_COS",  // cos relative angle to target
        "V_SPD",  // linear speed velocity
        "V_ROT"   // angular rotation velocity
    ];
    return labels[auxIndex] || "IN_" + index;
}

/**
 * Returns dynamic descriptions for Neural Output Neurons based on skin kinematics
 */
function getOutputLabel(index, skinType) {
    if (skinType === "drone") {
        return index === 0 ? "THR_L" : "THR_R"; // Left & Right thrusters
    } else if (skinType === "spaceship") {
        return index === 0 ? "THR_C" : "STR_M"; // Rear Engine / RCS Steering
    } else if (skinType === "ant") {
        return index === 0 ? "FWD_S" : "STR_A"; // Crawling speed / Steer angle
    }
    return "OUT_" + index;
}

/**
 * Linear Interpolation
 */
function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}
