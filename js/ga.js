/**
 * ==========================================================================
 * NEURODRONES - GENETIC ALGORITHM ENGINE (ga.js)
 * Manages the evolution cycle. Calculates fitness scores, sorts agents, preserves
 * elite survivors, performs tournament selection, crossover, and mutations.
 * ==========================================================================
 */

class GeneticAlgorithm {
    /**
     * Compute the final fitness score for an agent
     * @param {Agent} agent - Agent to score
     * @param {number} maxSteps - Lifespan of this generation in frames
     * @returns {number} Calculated fitness score (non-negative)
     */
    static computeFitness(agent, maxSteps) {
        let score = 0;

        // 1. Proximity component (how close did it get compared to initial distance)
        const minDistance = agent.minDistanceToTarget;
        const initialDistance = agent.initialDistance;

        if (initialDistance > 0) {
            // Normalized progress: 0 at start, 1 at target
            const progress = Math.max(0, 1 - minDistance / initialDistance);
            
            // Squaring creates exponential selection pressure for agents that reach closer
            score += progress * progress * 100;
        }

        // 2. Target completion bonus
        if (agent.completed) {
            // Large flat bonus for successfully hitting target
            score += 1000;

            // Efficiency speed bonus: rewards hitting the target early/fast
            const remainingSteps = Math.max(0, maxSteps - agent.reachedTargetTime);
            score += remainingSteps * 2.5; 
        }

        // 3. Collision / Survival Penalties
        // If an agent crashes into a wall without reaching target, penalize its fitness
        // to favor agents that survived longer or navigated safely
        if (!agent.completed && agent.dead) {
            // Apply 80% fitness reduction, preserving only 20% of progress made
            score *= 0.2;
        }

        return Math.max(0.001, score); // avoid absolute zero to prevent division issues
    }

    /**
     * Evolve the old agent population into a new generation
     * @returns {Agent[]} Array of new child agents
     */
    static evolve(oldPopulation, popSize, mutationRate, rayCount, raySpread, hiddenLayers, startX, startY, skinType, maxSteps, useElitism = true) {
        // 1. Calculate fitness for all parents
        oldPopulation.forEach(agent => {
            agent.fitness = GeneticAlgorithm.computeFitness(agent, maxSteps);
        });

        // 2. Sort population in descending order of fitness
        oldPopulation.sort((a, b) => b.fitness - a.fitness);

        const nextPopulation = [];
        
        // 3. Elitism: preserve top performing agents unchanged to prevent regression
        let eliteCount = 0;
        if (useElitism) {
            // Retain top 10% best agents
            eliteCount = Math.max(1, Math.round(popSize * 0.10));
            for (let i = 0; i < eliteCount; i++) {
                const eliteBrain = NeuralNetwork.clone(oldPopulation[i].brain);
                const eliteAgent = new Agent(
                    startX, 
                    startY, 
                    skinType, 
                    eliteBrain, 
                    rayCount, 
                    raySpread, 
                    hiddenLayers
                );
                nextPopulation.push(eliteAgent);
            }
        }

        // 4. Fill remaining population using selection, crossover, and mutation
        const remainingCount = popSize - eliteCount;
        for (let i = 0; i < remainingCount; i++) {
            // Select parents using Tournament Selection
            const parentA = GeneticAlgorithm.tournamentSelect(oldPopulation, 4);
            const parentB = GeneticAlgorithm.tournamentSelect(oldPopulation, 4);

            // Crossover parent genes
            const childBrain = NeuralNetwork.crossover(parentA.brain, parentB.brain);

            // Mutate child genes
            NeuralNetwork.mutate(childBrain, mutationRate);

            // Create new child agent
            const childAgent = new Agent(
                startX, 
                startY, 
                skinType, 
                childBrain, 
                rayCount, 
                raySpread, 
                hiddenLayers
            );
            nextPopulation.push(childAgent);
        }

        return nextPopulation;
    }

    /**
     * Tournament Selection
     * Randomly selects 'k' candidate agents and returns the one with the highest fitness
     * @param {Agent[]} population - Active population pool
     * @param {number} k - Tournament size
     * @returns {Agent} Selected winning agent parent
     */
    static tournamentSelect(population, k = 4) {
        let winner = null;
        for (let i = 0; i < k; i++) {
            const candidate = population[Math.floor(Math.random() * population.length)];
            if (winner === null || candidate.fitness > winner.fitness) {
                winner = candidate;
            }
        }
        return winner;
    }
}
