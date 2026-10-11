import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  eventsApi,
  EventTaskItem,
  EventMemberItem,
  TaskStatus,
} from '../api/events';
import {
  QrCode,
  MapPin,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import { EventCheckinScannerCard } from '../components/events/EventCheckinScannerCard';

export const VolunteerConsolePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [member, setMember] = useState<EventMemberItem | null>(null);
  const [tasks, setTasks] = useState<EventTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchMyDuties = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getMyTasks(eventId);
      setMember(data.member);
      setTasks(data.tasks);
    } catch (err: any) {
      setError(err?.message || 'Failed to load assigned duties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDuties();
  }, [eventId]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (!eventId) return;
    try {
      setUpdatingId(taskId);
      await eventsApi.updateEventTaskStatus(eventId, taskId, newStatus);
      await fetchMyDuties();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const canScan = member?.permissions?.includes('SCAN_CREDENTIALS');

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/events/${eventId}`)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event
          </button>

          {canScan && (
            <button
              onClick={() => navigate('/scan')}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5" />
              Launch Scanner
            </button>
          )}
        </div>

        {/* Member Status Card */}
        <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h1 className="text-lg font-bold text-white">Staff Operational Console</h1>
              </div>
              <p className="text-xs text-zinc-400">
                Logged in as <span className="font-semibold text-white">{member?.userEmail}</span> ({member?.role})
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canScan ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono rounded-full">
                  <QrCode className="w-3.5 h-3.5" /> Scanner Active
                </span>
              ) : (
                <span className="px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs rounded-full">
                  Scanner Not Assigned
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Phase 14: Gate Scanner Station (Visible when volunteer has scan permissions) */}
        {canScan && eventId && (
          <EventCheckinScannerCard eventId={eventId} isStaffOrHost={true} />
        )}

        {/* Assigned Duties */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Your Assigned Shifts & Stations</h2>
            <span className="text-xs text-zinc-500">
              {tasks.length} {tasks.length === 1 ? 'Station' : 'Stations'} Assigned
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 bg-[#121215] border border-zinc-800 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center bg-[#121215] border border-dashed border-zinc-800 rounded-2xl">
              <MapPin className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-zinc-300 mb-1">No Shifts Assigned Yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Your coordinator will assign your station and duties shortly before event check-in opens.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isPending = task.status === 'PENDING';
                const isInProgress = task.status === 'IN_PROGRESS';
                const isCompleted = task.status === 'COMPLETED';

                return (
                  <div
                    key={task._id}
                    className="bg-[#121215] border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-white">{task.title}</h3>
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
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <MapPin className="w-3.5 h-3.5" /> Station: {task.station}
                          </span>
                          <span>Category: {task.category}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {isPending && (
                          <button
                            onClick={() => handleStatusChange(task._id, 'IN_PROGRESS')}
                            disabled={updatingId === task._id}
                            className="px-3.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Start Shift
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            onClick={() => handleStatusChange(task._id, 'COMPLETED')}
                            disabled={updatingId === task._id}
                            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Finish Shift
                          </button>
                        )}

                        {isCompleted && (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Duty Complete
                          </span>
                        )}
                      </div>
                    </div>

                    {task.description && (
                      <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs text-zinc-300">
                        <span className="font-semibold text-zinc-400 block mb-0.5">Instructions:</span>
                        {task.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VolunteerConsolePage;
