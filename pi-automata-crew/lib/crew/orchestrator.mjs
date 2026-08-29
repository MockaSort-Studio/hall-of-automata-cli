
/**
 * Crew Orchestrator
 * Implements Recruit, Route, Watch, Review pattern
 * Spawns lead + specialists via agents.create()
 * Uses mesh for inter-agent communication
 */

import { agents, mesh } from '@earendil-works/pi-coding-agent';

class CrewOrchestrator {
  constructor(config = {}) {
    this.config = {
      leadAgent: 'crew-lead',
      specialistTypes: ['analyst', 'developer', 'tester'],
      ...config
    };
    this.agents = new Map();
    this.dispatchId = null;
  }

  /**
   * Recruit: Spawn lead and specialist agents
   */
  async recruit(dispatchId) {
    this.dispatchId = dispatchId || 
      (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString());
    
    console.log(`[Orchestrator] Recruiting agents for dispatch ${this.dispatchId}`);
    
    // Spawn lead agent
    const lead = await agents.create({
      name: `${this.config.leadAgent}-${this.dispatchId}`,
      role: 'Crew Lead',
      scope: this.dispatchId
    });
    this.agents.set('lead', lead);
    
    // Spawn specialists
    for (const type of this.config.specialistTypes) {
      const specialist = await agents.create({
        name: `${type}-${this.dispatchId}`,
        role: type.charAt(0).toUpperCase() + type.slice(1),
        scope: this.dispatchId
      });
      this.agents.set(type, specialist);
    }
    
    console.log(`[Orchestrator] Recruited ${this.agents.size} agents`);
    return Array.from(this.agents.keys());
  }

  /**
   * Route: Distribute task to appropriate agent
   */
  async route(task, options = {}) {
    const { to, priority = 'normal' } = options;
    
    if (to && this.agents.has(to)) {
      const agent = this.agents.get(to);
      const result = await agent.send(task);
      return { routed: true, agent: to, result };
    }
    
    // Default routing: send to lead
    const lead = this.agents.get('lead');
    if (lead) {
      const result = await lead.send(task);
      return { routed: true, agent: 'lead', result };
    }
    
    throw new Error('No agents available for routing');
  }

  /**
   * Watch: Monitor agent progress via mesh
   */
  async watch(dispatchId, callback) {
    const topic = `dispatch-${dispatchId}`;
    
    mesh.read({
      topic,
      onMessage: (message) => {
        if (message.data?.progress !== undefined) {
          callback({ 
            agent: message.from, 
            progress: message.data.progress,
            timestamp: message.createdAt
          });
        }
      }
    });
    
    return { watching: true, topic };
  }

  /**
   * Review: Collect and validate results from all agents
   */
  async review(dispatchId) {
    const results = [];
    const topic = `dispatch-${dispatchId}-results`;
    
    // Read results from mesh
    const messages = await mesh.get(topic);
    
    for (const message of messages || []) {
      if (message.data?.result) {
        results.push({
          agent: message.from,
          result: message.data.result,
          timestamp: message.createdAt
        });
      }
    }
    
    // Validate all required agents have reported
    const expectedAgents = Array.from(this.agents.keys());
    const reportedAgents = results.map(r => r.agent);
    const missing = expectedAgents.filter(a => !reportedAgents.includes(a));
    
    return {
      complete: missing.length === 0,
      results,
      missingAgents: missing,
      timestamp: Date.now()
    };
  }

  /**
   * Full orchestration cycle
   */
  async orchestrate(task, options = {}) {
    const dispatchId = this.dispatchId || 
      (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString());
    
    // Recruit agents
    await this.recruit(dispatchId);
    
    // Route task
    const routing = await this.route(task, options);
    
    // Watch progress (fire and forget for now)
    this.watch(dispatchId, (progress) => {
      console.log(`[Watch] Progress: ${JSON.stringify(progress)}`);
    });
    
    // Wait a bit for results to propagate
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Review results
    const review = await this.review(dispatchId);
    
    return { dispatchId, routing, review };
  }
}

export { CrewOrchestrator };
