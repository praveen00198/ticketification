import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  MapPin,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
  Users,
  X,
  Tag,
} from 'lucide-react';
import {
  eventsApi,
  EventTaskItem,
  EventMemberItem,
  CreateEventTaskPayload,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '../../api/events';

interface EventTaskManagerCardProps {
  eventId: string;
  isHostOrCoordinator?: boolean;
}

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  REGISTRATION: 'Admissions & Badge Desk',
  SECURITY: 'Access & Crowd Security',
  LOGISTICS: 'Swag & Supplies Logistics',
  HOSPITALITY: 'VIP & Speaker Hospitality',
  TECHNICAL: 'AV & Technical Support',
  GENERAL: 'General Operations',
};

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  MEDIUM: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  LOW: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

export const EventTaskManagerCard: React.FC<EventTaskManagerCardProps> = ({
  eventId,
  isHostOrCoordinator = true,
}) => {
  const [tasks, setTasks] = useState<EventTaskItem[]>([]);
  const [members, setMembers] = useState<EventMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [station, setStation] = useState('');
  const [category, setCategory] = useState<TaskCategory>('REGISTRATION');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [requiresScanning, setRequiresScanning] = useState(false);
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Status transition loader
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedTasks, fetchedMembers] = await Promise.all([
        eventsApi.getEventTasks(eventId),
        eventsApi.getMembers(eventId, 'ACTIVE'),
      ]);
      setTasks(fetchedTasks);
      setMembers(fetchedMembers);
    } catch (err: any) {
      setError(err?.message || 'Failed to load operational tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchData();
    }
  }, [eventId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !station.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload: CreateEventTaskPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        station: station.trim(),
        category,
        priority,
        requiresScanning,
        assignedMemberIds,
      };

      await eventsApi.createEventTask(eventId, payload);
      setIsCreateOpen(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStation('');
    setCategory('REGISTRATION');
    setPriority('MEDIUM');
    setRequiresScanning(false);
    setAssignedMemberIds([]);
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      setTransitioningId(taskId);
      await eventsApi.updateEventTaskStatus(eventId, taskId, newStatus);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update task status');
    } finally {
      setTransitioningId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this operational task?')) return;

    try {
      await eventsApi.deleteEventTask(eventId, taskId);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete task');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  return (
    <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 shadow-xl mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Volunteer Stations & Shift Tasks</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
              {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Organize gate admission stations, dispatch volunteer shifts, and monitor real-time completion.
          </p>
        </div>

        {isHostOrCoordinator && (
          <button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-sm rounded-xl transition duration-150 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Shift / Task
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-2">
        {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map((statusKey) => (
          <button
            key={statusKey}
            onClick={() => setStatusFilter(statusKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              statusFilter === statusKey
                ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            {statusKey === 'ALL'
              ? 'All Shifts'
              : statusKey === 'IN_PROGRESS'
              ? 'In Progress'
              : statusKey.charAt(0) + statusKey.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-zinc-900/60 rounded-xl animate-pulse border border-zinc-800/60"
            />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl">
          <ClipboardList className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <h4 className="text-sm font-medium text-zinc-300 mb-1">No Operational Tasks</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
            Create check-in stations, assign volunteers, and orchestrate on-site admissions.
          </p>
          {isHostOrCoordinator && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition"
            >
              Add First Task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isPending = task.status === 'PENDING';
            const isInProgress = task.status === 'IN_PROGRESS';
            const isCompleted = task.status === 'COMPLETED';

            return (
              <div
                key={task._id}
                className="p-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{task.title}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        PRIORITY_CLASSES[task.priority] || 'border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : isInProgress
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      {task.status}
                    </span>
                    {task.requiresScanning && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                        <QrCode className="w-3 h-3" /> Scanner Required
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-zinc-400 line-clamp-1">{task.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-zinc-300 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      {task.station}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-zinc-500" />
                      {CATEGORY_LABELS[task.category] || task.category}
                    </span>
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                      {task.assignedMemberIds?.length || 0} Staff Assigned
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                  {isPending && (
                    <button
                      onClick={() => handleStatusChange(task._id, 'IN_PROGRESS')}
                      disabled={transitioningId === task._id}
                      className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start
                    </button>
                  )}

                  {isInProgress && (
                    <button
                      onClick={() => handleStatusChange(task._id, 'COMPLETED')}
                      disabled={transitioningId === task._id}
                      className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Complete
                    </button>
                  )}

                  {isHostOrCoordinator && (
                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Create Operational Shift Task</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Assign field stations, volunteer roles, and ticket verification requirements for day-of-event coverage.
            </p>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Task / Duty Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Main Gate QR Ticket Scanning & Wristband Distribution"
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Station / Zone *
                  </label>
                  <input
                    type="text"
                    required
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                    placeholder="e.g. Gate 1, VIP Lounge"
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                >
                  {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((catKey) => (
                    <option key={catKey} value={catKey}>
                      {CATEGORY_LABELS[catKey]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Brief Instructions / Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Operational protocols, escalation contacts, or guidelines..."
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>

              {/* Assign Volunteers */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Assign Active Team Members ({assignedMemberIds.length} selected)
                </label>
                <div className="max-h-28 overflow-y-auto bg-zinc-900/60 border border-zinc-800 rounded-xl p-2 space-y-1.5">
                  {members.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 p-2 text-center">
                      No active members yet. Invite team members in Staff Management above.
                    </p>
                  ) : (
                    members.map((member) => (
                      <label
                        key={member._id}
                        className="flex items-center gap-2 p-1.5 hover:bg-zinc-800/60 rounded-lg cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={assignedMemberIds.includes(member._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedMemberIds([...assignedMemberIds, member._id]);
                            } else {
                              setAssignedMemberIds(
                                assignedMemberIds.filter((id) => id !== member._id)
                              );
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-zinc-700 text-emerald-500 bg-zinc-800"
                        />
                        <span className="text-zinc-200">{member.userEmail}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                          {member.role}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Requires Scanning Toggle */}
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="reqScan"
                  checked={requiresScanning}
                  onChange={(e) => setRequiresScanning(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-700 text-emerald-500 bg-zinc-800"
                />
                <label htmlFor="reqScan" className="cursor-pointer">
                  <span className="block text-xs font-medium text-white flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" /> Requires Ticket Scanning
                  </span>
                  <span className="block text-[11px] text-zinc-400">
                    Flag this duty as an active QR verification station for check-in gate logistics.
                  </span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
                >
                  {submitting ? 'Creating...' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventTaskManagerCard;
