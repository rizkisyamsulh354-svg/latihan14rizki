/**
 * ==========================================================================
 * NEURODRONES - APP ORCHESTRATOR & UI BINDER (app.js)
 * Glues the entire simulation system together. Manages the high-speed loops,
 * updates performance statistics, stores/loads trained brains, and handles
 * the responsive user interface.
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Instantiate Core Classes
    const env = new SimulationEnvironment("sim-canvas");
    const brainVis = new BrainVisualizer("brain-canvas");
    const chart = new EvolutionChart("chart-canvas");

    // 2. Default Configuration Parameters
    let generation = 1;
    let population = [];
    let stepCount = 0;
    
    // Config values (synced from UI)
    let popSize = 50;
    let mutationRate = 0.05; // 5%
    let lifespanSeconds = 12;
    let maxSteps = lifespanSeconds * 60; // 12s * 60fps = 720 frames
    let useElitism = true;

    let rayCount = 7;
    let raySpread = 140 * Math.PI / 180;
    let hiddenLayers = [8, 6];

    let currentSkin = "drone";
    let targetBehavior = "static";
    let frictionCoeff = 0.05;
    let showRays = true;

    // Execution states
    let simSpeed = 1; // 1, 2, 5, or "instant"
    let isRunning = true;
    let bestAgentInGen = null;
    let selectedAgent = null;

    // 3. UI Element References
    const elGen = document.querySelector("#stat-generation .stat-value");
    const elAlive = document.querySelector("#stat-alive .stat-value");
    const elMaxFit = document.querySelector("#stat-max-fitness .stat-value");
    const elSuccessRate = document.querySelector("#stat-success-rate .stat-value");

    const badgePopSize = document.getElementById("val-pop-size");
    const badgeMutation = document.getElementById("val-mutation-rate");
    const badgeLifespan = document.getElementById("val-lifespan");
    const badgeRayCount = document.getElementById("val-ray-count");
    const badgeRaySpread = document.getElementById("val-ray-spread");
    const badgeFriction = document.getElementById("val-friction");

    // Input Control Fields
    const sliderPopSize = document.getElementById("pop-size");
    const sliderMutation = document.getElementById("mutation-rate");
    const sliderLifespan = document.getElementById("lifespan");
    const sliderRayCount = document.getElementById("ray-count");
    const sliderRaySpread = document.getElementById("ray-spread");
    const sliderFriction = document.getElementById("friction");
    const selectSkin = document.getElementById("agent-skin");
    const selectTargetMode = document.getElementById("target-mode");
    const inputHiddenLayers = document.getElementById("hidden-layers");
    const checkElitism = document.getElementById("elitism");
    const checkRenderRays = document.getElementById("render-rays");

    const btnKill = document.getElementById("btn-kill");
    const btnReset = document.getElementById("btn-reset");
    const btnSaveBrain = document.getElementById("btn-save-brain");
    const btnLoadBrain = document.getElementById("btn-load-brain");
    const btnClearObstacles = document.getElementById("btn-clear-obstacles");

    // 4. Initialize Simulation & Parameters
    function initPopulation() {
        population = [];
        stepCount = 0;
        selectedAgent = null;

        // Parse layers counts: [inputs, ...hidden, outputs]
        const inputCount = rayCount + 4;
        const outputCount = 2;
        const layers = [inputCount, ...hiddenLayers, outputCount];

        for (let i = 0; i < popSize; i++) {
            population.push(new Agent(
                env.startX,
                env.startY,
                currentSkin,
                null, // creates a new random neural net
                rayCount,
                raySpread,
                hiddenLayers
            ));
        }

        bestAgentInGen = population[0];

        // Draw initial state once
        env.draw();
        chart.draw();
    }

    /**
     * Parse neural network structures input box safely
     */
    function updateHiddenLayers() {
        const value = inputHiddenLayers.value.trim();
        if (value === "") {
            hiddenLayers = [];
            return;
        }
        const parsed = value.split(",")
            .map(str => parseInt(str.trim()))
            .filter(num => !isNaN(num) && num > 0);
        
        if (parsed.length > 0) {
            hiddenLayers = parsed;
        } else {
            hiddenLayers = [8, 6]; // default fallbacks
        }
    }

    /**
     * Synchronizes and updates all configuration variables based on slider settings
     */
    function syncSettingsFromUI() {
        popSize = parseInt(sliderPopSize.value);
        badgePopSize.textContent = popSize;

        mutationRate = parseFloat(sliderMutation.value) / 100;
        badgeMutation.textContent = sliderMutation.value + "%";

        lifespanSeconds = parseInt(sliderLifespan.value);
        maxSteps = lifespanSeconds * 60;
        badgeLifespan.textContent = lifespanSeconds + "d";

        rayCount = parseInt(sliderRayCount.value);
        badgeRayCount.textContent = rayCount;

        const rawSpreadVal = parseInt(sliderRaySpread.value);
        raySpread = rawSpreadVal * Math.PI / 180;
        badgeRaySpread.textContent = rawSpreadVal + "°";

        frictionCoeff = parseFloat(sliderFriction.value);
        badgeFriction.textContent = sliderFriction.value;

        currentSkin = selectSkin.value;
        targetBehavior = selectTargetMode.value;
        env.targetMode = targetBehavior;
        useElitism = checkElitism.checked;
        showRays = checkRenderRays.checked;

        updateHiddenLayers();
    }

    // Bind UI slider change callbacks
    [sliderPopSize, sliderMutation, sliderLifespan, sliderRayCount, sliderRaySpread, sliderFriction, selectSkin, selectTargetMode, checkElitism, checkRenderRays].forEach(el => {
        el.addEventListener("input", syncSettingsFromUI);
        el.addEventListener("change", syncSettingsFromUI);
    });

    inputHiddenLayers.addEventListener("change", () => {
        syncSettingsFromUI();
        // Changing neural net shapes requires resetting evolution as brain structure resets
        triggerResetEvolution();
    });

    selectSkin.addEventListener("change", () => {
        syncSettingsFromUI();
        // Dynamically update skin visual representations on current agents immediately
        population.forEach(agent => {
            agent.skinType = currentSkin;
        });
    });

    // 5. Physics Sub-Stepping Loop
    /**
     * Executes a single physics iteration step across all agents
     * @returns {boolean} True if generation is finished (all dead or time's up)
     */
    function runPhysicsStep() {
        env.updateTarget();

        let aliveCount = 0;
        population.forEach(agent => {
            if (!agent.dead) {
                agent.update(env.obstacles, env.target, env.canvas.width, env.canvas.height, frictionCoeff);
                if (!agent.dead) aliveCount++;
            }
        });

        // Track stats UI
        elAlive.textContent = `${aliveCount} / ${popSize}`;

        // Find the current best agent of the live view (prioritize survival)
        let currentBest = null;
        let highestScore = -Infinity;
        population.forEach(agent => {
            let score = GeneticAlgorithm.computeFitness(agent, maxSteps);
            // Intermediate penalty in live view to highlight surviving agents that are moving forward
            if (agent.dead && !agent.completed) score *= 0.1; 
            if (score > highestScore) {
                highestScore = score;
                currentBest = agent;
            }
        });
        
        if (currentBest) {
            bestAgentInGen = currentBest;
        }

        // Check selected agent status to clear if deceased or finished
        if (selectedAgent && selectedAgent.dead && !selectedAgent.completed) {
            // keep selecting or clear? Let's keep it selected so user can see its final state,
            // but if they click something else or generation resets it will clear
        }

        // Return true if generation complete
        const allDead = population.every(agent => agent.dead);
        const timeUp = stepCount >= maxSteps;
        
        stepCount++;
        return allDead || timeUp;
    }

    // 6. Evolve Generation transition
    function evolveGeneration() {
        // Calculate Generation Statistics
        let reachedCount = 0;
        let totalFitness = 0;
        let maxFitness = 0;

        population.forEach(agent => {
            const fit = GeneticAlgorithm.computeFitness(agent, maxSteps);
            totalFitness += fit;
            if (fit > maxFitness) maxFitness = fit;
            if (agent.completed) reachedCount++;
        });

        const avgFitness = totalFitness / popSize;
        const successRate = Math.round((reachedCount / popSize) * 100);

        // Update statistics panels
        elGen.textContent = generation;
        elMaxFit.textContent = maxFitness.toFixed(2);
        elSuccessRate.textContent = `${successRate}% (${reachedCount} Drones)`;

        // Push data to historical line graphs
        chart.addGenerationData(generation, maxFitness, avgFitness, successRate);

        // Perform Tournament selection and crossovers to yield new generation
        population = GeneticAlgorithm.evolve(
            population,
            popSize,
            mutationRate,
            rayCount,
            raySpread,
            hiddenLayers,
            env.startX,
            env.startY,
            currentSkin,
            maxSteps,
            useElitism
        );

        generation++;
        stepCount = 0;
        bestAgentInGen = population[0];
        selectedAgent = null;
    }

    // 7. Interactive Agent Selection clicks
    env.canvas.addEventListener("mousedown", (e) => {
        // Only trigger clicks inside agent selection if we are NOT dragging target and NOT drawing walls
        if (env.isDraggingTarget || env.isDrawing) return;

        const rect = env.canvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) * (env.canvas.width / rect.width);
        const clickY = (e.clientY - rect.top) * (env.canvas.height / rect.height);

        // Find if user clicked within an alive agent boundary
        let clickedAgent = null;
        let minDist = 18; // maximum tolerance clicks radius

        population.forEach(agent => {
            if (!agent.dead) {
                const d = Math.hypot(clickX - agent.x, clickY - agent.y);
                if (d < minDist) {
                    minDist = d;
                    clickedAgent = agent;
                }
            }
        });

        if (clickedAgent) {
            selectedAgent = clickedAgent;
        } else {
            // clicked blank area: clear selection
            selectedAgent = null;
        }
    });

    // 8. Main requestAnimationFrame loop
    function loop() {
        if (!isRunning) return;

        let generationFinished = false;

        if (simSpeed === "instant") {
            // Evolve instantly: run physics steps continuously within a single animation frame
            // till generation completes
            let stepsExecuted = 0;
            const safetyThrottling = 10000; // prevent absolute lockups
            
            while (!generationFinished && stepsExecuted < safetyThrottling) {
                generationFinished = runPhysicsStep();
                stepsExecuted++;
            }
            
            if (generationFinished) {
                evolveGeneration();
            }
        } else {
            // Multi-speed sub-stepping updates
            for (let i = 0; i < simSpeed; i++) {
                generationFinished = runPhysicsStep();
                if (generationFinished) {
                    evolveGeneration();
                    break; // break early to prevent skipping steps in new generation
                }
            }
        }

        // Draw visuals (skipped in instant calculations except final frames, but inside frame loops we still draw to show transitions)
        env.draw();

        // Draw Agents
        population.forEach(agent => {
            const isBest = (agent === bestAgentInGen);
            const isSelected = (agent === selectedAgent);
            
            // Highlight sensory rays only for the currently active/selected agent
            const activeObserver = isSelected || (!selectedAgent && isBest);
            
            agent.sensor.draw(env.ctx, showRays && activeObserver);
            agent.draw(env.ctx, isBest);
            
            // Draw special visual pointer outline if selected
            if (isSelected) {
                env.ctx.save();
                env.ctx.beginPath();
                env.ctx.arc(agent.x, agent.y, agent.radius + 6, 0, Math.PI * 2);
                env.ctx.strokeStyle = "#00ff87";
                env.ctx.lineWidth = 1;
                env.ctx.stroke();
                env.ctx.restore();
            }
        });

        // Draw Active Neural Diagram diagnostic details
        const nnToDraw = selectedAgent ? selectedAgent.brain : (bestAgentInGen ? bestAgentInGen.brain : null);
        brainVis.draw(nnToDraw, currentSkin);

        // Continue main rendering cycle
        requestAnimationFrame(loop);
    }

    // 9. Controls Button Action Handlers
    function triggerResetEvolution() {
        generation = 1;
        elGen.textContent = "1";
        elMaxFit.textContent = "0.00";
        elSuccessRate.textContent = "0% (0 Drones)";
        chart.reset();
        initPopulation();
    }

    btnReset.addEventListener("click", () => {
        triggerResetEvolution();
    });

    btnKill.addEventListener("click", () => {
        // Forces instantaneous end of generation by killing all agents
        population.forEach(agent => {
            agent.dead = true;
        });
    });

    // Speed accelerators toggles
    document.querySelectorAll(".speed-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
            
            const spdValue = btn.dataset.speed;
            if (spdValue === "instant") {
                simSpeed = "instant";
                btn.classList.add("active");
            } else {
                simSpeed = parseInt(spdValue);
                btn.classList.add("active");
            }
        });
    });

    // Drawing wall tool switches
    document.querySelectorAll(".tool-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            if (btn.id === "btn-clear-obstacles") return; // clear handles separately
            document.querySelectorAll(".tool-btn").forEach(b => {
                if (b.id !== "btn-clear-obstacles") b.classList.remove("active");
            });
            btn.classList.add("active");
            env.currentTool = btn.dataset.tool;
        });
    });

    btnClearObstacles.addEventListener("click", () => {
        env.loadPreset("empty");
        // Reset preset button states
        document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
        document.querySelector("[data-preset='empty']").classList.add("active");
        
        // Trigger evolution reset because layout changed
        triggerResetEvolution();
    });

    // Map preset switch triggers
    document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const preset = btn.dataset.preset;
            env.reset(preset);
            
            // Wipes evolution on map structure alterations
            triggerResetEvolution();
        });
    });

    // Sidebar Config Panels Tabs Toggle
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            const tabId = btn.dataset.tab;
            document.getElementById(tabId).classList.add("active");
        });
    });

    // Brain IO LocalStorage Managers
    btnSaveBrain.addEventListener("click", () => {
        // Find best brain in current population
        let bestAgent = population[0];
        let bestFit = -1;

        population.forEach(agent => {
            const fit = GeneticAlgorithm.computeFitness(agent, maxSteps);
            if (fit > bestFit) {
                bestFit = fit;
                bestAgent = agent;
            }
        });

        if (bestAgent && bestAgent.brain) {
            const serialized = bestAgent.brain.toJSON();
            localStorage.setItem("neurodrones_best_brain", JSON.stringify(serialized));
            
            // Temporary button glow to show success saving
            const origText = btnSaveBrain.textContent;
            btnSaveBrain.textContent = "✓ OTAK DISIMPAN!";
            btnSaveBrain.style.borderColor = "#00ff87";
            btnSaveBrain.style.color = "#00ff87";
            setTimeout(() => {
                btnSaveBrain.textContent = origText;
                btnSaveBrain.style.borderColor = "";
                btnSaveBrain.style.color = "";
            }, 1800);
        }
    });

    btnLoadBrain.addEventListener("click", () => {
        const raw = localStorage.getItem("neurodrones_best_brain");
        if (!raw) {
            const origText = btnLoadBrain.textContent;
            btnLoadBrain.textContent = "✗ KOSONG!";
            btnLoadBrain.style.borderColor = "#ff2e93";
            btnLoadBrain.style.color = "#ff2e93";
            setTimeout(() => {
                btnLoadBrain.textContent = origText;
                btnLoadBrain.style.borderColor = "";
                btnLoadBrain.style.color = "";
            }, 1500);
            return;
        }

        try {
            const parsed = JSON.parse(raw);
            const loadedBrain = NeuralNetwork.fromJSON(parsed);
            
            if (loadedBrain) {
                // Set structural counts to match loaded brain
                rayCount = loadedBrain.neuronCounts[0] - 4;
                sliderRayCount.value = rayCount;
                badgeRayCount.textContent = rayCount;

                hiddenLayers = loadedBrain.neuronCounts.slice(1, -1);
                inputHiddenLayers.value = hiddenLayers.join(", ");

                // Reload entire population where ALL agents inherit clones of this saved brain
                // with standard mutations to continue evolving from this checkpoint
                generation = 1;
                elGen.textContent = "1";
                elMaxFit.textContent = "0.00";
                elSuccessRate.textContent = "0% (0 Drones)";
                chart.reset();

                population = [];
                stepCount = 0;
                selectedAgent = null;

                for (let i = 0; i < popSize; i++) {
                    const brainClone = NeuralNetwork.clone(loadedBrain);
                    // Mutate all clones except the very first one (injecting first one pure as elite)
                    if (i > 0) {
                        // Apply small standard mutation to scatter search
                        NeuralNetwork.mutate(brainClone, mutationRate);
                    }
                    
                    population.push(new Agent(
                        env.startX,
                        env.startY,
                        currentSkin,
                        brainClone,
                        rayCount,
                        raySpread,
                        hiddenLayers
                    ));
                }

                bestAgentInGen = population[0];

                // Success visual indicator glow
                const origText = btnLoadBrain.textContent;
                btnLoadBrain.textContent = "✓ OTAK DIMUAT!";
                btnLoadBrain.style.borderColor = "#00ffd2";
                btnLoadBrain.style.color = "#00ffd2";
                setTimeout(() => {
                    btnLoadBrain.textContent = origText;
                    btnLoadBrain.style.borderColor = "";
                    btnLoadBrain.style.color = "";
                }, 1800);

                env.draw();
                chart.draw();
            }
        } catch (e) {
            console.error("Failed to load brain from LocalStorage:", e);
        }
    });

    // 10. Start the simulator!
    syncSettingsFromUI();
    initPopulation();
    requestAnimationFrame(loop);
});
