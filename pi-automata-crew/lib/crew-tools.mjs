import { ask_support, tell_information, publish_event } from './lib/communication/index.mjs';
import { createDiscussion, commentOnDiscussion, listComments, updateDiscussion, deleteDiscussion } from '../pi-git-extension/lib/discussions.mjs';

// Register crew tools with Fabric
export const tools = {
  // Communication tools
  ask_support: {
    name: 'ask_support',
    description: 'Ask support question and create GitHub discussion',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID asking for support' },
        question: { type: 'string', description: 'Question text' }
      },
      required: ['agentId', 'question']
    },
    handler: ask_support
  },
  
  tell_information: {
    name: 'tell_information',
    description: 'Tell information to agent and create GitHub discussion',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID to inform' },
        info: { type: 'string', description: 'Information text' }
      },
      required: ['agentId', 'info']
    },
    handler: tell_information
  },
  
  publish_event: {
    name: 'publish_event',
    description: 'Publish event to mesh',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Event topic' },
        data: { type: 'object', description: 'Event data' }
      },
      required: ['topic']
    },
    handler: publish_event
  },
  
  // Git tools (re-exported from git-extension)
  createDiscussion: {
    name: 'createDiscussion',
    description: 'Create GitHub discussion',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', default: 'MockaSort-Studio' },
        repo: { type: 'string', default: 'hall-of-automata-cli' },
        title: { type: 'string' },
        body: { type: 'string' },
        category: { type: 'string', default: 'General' },
        options: {
          type: 'object',
          properties: {
            labels: { type: 'array', items: { type: 'string' } },
            assignees: { type: 'array', items: { type: 'string' } },
            projectId: { type: 'number' },
            notify: { type: 'boolean' }
          }
        }
      },
      required: ['title', 'body']
    },
    handler: createDiscussion
  },
  
  commentOnDiscussion: {
    name: 'commentOnDiscussion',
    description: 'Comment on GitHub discussion',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', default: 'MockaSort-Studio' },
        repo: { type: 'string', default: 'hall-of-automata-cli' },
        number: { type: 'number' },
        body: { type: 'string' }
      },
      required: ['number', 'body']
    },
    handler: commentOnDiscussion
  },
  
  listComments: {
    name: 'listComments',
    description: 'List comments on GitHub discussion',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', default: 'MockaSort-Studio' },
        repo: { type: 'string', default: 'hall-of-automata-cli' },
        number: { type: 'number' },
        limit: { type: 'number', default: 20 }
      },
      required: ['number']
    },
    handler: listComments
  },
  
  updateDiscussion: {
    name: 'updateDiscussion',
    description: 'Update GitHub discussion',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', default: 'MockaSort-Studio' },
        repo: { type: 'string', default: 'hall-of-automata-cli' },
        number: { type: 'number' },
        title: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['number']
    },
    handler: updateDiscussion
  },
  
  deleteDiscussion: {
    name: 'deleteDiscussion',
    description: 'Delete GitHub discussion',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', default: 'MockaSort-Studio' },
        repo: { type: 'string', default: 'hall-of-automata-cli' },
        number: { type: 'number' }
      },
      required: ['number']
    },
    handler: deleteDiscussion
  }
};

// Auto-register when loaded in Fabric context
if (typeof tools !== 'undefined' && tools.register) {
  Object.entries(tools).forEach(([name, tool]) => {
    tools.register(tool);
  });
  console.log('Automata Crew tools registered:', Object.keys(tools).join(', '));
}

export default tools;