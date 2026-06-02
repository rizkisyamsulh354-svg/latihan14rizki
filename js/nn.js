/**
 * ==========================================================================
 * NEURODRONES - NEURAL NETWORK ENGINE (nn.js)
 * Fully local Multilayer Feedforward Neural Network implementation.
 * Supports customizable hidden layers, mutations, crossovers, and saving/loading.
 * ==========================================================================
 */

class Level {
    constructor(inputCount, outputCount) {
        this.inputs = new Float32Array(inputCount);
        this.outputs = new Float32Array(outputCount);
        this.biases = new Float32Array(outputCount);
        this.weights = [];

        for (let i = 0; i < inputCount; i++) {
            this.weights.push(new Float32Array(outputCount));
        }

        Level.#randomize(this);
    }

    /**
     * Randomize weights and biases between -1 and 1
     */
    static #randomize(level) {
        for (let i = 0; i < level.inputs.length; i++) {
            for (let j = 0; j < level.outputs.length; j++) {
                level.weights[i][j] = Math.random() * 2 - 1;
            }
        }

        for (let i = 0; i < level.biases.length; i++) {
            level.biases[i] = Math.random() * 2 - 1;
        }
    }

    /**
     * Compute feedforward for a single layer/level using tanh activation
     */
    static feedForward(givenInputs, level) {
        // Copy input values
        for (let i = 0; i < level.inputs.length; i++) {
            level.inputs[i] = givenInputs[i];
        }

        // Compute output activations
        for (let i = 0; i < level.outputs.length; i++) {
            let sum = 0;
            for (let j = 0; j < level.inputs.length; j++) {
                sum += level.inputs[j] * level.weights[j][i];
            }
            sum += level.biases[i];
            
            // Hyperbolic Tangent (tanh) yields smooth control outputs between -1 and 1
            level.outputs[i] = Math.tanh(sum);
        }

        return level.outputs;
    }
}

class NeuralNetwork {
    constructor(neuronCounts) {
        this.levels = [];
        this.neuronCounts = neuronCounts;
        
        for (let i = 0; i < neuronCounts.length - 1; i++) {
            this.levels.push(new Level(neuronCounts[i], neuronCounts[i + 1]));
        }
    }

    /**
     * Propagate input values through all layers of the network
     */
    feedForward(inputs) {
        let outputs = Level.feedForward(inputs, this.levels[0]);
        for (let i = 1; i < this.levels.length; i++) {
            outputs = Level.feedForward(outputs, this.levels[i]);
        }
        return outputs;
    }

    /**
     * Mutate weights and biases with Gaussian-like scaling
     * @param {NeuralNetwork} network - Target network to mutate
     * @param {number} rate - Mutation rate (0.0 to 1.0)
     */
    static mutate(network, rate = 0.05) {
        network.levels.forEach(level => {
            // Mutate biases
            for (let i = 0; i < level.biases.length; i++) {
                if (Math.random() < rate) {
                    // Smooth adaptation: add small random change instead of fully replacing
                    const change = (Math.random() * 2 - 1) * 0.5;
                    level.biases[i] = Math.max(-1, Math.min(1, level.biases[i] + change));
                }
            }

            // Mutate weights
            for (let i = 0; i < level.inputs.length; i++) {
                for (let j = 0; j < level.outputs.length; j++) {
                    if (Math.random() < rate) {
                        const change = (Math.random() * 2 - 1) * 0.5;
                        level.weights[i][j] = Math.max(-1, Math.min(1, level.weights[i][j] + change));
                    }
                }
            }
        });
    }

    /**
     * Merge the genetic weights of parent A and parent B (Uniform Crossover)
     * @param {NeuralNetwork} networkA - Parent A
     * @param {NeuralNetwork} networkB - Parent B
     * @returns {NeuralNetwork} Child neural network
     */
    static crossover(networkA, networkB) {
        const child = new NeuralNetwork(networkA.neuronCounts);
        
        for (let l = 0; l < child.levels.length; l++) {
            const levelC = child.levels[l];
            const levelA = networkA.levels[l];
            const levelB = networkB.levels[l];

            // Crossover biases
            for (let i = 0; i < levelC.biases.length; i++) {
                levelC.biases[i] = Math.random() < 0.5 ? levelA.biases[i] : levelB.biases[i];
            }

            // Crossover weights
            for (let i = 0; i < levelC.inputs.length; i++) {
                for (let j = 0; j < levelC.outputs.length; j++) {
                    levelC.weights[i][j] = Math.random() < 0.5 ? levelA.weights[i][j] : levelB.weights[i][j];
                }
            }
        }
        
        return child;
    }

    /**
     * Create an exact clone of this neural network
     */
    static clone(network) {
        const cloned = new NeuralNetwork(network.neuronCounts);
        for (let l = 0; l < network.levels.length; l++) {
            const src = network.levels[l];
            const dest = cloned.levels[l];

            // Copy biases
            for (let i = 0; i < src.biases.length; i++) {
                dest.biases[i] = src.biases[i];
            }

            // Copy weights
            for (let i = 0; i < src.inputs.length; i++) {
                for (let j = 0; j < src.outputs.length; j++) {
                    dest.weights[i][j] = src.weights[i][j];
                }
            }
        }
        return cloned;
    }

    /**
     * Serialize neural network to JSON-ready object
     */
    toJSON() {
        return {
            neuronCounts: this.neuronCounts,
            levels: this.levels.map(level => {
                return {
                    biases: Array.from(level.biases),
                    weights: level.weights.map(row => Array.from(row))
                };
            })
        };
    }

    /**
     * Restore neural network from serialized JSON structure
     */
    static fromJSON(data) {
        if (!data || !data.neuronCounts) return null;
        
        const network = new NeuralNetwork(data.neuronCounts);
        for (let l = 0; l < network.levels.length; l++) {
            const dest = network.levels[l];
            const src = data.levels[l];
            
            if (!src) continue;

            // Restore biases
            for (let i = 0; i < dest.biases.length; i++) {
                if (src.biases[i] !== undefined) dest.biases[i] = src.biases[i];
            }

            // Restore weights
            for (let i = 0; i < dest.inputs.length; i++) {
                for (let j = 0; j < dest.outputs.length; j++) {
                    if (src.weights[i] && src.weights[i][j] !== undefined) {
                        dest.weights[i][j] = src.weights[i][j];
                    }
                }
            }
        }
        return network;
    }
}
