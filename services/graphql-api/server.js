const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const pubsub = new PubSub();

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:3000', // API Gateway
    'http://localhost:3002', // Frontend
    'http://api-gateway:3000', // Docker container name
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// In-memory data store (replace with real database in production)
let tasks = [
  {
    id: '1',
    title: 'Setup Project Infrastructure',
    description: 'Initialize microservices architecture with Docker',
    status: 'COMPLETED',
    priority: 'HIGH',
    assignedTo: '1',
    teamId: '1',
    createdBy: '1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    title: 'Implement JWT Authentication',
    description: 'Add JWT-based authentication with RSA keys',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignedTo: '2',
    teamId: '1',
    createdBy: '1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

let notifications = [
  {
    id: '1',
    userId: '2',
    message: 'You have been assigned to task: Implement JWT Authentication',
    type: 'TASK_ASSIGNED',
    read: false,
    createdAt: new Date().toISOString(),
    taskId: '2'
  }
];

// GraphQL type definitions
const typeDefs = `
  enum TaskStatus {
    TODO
    IN_PROGRESS
    REVIEW
    COMPLETED
    CANCELLED
  }

  enum TaskPriority {
    LOW
    MEDIUM
    HIGH
    URGENT
  }

  type Task {
    id: ID!
    title: String!
    description: String
    status: TaskStatus!
    priority: TaskPriority!
    assignedTo: ID
    teamId: ID!
    createdBy: ID!
    createdAt: String!
    updatedAt: String!
    dueDate: String
  }

  type Notification {
    id: ID!
    userId: ID!
    message: String!
    type: String!
    read: Boolean!
    createdAt: String!
    taskId: ID
  }

  type Query {
    tasks(teamId: ID, assignedTo: ID, status: TaskStatus): [Task!]!
    task(id: ID!): Task
    notifications(userId: ID!): [Notification!]!
  }

  input CreateTaskInput {
    title: String!
    description: String
    priority: TaskPriority!
    assignedTo: ID
    teamId: ID!
    dueDate: String
  }

  input UpdateTaskInput {
    title: String
    description: String
    status: TaskStatus
    priority: TaskPriority
    assignedTo: ID
    dueDate: String
  }

  type Mutation {
    createTask(input: CreateTaskInput!): Task!
    updateTask(id: ID!, input: UpdateTaskInput!): Task!
    deleteTask(id: ID!): Boolean!
    markNotificationRead(id: ID!): Boolean!
  }

  type Subscription {
    taskCreated(teamId: ID!): Task!
    taskUpdated(teamId: ID!): Task!
    taskDeleted(teamId: ID!): ID!
    notificationAdded(userId: ID!): Notification!
  }
`;

// GraphQL resolvers
const resolvers = {
  Query: {
    tasks: (_, { teamId, assignedTo, status }) => {
      let filteredTasks = tasks;
      
      if (teamId) {
        filteredTasks = filteredTasks.filter(task => task.teamId === teamId);
      }
      if (assignedTo) {
        filteredTasks = filteredTasks.filter(task => task.assignedTo === assignedTo);
      }
      if (status) {
        filteredTasks = filteredTasks.filter(task => task.status === status);
      }
      
      return filteredTasks;
    },
    task: (_, { id }) => tasks.find(task => task.id === id),
    notifications: (_, { userId }) => notifications.filter(notif => notif.userId === userId),
  },

  Mutation: {
    createTask: (_, { input }, { req }) => {
      const createdBy = req && req.headers.user ? JSON.parse(req.headers.user).id : '1';
      
      const newTask = {
        id: uuidv4(),
        ...input,
        status: 'TODO',
        createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      tasks.push(newTask);
      
      if (input.assignedTo && input.assignedTo !== createdBy) {
        const notification = {
          id: uuidv4(),
          userId: input.assignedTo,
          message: `You have been assigned a new task: ${input.title}`,
          type: 'TASK_ASSIGNED',
          read: false,
          createdAt: new Date().toISOString(),
          taskId: newTask.id
        };
        notifications.push(notification);
        pubsub.publish(`NOTIFICATION_ADDED_${input.assignedTo}`, { notificationAdded: notification });
      }
      
      pubsub.publish(`TASK_CREATED_${input.teamId}`, { taskCreated: newTask });
      return newTask;
    },

    updateTask: (_, { id, input }) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) throw new Error('Task not found');

      const oldTask = tasks[taskIndex];
      const updatedTask = {
        ...oldTask,
        ...input,
        updatedAt: new Date().toISOString(),
      };

      tasks[taskIndex] = updatedTask;
      
      if (input.status && input.status !== oldTask.status && updatedTask.assignedTo) {
        const notification = {
          id: uuidv4(),
          userId: updatedTask.assignedTo,
          message: `Task "${updatedTask.title}" status changed to ${input.status}`,
          type: 'TASK_STATUS_CHANGED',
          read: false,
          createdAt: new Date().toISOString(),
          taskId: updatedTask.id
        };
        notifications.push(notification);
        pubsub.publish(`NOTIFICATION_ADDED_${updatedTask.assignedTo}`, { notificationAdded: notification });
      }
      
      pubsub.publish(`TASK_UPDATED_${updatedTask.teamId}`, { taskUpdated: updatedTask });
      return updatedTask;
    },

    deleteTask: (_, { id }) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) return false;

      const task = tasks[taskIndex];
      tasks.splice(taskIndex, 1);
      notifications = notifications.filter(notif => notif.taskId !== id);
      pubsub.publish(`TASK_DELETED_${task.teamId}`, { taskDeleted: id });
      return true;
    },

    markNotificationRead: (_, { id }) => {
      const notification = notifications.find(notif => notif.id === id);
      if (!notification) return false;
      notification.read = true;
      return true;
    },
  },

  Subscription: {
    taskCreated: {
      subscribe: (_, { teamId }) => pubsub.asyncIterator([`TASK_CREATED_${teamId}`]),
    },
    taskUpdated: {
      subscribe: (_, { teamId }) => pubsub.asyncIterator([`TASK_UPDATED_${teamId}`]),
    },
    taskDeleted: {
      subscribe: (_, { teamId }) => pubsub.asyncIterator([`TASK_DELETED_${teamId}`]),
    },
    notificationAdded: {
      subscribe: (_, { userId }) => pubsub.asyncIterator([`NOTIFICATION_ADDED_${userId}`]),
    },
  },
};

async function startServer() {
  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      // Add authentication logic here if needed
      return { req };
    },
    plugins: [
      {
        requestDidStart() {
          return {
            willSendResponse(requestContext) {
              console.log(`GraphQL ${requestContext.request.operationName || 'Anonymous'} operation completed`);
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  
  const httpServer = app.listen(PORT, () => {
    console.log(`🚀 Task Service (GraphQL) running on port ${PORT}`);
    console.log(`🔗 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📊 GraphQL Playground: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📡 Subscriptions ready`);
  });

  // Setup subscriptions
  // server.installSubscriptionHandlers(httpServer);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Process terminated');
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Task Service (GraphQL)',
    timestamp: new Date().toISOString(),
    data: {
      tasks: tasks.length,
      notifications: notifications.length
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('GraphQL API Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});