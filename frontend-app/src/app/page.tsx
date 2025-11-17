'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  gql,
  useMutation,
  useQuery,
  useSubscription,
} from '@apollo/client';
import { authApi, setAuthToken, teamApi, userApi } from '@/lib/api';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string | null;
  teamId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string | null;
};

type NotificationMessage = {
  id: string;
  message: string;
  createdAt: string;
};

type Team = {
  id: string;
  name: string;
  description?: string;
  members?: string[];
};

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  teamId?: string;
};

const TASK_FIELDS = gql`
  fragment TaskFields on Task {
    id
    title
    description
    status
    priority
    assignedTo
    teamId
    createdBy
    createdAt
    updatedAt
    dueDate
  }
`;

const GET_TASKS = gql`
  query GetTasks($teamId: ID!, $status: TaskStatus) {
    tasks(teamId: $teamId, status: $status) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`;

const GET_NOTIFICATIONS = gql`
  query Notifications($userId: ID!) {
    notifications(userId: $userId) {
      id
      message
      createdAt
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`;

const UPDATE_TASK = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`;

const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

const TASK_CREATED = gql`
  subscription TaskCreated($teamId: ID!) {
    taskCreated(teamId: $teamId) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`;

const TASK_UPDATED = gql`
  subscription TaskUpdated($teamId: ID!) {
    taskUpdated(teamId: $teamId) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`;

const TASK_DELETED = gql`
  subscription TaskDeleted($teamId: ID!) {
    taskDeleted(teamId: $teamId)
  }
`;

const NOTIFICATION_ADDED = gql`
  subscription NotificationAdded($userId: ID!) {
    notificationAdded(userId: $userId) {
      id
      message
      createdAt
    }
  }
`;

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    teamId: '',
  });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as Task['priority'],
    assignedTo: '',
    dueDate: '',
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [memberToAdd, setMemberToAdd] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);

  const hasSelectedTeam = Boolean(selectedTeam);

  const {
    data: tasksData,
    loading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery<{ tasks: Task[] }>(GET_TASKS, {
    variables: {
      teamId: selectedTeam,
      status: statusFilter ? statusFilter : null,
    },
    skip: !isLoggedIn || !hasSelectedTeam,
    fetchPolicy: 'cache-and-network',
  });

  const { data: notificationsData, refetch: refetchNotifications } = useQuery<{
    notifications: NotificationMessage[];
  }>(GET_NOTIFICATIONS, {
    variables: { userId: user?.id ?? '' },
    skip: !user,
    fetchPolicy: 'network-only',
  });

  const [createTaskMutation] = useMutation(CREATE_TASK, {
    onCompleted: () => {
      refetchTasks();
      setNewTask({
        title: '',
        description: '',
        priority: 'MEDIUM',
        assignedTo: '',
        dueDate: '',
      });
    },
  });

  const [updateTaskMutation] = useMutation(UPDATE_TASK, {
    onCompleted: () => {
      refetchTasks();
    },
  });

  const [deleteTaskMutation] = useMutation(DELETE_TASK, {
    onCompleted: () => {
      refetchTasks();
    },
  });

  useSubscription(TASK_CREATED, {
    variables: { teamId: selectedTeam },
    skip: !hasSelectedTeam,
    onData: ({ data }) => {
      const task = data.data?.taskCreated as Task | undefined;
      if (task) {
        pushNotification(`Task created: ${task.title}`);
        refetchTasks();
      }
    },
  });

  useSubscription(TASK_UPDATED, {
    variables: { teamId: selectedTeam },
    skip: !hasSelectedTeam,
    onData: ({ data }) => {
      const task = data.data?.taskUpdated as Task | undefined;
      if (task) {
        pushNotification(`Task updated: ${task.title}`);
        refetchTasks();
      }
    },
  });

  useSubscription(TASK_DELETED, {
    variables: { teamId: selectedTeam },
    skip: !hasSelectedTeam,
    onData: ({ data }) => {
      const taskId = data.data?.taskDeleted as string | undefined;
      if (taskId) {
        pushNotification(`Task removed`);
        refetchTasks();
      }
    },
  });

  useSubscription(NOTIFICATION_ADDED, {
    variables: { userId: user?.id ?? '' },
    skip: !user,
    onData: ({ data }) => {
      const notification = data.data?.notificationAdded as NotificationMessage | undefined;
      if (notification) {
        pushNotification(notification.message);
      }
    },
  });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (token && storedUser) {
      setAuthToken(token);
      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      setIsLoggedIn(true);
      setSelectedTeam(parsedUser.teamId || '');
      loadTeams();
      loadUsers();
      refetchNotifications({ userId: parsedUser.id });
    }
  }, [refetchNotifications]);

  useEffect(() => {
    if (isLoggedIn) {
      loadTeams();
      loadUsers();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (user && !selectedTeam && teams.length > 0) {
      const preferredTeam = user.teamId && teams.some((team) => team.id === user.teamId)
        ? user.teamId
        : teams[0].id;
      setSelectedTeam(preferredTeam);
    }
  }, [user, teams, selectedTeam]);

  useEffect(() => {
    if (notificationsData?.notifications) {
      setNotifications((prev) => {
        const localOnly = prev.filter((item) => item.id.startsWith('local-'));
        const serverSorted = notificationsData.notifications
          .slice()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return [...localOnly, ...serverSorted]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
      });
    }
  }, [notificationsData]);

  useEffect(() => {
    if (!selectedTeam) {
      setTeamMembers([]);
      setMemberToAdd('');
      return;
    }

    const fetchTeamMembers = async () => {
      try {
        setTeamLoading(true);
        const response = await teamApi.getTeam(selectedTeam);
        const team = response.data as Team;
        setTeamMembers(Array.isArray(team.members) ? team.members : []);
      } catch (error) {
        console.error('Failed to load team members', error);
        setTeamMembers([]);
      } finally {
        setTeamLoading(false);
      }
    };

    fetchTeamMembers();
  }, [selectedTeam]);

  const toggleAuthMode = () => {
    if (!isRegisterMode) {
      setRegisterSuccess(null);
    }
    setIsRegisterMode((prev) => !prev);
    setAuthError(null);
    setRegisterError(null);
    setRegisterForm({ name: '', email: '', password: '', confirmPassword: '', teamId: '' });
  };

  const pushNotification = (message: string) => {
    setNotifications((prev) => {
      const next: NotificationMessage[] = [
        {
          id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          message,
          createdAt: new Date().toISOString(),
        },
        ...prev.filter((notification) => notification.id.startsWith('local-')),
        ...prev.filter((notification) => !notification.id.startsWith('local-')),
      ];
      return next
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
    });
  };

  const loadTeams = async () => {
    try {
      const response = await teamApi.getTeams();
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to load teams', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await userApi.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setRegisterError(null);
    setRegisterSuccess(null);

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('Passwords do not match');
      return;
    }

    try {
      const emailForLogin = registerForm.email.trim();
      const payload = {
        name: registerForm.name.trim(),
        email: emailForLogin,
        password: registerForm.password,
        teamId: registerForm.teamId.trim() || undefined,
      };

      if (!payload.name || !payload.email || !payload.password) {
        setRegisterError('Name, email, and password are required');
        return;
      }

      const response = await authApi.register(payload);
      const successMessage = response.data?.message || 'Registration successful. Please log in to continue.';

      setRegisterSuccess(successMessage);
      setRegisterForm({ name: '', email: '', password: '', confirmPassword: '', teamId: '' });
      setIsRegisterMode(false);
      setLoginForm({ email: emailForLogin, password: '' });
      setAuthError(null);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Registration failed, please try again';
      setRegisterError(message);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    try {
      const response = await authApi.login(loginForm.email, loginForm.password);
      const { token, user: loggedInUser } = response.data as { token: string; user: User };
      setAuthToken(token);
      setUser(loggedInUser);
      setIsLoggedIn(true);
      setSelectedTeam(loggedInUser.teamId || '');
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(loggedInUser));
      }
      setLoginForm({ email: '', password: '' });
      loadTeams();
      loadUsers();
      await refetchNotifications({ userId: loggedInUser.id });
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Login failed, please check your credentials';
      setAuthError(message);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    setIsLoggedIn(false);
    setUser(null);
    setTeams([]);
    setUsers([]);
    setSelectedTeam('');
    setTeamMembers([]);
    setMemberToAdd('');
    setNotifications([]);
  };

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTeam || !newTask.title.trim()) {
      return;
    }
    try {
      await createTaskMutation({
        variables: {
          input: {
            title: newTask.title,
            description: newTask.description || undefined,
            priority: newTask.priority,
            assignedTo: newTask.assignedTo || undefined,
            teamId: selectedTeam,
            dueDate: newTask.dueDate || undefined,
          },
        },
      });
    } catch (error: any) {
      pushNotification(error.message || 'Failed to create task');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !memberToAdd) {
      return;
    }
    try {
      setTeamLoading(true);
      await teamApi.addMember(selectedTeam, memberToAdd);
      setMemberToAdd('');
      const response = await teamApi.getTeam(selectedTeam);
      const updated = response.data as Team;
      setTeamMembers(Array.isArray(updated.members) ? updated.members : []);
      pushNotification('Team member added');
    } catch (error: any) {
      pushNotification(error?.response?.data?.error || 'Failed to add member');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) {
      return;
    }
    try {
      setTeamLoading(true);
      await teamApi.removeMember(selectedTeam, userId);
      setTeamMembers((prev) => prev.filter((id) => id !== userId));
      pushNotification('Team member removed');
    } catch (error: any) {
      pushNotification(error?.response?.data?.error || 'Failed to remove member');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    try {
      await updateTaskMutation({
        variables: {
          id: taskId,
          input: { status },
        },
      });
    } catch (error: any) {
      pushNotification(error.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) {
      return;
    }
    try {
      await deleteTaskMutation({ variables: { id: taskId } });
    } catch (error: any) {
      pushNotification(error.message || 'Failed to delete task');
    }
  };

  const filteredTasks = useMemo(() => tasksData?.tasks ?? [], [tasksData]);

  const statusClasses: Record<Task['status'], string> = {
    TODO: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    REVIEW: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  const priorityClasses: Record<Task['priority'], string> = {
    LOW: 'text-gray-500',
    MEDIUM: 'text-blue-500',
    HIGH: 'text-orange-500',
    URGENT: 'text-red-500',
  };

  const availableUsers = useMemo(() => {
    if (!users.length) {
      return [] as User[];
    }
    return users.filter((u) => !teamMembers.includes(u.id));
  }, [users, teamMembers]);

  const membersWithDetails = useMemo(() => {
    return teamMembers
      .map((memberId) => users.find((u) => u.id === memberId))
      .filter((u): u is User => Boolean(u));
  }, [teamMembers, users]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
            {isRegisterMode ? 'Create an Account' : 'Task Manager Login'}
          </h1>
          <form
            onSubmit={isRegisterMode ? handleRegister : handleLogin}
            className="space-y-4"
          >
            {isRegisterMode ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={registerForm.name}
                    onChange={(event) =>
                      setRegisterForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="******"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(event) =>
                      setRegisterForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="******"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team ID (optional)</label>
                  <input
                    type="text"
                    value={registerForm.teamId}
                    onChange={(event) =>
                      setRegisterForm((prev) => ({ ...prev, teamId: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="Defaults to team 1"
                  />
                </div>
                {registerError && (
                  <p className="text-red-600 text-sm">{registerError}</p>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="admin@taskmanager.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="admin123"
                    required
                  />
                </div>
                {authError && <p className="text-red-600 text-sm">{authError}</p>}
                {registerSuccess && (
                  <p className="text-green-600 text-sm">{registerSuccess}</p>
                )}
              </>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {isRegisterMode ? 'Register' : 'Login'}
            </button>
          </form>
          <div className="mt-4 text-sm text-center text-gray-600">
            {isRegisterMode ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={toggleAuthMode}
                  className="text-blue-600 hover:underline"
                >
                  Back to login
                </button>
              </span>
            ) : (
              <span>
                Need an account?{' '}
                <button
                  type="button"
                  onClick={toggleAuthMode}
                  className="text-blue-600 hover:underline"
                >
                  Create one
                </button>
              </span>
            )}
          </div>
          {!isRegisterMode && (
            <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-semibold mb-2">Demo Accounts</p>
              <ul className="space-y-1">
                <li>Admin · admin@taskmanager.com / admin123</li>
                <li>User · user@taskmanager.com / user123</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Task Management Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleLogout}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {notifications.length > 0 && (
          <section className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg text-sm"
              >
                🔔 {notification.message}
              </div>
            ))}
          </section>
        )}

        {!selectedTeam ? (
          <section className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
            Select a team to view and manage its tasks.
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <section className="md:col-span-1 lg:col-span-1 bg-white rounded-lg shadow p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Create Task</h2>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    value={newTask.title}
                    onChange={(event) => setNewTask((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(event) => setNewTask((prev) => ({ ...prev, description: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(event) =>
                      setNewTask((prev) => ({ ...prev, priority: event.target.value as Task['priority'] }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                  <select
                    value={newTask.assignedTo}
                    onChange={(event) => setNewTask((prev) => ({ ...prev, assignedTo: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(event) => setNewTask((prev) => ({ ...prev, dueDate: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Create Task
                </button>
              </form>
            </section>

            <section className="md:col-span-1 lg:col-span-1 bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Team Members</h2>
                {teamLoading && <span className="text-xs text-gray-400">Loading…</span>}
              </div>
              {membersWithDetails.length === 0 ? (
                <p className="text-sm text-gray-500">No members assigned to this team yet.</p>
              ) : (
                <ul className="space-y-2">
                  {membersWithDetails.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Add Member</label>
                <div className="flex gap-2">
                  <select
                    value={memberToAdd}
                    onChange={(event) => setMemberToAdd(event.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select user</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddMember}
                    type="button"
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={!memberToAdd}
                  >
                    Add
                  </button>
                </div>
              </div>
            </section>

            <section className="md:col-span-2 lg:col-span-2 bg-white rounded-lg shadow p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Tasks</h2>
                <div className="flex gap-3">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All status</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">Review</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <button
                    onClick={() => refetchTasks()}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {tasksLoading ? (
                <p className="text-gray-500">Loading tasks...</p>
              ) : filteredTasks.length === 0 ? (
                <p className="text-gray-500">No tasks found for the selected filters.</p>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-gray-800">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-gray-600">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`px-2 py-1 rounded ${statusClasses[task.status]}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                            <span className={`font-semibold ${priorityClasses[task.priority]}`}>
                              {task.priority}
                            </span>
                            {task.assignedTo && (
                              <span className="text-gray-500">
                                Assigned to {users.find((u) => u.id === task.assignedTo)?.name || task.assignedTo}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="text-gray-500">
                                Due {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-red-500 hover:text-red-600 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {(['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED'] as Task['status'][]).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(task.id, status)}
                            disabled={task.status === status}
                            className={`px-3 py-1 rounded border transition ${
                              task.status === status
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}