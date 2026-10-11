import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trophy,
  Sliders,
  Play,
  Pause,
  CheckCheck,
} from 'lucide-react';
import {
  eventsApi,
  EventRubricItem,
  CreateRubricPayload,
  LeaderboardEntryItem,
  RubricCriterionItem,
} from '../../api/events';

interface EventEvaluationCardProps {
  eventId: string;
  isHostOrCoordinator?: boolean;
}

export const EventEvaluationCard: React.FC<EventEvaluationCardProps> = ({
  eventId,
  isHostOrCoordinator = true,
}) => {
  const [rubrics, setRubrics] = useState<EventRubricItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'RUBRICS' | 'LEADERBOARD'>('RUBRICS');
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Rubric Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [rubricTitle, setRubricTitle] = useState('');
  const [rubricTrack, setRubricTrack] = useState('All');
  const [criteria, setCriteria] = useState<RubricCriterionItem[]>([
    {
      key: 'innovation',
      label: 'Innovation & Originality',
      maxScore: 10,
      weight: 30,
      description: 'Novelty, creativity, and uniqueness of the solution',
    },
    {
      key: 'technical',
      label: 'Technical Execution',
      maxScore: 10,
      weight: 35,
      description: 'Architecture, complexity, code quality, and working demo',
    },
    {
      key: 'impact',
      label: 'Design & Usability',
      maxScore: 10,
      weight: 20,
      description: 'Intuitive user experience, aesthetic polish, and accessibility',
    },
    {
      key: 'presentation',
      label: 'Presentation & Pitch',
      maxScore: 10,
      weight: 15,
      description: 'Clarity, Q&A defense, and team cohesion during pitch',
    },
  ]);
  const [submittingRubric, setSubmittingRubric] = useState(false);

  const fetchRubrics = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getRubrics(eventId);
      setRubrics(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load evaluation rubrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    if (!eventId) return;
    try {
      setLeaderboardLoading(true);
      setError(null);
      const data = await eventsApi.getLeaderboard(eventId);
      setLeaderboard(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load live leaderboard');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    fetchRubrics();
  }, [eventId]);

  useEffect(() => {
    if (activeTab === 'LEADERBOARD') {
      fetchLeaderboard();
    }
  }, [activeTab, eventId]);

  const handleAddCriterion = () => {
    const newIdx = criteria.length + 1;
    setCriteria([
      ...criteria,
      {
        key: `criterion_${Date.now()}`,
        label: `Criterion ${newIdx}`,
        maxScore: 10,
        weight: 10,
        description: 'Evaluation criteria description',
      },
    ]);
  };

  const handleUpdateCriterion = (
    index: number,
    field: keyof RubricCriterionItem,
    value: string | number
  ) => {
    setCriteria((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveCriterion = (index: number) => {
    if (criteria.length <= 1) {
      alert('Rubric must contain at least 1 evaluation criterion');
      return;
    }
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubricTitle.trim() || criteria.length === 0) return;

    try {
      setSubmittingRubric(true);
      setError(null);

      const payload: CreateRubricPayload = {
        title: rubricTitle.trim(),
        track: rubricTrack.trim() || 'All',
        criteria: criteria.map((c) => ({
          key: c.key || c.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          label: c.label.trim(),
          maxScore: Number(c.maxScore) || 10,
          weight: Number(c.weight) || 10,
          description: c.description?.trim(),
        })),
      };

      const created = await eventsApi.createRubric(eventId, payload);
      setRubrics((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setRubricTitle('');
      setSuccessMsg('Rubric successfully created');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create rubric');
    } finally {
      setSubmittingRubric(false);
    }
  };

  const handleUpdateStatus = async (
    rubricId: string,
    scoringStatus: 'OPEN' | 'CLOSED' | 'FINALIZED'
  ) => {
    try {
      setError(null);
      const updated = await eventsApi.updateScoringStatus(eventId, rubricId, scoringStatus);
      setRubrics((prev) => prev.map((r) => (r._id === rubricId ? updated : r)));
      setSuccessMsg(`Rubric status updated to ${scoringStatus}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update scoring status');
    }
  };

  const handleDeleteRubric = async (rubricId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete rubric "${title}"? Existing evaluations tied to it may be affected.`)) return;

    try {
      setError(null);
      await eventsApi.deleteRubric(eventId, rubricId);
      setRubrics((prev) => prev.filter((r) => r._id !== rubricId));
      setSuccessMsg('Rubric deleted successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete rubric');
    }
  };

  const totalCriteriaWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  return (
    <div className="bg-white border border-surface-border p-6 rounded-2xl shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-zinc-900">
              Evaluation & Scoring Engine
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Phase 11
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Configurable weighted judging rubrics, evaluator access isolation, and live aggregate leaderboards
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('RUBRICS')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'RUBRICS'
                  ? 'bg-white text-zinc-900 shadow-sm font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>Rubrics ({rubrics.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('LEADERBOARD')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'LEADERBOARD'
                  ? 'bg-white text-zinc-900 shadow-sm font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Leaderboard</span>
            </button>
          </div>

          {isHostOrCoordinator && activeTab === 'RUBRICS' && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Rubric</span>
            </button>
          )}

          {activeTab === 'LEADERBOARD' && (
            <button
              onClick={fetchLeaderboard}
              disabled={leaderboardLoading}
              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors border border-zinc-200"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`w-4 h-4 ${leaderboardLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab 1: Rubrics Management */}
      {activeTab === 'RUBRICS' && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-28 bg-zinc-50 border border-zinc-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : rubrics.length === 0 ? (
            <div className="text-center py-10 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl">
              <Award className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
              <h3 className="text-xs font-bold text-zinc-700 mb-1">No Evaluation Rubrics Configured</h3>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto mb-4">
                Configure standardized weighted judging criteria so evaluators can review hackathon teams and cohorts.
              </p>
              {isHostOrCoordinator && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Rubric</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {rubrics.map((rubric) => {
                const isOpen = rubric.scoringStatus === 'OPEN';
                const isClosed = rubric.scoringStatus === 'CLOSED';
                const isFinalized = rubric.scoringStatus === 'FINALIZED';

                return (
                  <div
                    key={rubric._id}
                    className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3 transition-all hover:border-zinc-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-zinc-900">{rubric.title}</span>
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-200/80 text-zinc-700">
                          Track: {rubric.track || 'All'}
                        </span>

                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            isOpen
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isClosed
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          Status: {rubric.scoringStatus}
                        </span>
                      </div>

                      {/* Status Action Buttons */}
                      {isHostOrCoordinator && (
                        <div className="flex items-center gap-1.5">
                          {isOpen && (
                            <button
                              onClick={() => handleUpdateStatus(rubric._id, 'CLOSED')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold rounded-lg border border-amber-200 transition-colors"
                              title="Close Scoring - Stops new evaluations"
                            >
                              <Pause className="w-3 h-3" />
                              <span>Close Scoring</span>
                            </button>
                          )}
                          {isClosed && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(rubric._id, 'OPEN')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors"
                                title="Reopen Scoring"
                              >
                                <Play className="w-3 h-3" />
                                <span>Reopen</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(rubric._id, 'FINALIZED')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 transition-colors"
                                title="Finalize Scoring - Unlocks Leaderboard for Participants"
                              >
                                <CheckCheck className="w-3 h-3" />
                                <span>Finalize</span>
                              </button>
                            </>
                          )}
                          {isFinalized && (
                            <span className="text-[10px] font-semibold text-blue-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Leaderboard Public
                            </span>
                          )}

                          <button
                            onClick={() => handleDeleteRubric(rubric._id, rubric.title)}
                            className="p-1 text-zinc-400 hover:text-rose-600 transition-colors ml-1"
                            title="Delete Rubric"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Criteria List */}
                    <div className="pt-2 border-t border-zinc-200/80">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                        Weighted Evaluation Criteria ({rubric.criteria.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        {rubric.criteria.map((c) => (
                          <div
                            key={c.key}
                            className="p-2 bg-white border border-zinc-200 rounded-lg text-xs space-y-0.5"
                          >
                            <div className="flex items-center justify-between font-bold text-zinc-800">
                              <span className="truncate">{c.label}</span>
                              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded">
                                {c.weight}%
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Max Score: {c.maxScore} pts
                            </div>
                            {c.description && (
                              <div className="text-[9px] text-zinc-400 truncate" title={c.description}>
                                {c.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Leaderboard */}
      {activeTab === 'LEADERBOARD' && (
        <div className="space-y-4">
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs text-zinc-600">
            <span className="font-medium">
              Real-time aggregated scoring calculated from all submitted evaluator scorecards.
            </span>
            <span className="font-bold text-zinc-800">
              {leaderboard.length} Ranked {leaderboard.length === 1 ? 'Team' : 'Teams'}
            </span>
          </div>

          {leaderboardLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-zinc-50 border border-zinc-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-10 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl">
              <Trophy className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
              <h3 className="text-xs font-bold text-zinc-700 mb-1">No Leaderboard Data Yet</h3>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                Once evaluators begin scoring assigned teams against active rubrics, the live leaderboard will populate automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => {
                const rank = index + 1;

                return (
                  <div
                    key={entry.teamId}
                    className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 transition-all hover:border-zinc-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Rank Badge */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm ${
                            rank === 1
                              ? 'bg-amber-400 text-zinc-900 border border-amber-500'
                              : rank === 2
                              ? 'bg-zinc-300 text-zinc-800 border border-zinc-400'
                              : rank === 3
                              ? 'bg-amber-700 text-white border border-amber-800'
                              : 'bg-zinc-200 text-zinc-700 border border-zinc-300'
                          }`}
                        >
                          #{rank}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-900">{entry.teamName}</span>
                            {entry.track && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">
                                {entry.track}
                              </span>
                            )}
                            {entry.tableNumber && (
                              <span className="text-[9px] font-mono text-zinc-500">
                                Table {entry.tableNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            Evaluated by {entry.evaluationCount} {entry.evaluationCount === 1 ? 'judge' : 'judges'}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right">
                        <div className="text-base font-black text-emerald-700">
                          {entry.averageScore.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-zinc-400 font-semibold uppercase">
                          Avg Score
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Rubric Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-zinc-900">Configure Judging Rubric</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRubric} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Rubric Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Final Presentation Rubric"
                    value={rubricTitle}
                    onChange={(e) => setRubricTitle(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Track</label>
                  <input
                    type="text"
                    placeholder="e.g. AI / Web3 / All"
                    value={rubricTrack}
                    onChange={(e) => setRubricTrack(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Criteria Builder */}
              <div className="border border-zinc-200 rounded-xl p-3.5 bg-zinc-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-800">Criteria Builder</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        totalCriteriaWeight === 100
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Total Weight: {totalCriteriaWeight}% {totalCriteriaWeight !== 100 && '(Recommended: 100%)'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Criterion
                  </button>
                </div>

                <div className="space-y-2">
                  {criteria.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-zinc-200 rounded-xl space-y-2 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            required
                            placeholder="Criterion Label"
                            value={c.label}
                            onChange={(e) => handleUpdateCriterion(idx, 'label', e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-500">Max:</span>
                            <input
                              type="number"
                              required
                              min="1"
                              max="100"
                              value={c.maxScore}
                              onChange={(e) =>
                                handleUpdateCriterion(idx, 'maxScore', Number(e.target.value))
                              }
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-500">Weight:</span>
                            <input
                              type="number"
                              required
                              min="1"
                              max="100"
                              value={c.weight}
                              onChange={(e) =>
                                handleUpdateCriterion(idx, 'weight', Number(e.target.value))
                              }
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-[10px] text-zinc-500">%</span>
                          </div>
                        </div>
                        <div className="sm:col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveCriterion(idx)}
                            className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                            title="Remove Criterion"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Guideline description for evaluators..."
                          value={c.description || ''}
                          onChange={(e) =>
                            handleUpdateCriterion(idx, 'description', e.target.value)
                          }
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-[11px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRubric}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  {submittingRubric ? 'Saving Rubric...' : 'Save & Publish Rubric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
