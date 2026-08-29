
/**
 * Mesh Coordinator
 * Manages topic management (scoped per dispatch)
 * Event routing with "to" field checking
 * Write-then-tell enforcement
 */

import { mesh } from '@earendil-works/pi-coding-agent';

class MeshCoordinator {
  constructor(config = {}) {
    this.config = {
      scopePrefix: 'dispatch',
      enforceWriteThenTell: true,
      ...config
    };
    this.scopedTopics = new Map();
    this.pendingWrites = new Map();
  }

  /**
   * Create a scoped topic for a dispatch
   */
  createScopedTopic(dispatchId, topicName) {
    const scopedTopic = `${this.config.scopePrefix}-${dispatchId}-${topicName}`;
    
    if (!this.scopedTopics.has(dispatchId)) {
      this.scopedTopics.set(dispatchId, new Set());
    }
    
    const dispatchTopics = this.scopedTopics.get(dispatchId);
    dispatchTopics.add(scopedTopic);
    
    console.log(`[MeshCoordinator] Created scoped topic: ${scopedTopic}`);
    return scopedTopic;
  }

  /**
   * Cleanup scoped topics for a dispatch
   */
  cleanupDispatch(dispatchId) {
    const topics = this.scopedTopics.get(dispatchId);
    if (topics) {
      for (const topic of topics) {
        // In a real implementation, we might clean up subscriptions
        console.log(`[MeshCoordinator] Cleaning up topic: ${topic}`);
      }
      this.scopedTopics.delete(dispatchId);
    }
    
    // Clean up pending writes for this dispatch
    for (const [key, value] of this.pendingWrites) {
      if (key.startsWith(dispatchId)) {
        this.pendingWrites.delete(key);
      }
    }
  }

  /**
   * Route event to appropriate agent based on "to" field
   */
  async routeEvent(message) {
    const { to, topic, data, from } = message;
    
    // Check if message has a "to" field
    if (to) {
      // Validate that the target exists in the mesh
      const members = await mesh.members();
      const targetExists = members.some(m => m.id === to || m.name === to);
      
      if (!targetExists) {
        console.warn(`[MeshCoordinator] Target ${to} not found in mesh members`);
        return { routed: false, error: 'Target not found' };
      }
      
      // Route the message to the specific agent
      const routedMessage = {
        ...message,
        topic: to, // Use target as topic for direct routing
        data: {
          ...data,
          _originalTopic: topic,
          _routedBy: 'mesh-coordinator',
          _from: from
        }
      };
      
      mesh.publish(routedMessage);
      console.log(`[MeshCoordinator] Routed message to ${to}`);
      return { routed: true, target: to };
    }
    
    // No "to" field, broadcast to all or handle differently
    console.log(`[MeshCoordinator] No "to" field, broadcasting to topic ${topic}`);
    mesh.publish(message);
    return { routed: true, broadcast: true };
  }

  /**
   * Write-then-tell enforcement
   * Ensures data is written before notifications are sent
   */
  async writeThenTell(dispatchId, writeKey, data, notification) {
    if (!this.config.enforceWriteThenTell) {
      // If enforcement is disabled, just publish notification
      mesh.publish(notification);
      return { written: false, notified: true };
    }
    
    const writeKeyWithScope = `${dispatchId}-${writeKey}`;
    
    // Write the data first
    await mesh.put(writeKeyWithScope, data);
    this.pendingWrites.set(writeKeyWithScope, { data, timestamp: Date.now() });
    
    console.log(`[MeshCoordinator] Written data to ${writeKeyWithScope}`);
    
    // Then publish the notification
    mesh.publish(notification);
    console.log(`[MeshCoordinator] Published notification after write`);
    
    // Clean up pending write after notification
    this.pendingWrites.delete(writeKeyWithScope);
    
    return { written: true, notified: true, key: writeKeyWithScope };
  }

  /**
   * Verify write-then-tell was followed
   */
  async verifyWriteThenTell(dispatchId, writeKey) {
    const writeKeyWithScope = `${dispatchId}-${writeKey}`;
    
    // Check if write exists
    const writtenData = await mesh.get(writeKeyWithScope);
    
    if (!writtenData) {
      return { valid: false, error: 'No write found', writeKey: writeKeyWithScope };
    }
    
    // Check if there are pending writes (should be cleaned up after notification)
    const hasPending = this.pendingWrites.has(writeKeyWithScope);
    
    return {
      valid: !hasPending,
      writeExists: true,
      pendingWrite: hasPending,
      writeKey: writeKeyWithScope
    };
  }

  /**
   * Subscribe to a scoped topic with automatic routing
   */
  subscribeScoped(dispatchId, topicName, handler) {
    const scopedTopic = this.createScopedTopic(dispatchId, topicName);
    
    mesh.read({
      topic: scopedTopic,
      onMessage: async (message) => {
        // Auto-route based on "to" field if present
        if (message.to) {
          const routeResult = await this.routeEvent(message);
          if (!routeResult.routed) {
            console.warn(`[MeshCoordinator] Failed to route message: ${JSON.stringify(routeResult)}`);
          }
        }
        
        // Call the handler
        handler(message);
      }
    });
    
    return { topic: scopedTopic, unsubscribe: () => {
      // In a real implementation, we'd have a way to unsubscribe
      console.log(`[MeshCoordinator] Unsubscribed from ${scopedTopic}`);
    }};
  }
}

export { MeshCoordinator };
