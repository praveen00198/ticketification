import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  eventsApi,
  EventAssignmentItem,
  EventMemberItem,
  EventRubricItem,
  EventEvaluationItem,
  SubmitEvaluationPayload,
} from '../api/events';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  MessageSquare,
  Scale,
  Shield,
  Tag,
  AlertCircle,
  FileText,
  Lock,
  Star,
  Check,
} from 'lucide-react';

export const MentorEvaluatorWorkspacePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [member, setMember] = useState<EventMemberItem | null>(null);
  const [assignments, setAssignments] = useState<EventAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active filter tab
  const [activeTab, setActiveTab] = useState<'ALL' | 'MENTOR' | 'EVALUATOR'>('ALL');

  // Mentorship Log modal state
  const [selectedAssignment, setSelectedAssignment] = useState<EventAssignmentItem | null>(null);
  const [logNotes, setLogNotes] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState(false);

  // Phase 11: Evaluator Scoring modal state
  const [scoringAssignment, setScoringAssignment] = useState<EventAssignmentItem | null>(null);
  const [selectedRubric, setSelectedRubric] = useState<EventRubricItem | null>(null);
  const [scoreValues, setScoreValues] = useState<Record<string, number>>({});
  const [scoreFeedback, setScoreFeedback] = useState('');
  const [existingEvaluation, setExistingEvaluation] = useState<EventEvaluationItem | null>(null);
  const [loadingRubrics, setLoadingRubrics] = useState(false);
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false);
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [scoringSuccess, setScoringSuccess] = useState(false);

  // Map of targetId -> existing evaluation item for quick lookup
  const [evaluatedMap, setEvaluatedMap] = useState<Record<string, EventEvaluationItem>>({});

  const fetchMyAssignments = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getMyAssignments(eventId);
      setMember(data.member);
      setAssignments(data.assignments);
    } catch (err: any) {
      setError(err?.message || 'Failed to load assigned workspace targets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyAssignments();
  }, [eventId]);

  const handleOpenLogModal = (assignment: EventAssignmentItem) => {
    setSelectedAssignment(assignment);
    setLogNotes('');
    setLogError(null);
    setLogSuccess(false);
  };

  const handleRecordLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !selectedAssignment || !logNotes.trim()) return;

    try {
      setSubmittingLog(true);
      setLogError(null);

      const updated = await eventsApi.recordMentorshipLog(
        eventId,
        selectedAssignment._id,
        logNotes.trim()
      );

      setAssignments((prev) =>
        prev.map((a) => (a._id === updated._id ? updated : a))
      );

      setLogSuccess(true);
      setTimeout(() => {
        setSelectedAssignment(null);
        setLogSuccess(false);
      }, 1200);
    } catch (err: any) {
      setLogError(err?.message || 'Failed to record consultation note');
    } finally {
      setSubmittingLog(false);
    }
  };

  // Phase 11: Open Scoring Modal for an evaluator target
  const handleOpenScoringModal = async (assignment: EventAssignmentItem) => {
    if (!eventId) return;
    const targetId = assignment.targetId || assignment._id;
    setScoringAssignment(assignment);
    setScoringError(null);
    setScoringSuccess(false);
    setLoadingRubrics(true);

    try {
      // 1. Fetch available rubrics
      const rubrics = await eventsApi.getRubrics(eventId);
      const active = rubrics.find((r) => r.scoringStatus === 'OPEN') || rubrics[0] || null;
      setSelectedRubric(active);

      // 2. Check if this evaluator has already submitted an evaluation for this team
      if (targetId) {
        const existing = await eventsApi.getMyEvaluation(eventId, targetId);
        if (existing) {
          setExistingEvaluation(existing);
          setScoreFeedback(existing.generalFeedback || '');
          const initialScores: Record<string, number> = {};
          existing.scores.forEach((s) => {
            initialScores[s.criteriaKey] = s.score;
          });
          setScoreValues(initialScores);
          setEvaluatedMap((prev) => ({ ...prev, [targetId]: existing }));
        } else {
          setExistingEvaluation(null);
          setScoreFeedback('');
          const initialScores: Record<string, number> = {};
          if (active) {
            active.criteria.forEach((c) => {
              initialScores[c.key] = Math.round(c.maxScore / 2);
            });
          }
          setScoreValues(initialScores);
        }
      }
    } catch (err: any) {
      setScoringError(err?.message || 'Failed to load judging rubric');
    } finally {
      setLoadingRubrics(false);
    }
  };

  const handleScoreChange = (criterionKey: string, val: number) => {
    setScoreValues((prev) => ({
      ...prev,
      [criterionKey]: val,
    }));
  };

  // Calculate live preview of total weighted score
  const computedTotalWeightedScore = () => {
    if (!selectedRubric) return 0;
    let total = 0;
    selectedRubric.criteria.forEach((c) => {
      const raw = scoreValues[c.key] || 0;
      total += (raw / c.maxScore) * c.weight;
    });
    return Number(total.toFixed(2));
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !scoringAssignment || !selectedRubric) return;
    const targetId = scoringAssignment.targetId || scoringAssignment._id;

    try {
      setSubmittingEvaluation(true);
      setScoringError(null);

      const payload: SubmitEvaluationPayload = {
        teamId: targetId,
        rubricId: selectedRubric._id,
        scores: selectedRubric.criteria.map((c) => ({
          criteriaKey: c.key,
          score: Number(scoreValues[c.key]) || 0,
        })),
        generalFeedback: scoreFeedback.trim() || undefined,
      };

      const submitted = await eventsApi.submitEvaluation(eventId, payload);
      setEvaluatedMap((prev) => ({ ...prev, [targetId]: submitted }));
      setScoringSuccess(true);

      setTimeout(() => {
        setScoringAssignment(null);
        setScoringSuccess(false);
      }, 1500);
    } catch (err: any) {
      setScoringError(err?.message || 'Failed to submit scorecard');
    } finally {
      setSubmittingEvaluation(false);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (activeTab === 'ALL') return true;
    return a.role === activeTab;
  });

  const mentorAssignmentsCount = assignments.filter((a) => a.role === 'MENTOR').length;
  const evaluatorAssignmentsCount = assignments.filter((a) => a.role === 'EVALUATOR').length;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/events/${eventId}`)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event Console
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono rounded-full">
              <Lock className="w-3.5 h-3.5" /> Blind Review Enforced
            </span>
          </div>
        </div>

        {/* Header & Identity Card */}
        <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-white" />
                <h1 className="text-lg font-bold text-white">Mentor & Evaluator Workspace</h1>
              </div>
              <p className="text-xs text-zinc-400">
                Authorized Session for{' '}
                <span className="font-semibold text-white">{member?.userEmail}</span> (
                <span className="text-zinc-300 font-medium">{member?.role}</span>)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 flex items-center gap-2">
                <Scale className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {assignments.length} Assigned {assignments.length === 1 ? 'Target' : 'Targets'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Filter */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'ALL'
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Targets ({assignments.length})
            </button>
            <button
              onClick={() => setActiveTab('MENTOR')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'MENTOR'
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Mentorship ({mentorAssignmentsCount})
            </button>
            <button
              onClick={() => setActiveTab('EVALUATOR')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'EVALUATOR'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              Evaluation ({evaluatorAssignmentsCount})
            </button>
          </div>

          <span className="text-[11px] text-zinc-500 hidden sm:inline-block">
            Strict isolation: Competing scores and unassigned tracks are masked.
          </span>
        </div>

        {/* Assignments List */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-[#121215] border border-zinc-800 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="py-14 text-center bg-[#121215] border border-dashed border-zinc-800 rounded-2xl">
              <Award className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-zinc-300 mb-1">No Targets Assigned</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Event hosts and coordinators will assign your tracks or evaluation cohorts prior to the review session.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map((assignment) => {
                const isMentor = assignment.role === 'MENTOR';
                const logs = assignment.mentorshipLogs || [];
                const targetKey = assignment.targetId || assignment._id;
                const evaluated = evaluatedMap[targetKey];

                return (
                  <div
                    key={assignment._id}
                    className="bg-[#121215] border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white">
                            {assignment.targetName}
                          </h3>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              isMentor
                                ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {assignment.role}
                          </span>
                          <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700">
                            {assignment.assignedTargetType}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1.5 flex-wrap">
                          {assignment.track && (
                            <span className="flex items-center gap-1 text-zinc-300">
                              <Tag className="w-3.5 h-3.5 text-zinc-400" /> Track: {assignment.track}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Clock className="w-3.5 h-3.5" /> Assigned:{' '}
                            {new Date(assignment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {isMentor ? (
                          <button
                            onClick={() => handleOpenLogModal(assignment)}
                            className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Log Consultation
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenScoringModal(assignment)}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                          >
                            <Star className="w-3.5 h-3.5" />
                            {evaluated ? 'Edit Scorecard' : 'Score Target'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Briefing notes from host */}
                    {assignment.notes && (
                      <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs text-zinc-300">
                        <span className="font-semibold text-zinc-400 block mb-0.5">
                          Briefing & Focus Areas:
                        </span>
                        {assignment.notes}
                      </div>
                    )}

                    {/* Evaluator Blind Guidelines Box */}
                    {!isMentor && (
                      <div className="p-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-xs text-zinc-400 space-y-1">
                        <span className="font-semibold text-amber-400 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Evaluation Protocol:
                        </span>
                        <p>
                          Evaluate this target solely against standardized scoring criteria. Competing judge evaluations remain strictly sealed to preserve scoring objectivity.
                        </p>
                      </div>
                    )}

                    {/* Evaluated Scorecard preview banner if evaluated */}
                    {!isMentor && evaluated && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-400">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Check className="w-4 h-4" /> Scorecard Submitted
                        </span>
                        <span className="font-mono font-bold text-emerald-300">
                          Total Score: {evaluated.weightedTotal.toFixed(2)} pts
                        </span>
                      </div>
                    )}

                    {/* Mentorship Logs section */}
                    {isMentor && (
                      <div className="border-t border-zinc-800/80 pt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-zinc-400" />
                            Consultation History ({logs.length})
                          </span>
                        </div>

                        {logs.length === 0 ? (
                          <p className="text-[11px] text-zinc-500 italic">
                            No consultation sessions recorded yet. Use &ldquo;Log Consultation&rdquo; to add feedback.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {logs.map((log, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 bg-zinc-900/40 border border-zinc-800/60 rounded-xl text-xs text-zinc-300 space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                  <span className="font-semibold text-zinc-200">
                                    {log.authorEmail || 'Mentor'}
                                  </span>
                                  <span className="flex items-center gap-1 text-zinc-500">
                                    <Clock className="w-3 h-3" />
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-zinc-300 whitespace-pre-wrap">{log.note}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mentorship Consultation Modal */}
        {selectedAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-[#121215] border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-zinc-300" />
                  <h3 className="text-sm font-bold text-white">Record Mentorship Consultation</h3>
                </div>
                <button
                  onClick={() => setSelectedAssignment(null)}
                  className="text-zinc-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300">
                Target: <span className="font-semibold text-white">{selectedAssignment.targetName}</span>
                {selectedAssignment.track && (
                  <span className="ml-2 text-zinc-400">({selectedAssignment.track})</span>
                )}
              </div>

              {logError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  {logError}
                </div>
              )}

              {logSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Consultation recorded successfully!
                </div>
              )}

              <form onSubmit={handleRecordLog} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Session Feedback & Action Items
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Summarize technical guidance, architectural recommendations, and next milestones..."
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignment(null)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLog || logSuccess}
                    className="px-4 py-1.5 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                  >
                    {submittingLog ? 'Saving...' : 'Save Feedback Log'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Phase 11: Evaluator Scoring Modal */}
        {scoringAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-[#121215] border border-zinc-800 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Score Target: {scoringAssignment.targetName}</h3>
                </div>
                <button
                  onClick={() => setScoringAssignment(null)}
                  className="text-zinc-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {scoringError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{scoringError}</span>
                </div>
              )}

              {scoringSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Scorecard successfully submitted and recorded!
                </div>
              )}

              {loadingRubrics ? (
                <div className="py-8 text-center text-xs text-zinc-500 animate-pulse">
                  Loading active judging rubric...
                </div>
              ) : !selectedRubric ? (
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 text-center">
                  No active judging rubric available for this event. Please contact the event organizer.
                </div>
              ) : (
                <form onSubmit={handleSubmitEvaluation} className="space-y-4">
                  {/* Rubric Details & Status Header */}
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{selectedRubric.title}</span>
                      <span className="text-[10px] text-zinc-400 block">
                        Track: {selectedRubric.track || 'All'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          selectedRubric.scoringStatus === 'OPEN'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {selectedRubric.scoringStatus}
                      </span>
                      <div className="text-[11px] font-mono text-zinc-300 font-bold mt-1">
                        Total: {computedTotalWeightedScore()} pts
                      </div>
                    </div>
                  </div>

                  {/* Criteria Sliders / Inputs */}
                  <div className="space-y-3">
                    {selectedRubric.criteria.map((criterion) => {
                      const currentVal = scoreValues[criterion.key] ?? 0;
                      return (
                        <div
                          key={criterion.key}
                          className="p-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-white">{criterion.label}</span>
                              <span className="text-[10px] text-zinc-500 ml-2">
                                Weight: {criterion.weight}%
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-amber-400">
                              {currentVal} / {criterion.maxScore} pts
                            </span>
                          </div>

                          {criterion.description && (
                            <p className="text-[11px] text-zinc-400">{criterion.description}</p>
                          )}

                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max={criterion.maxScore}
                              step="1"
                              value={currentVal}
                              onChange={(e) =>
                                handleScoreChange(criterion.key, Number(e.target.value))
                              }
                              className="w-full accent-amber-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max={criterion.maxScore}
                              value={currentVal}
                              onChange={(e) =>
                                handleScoreChange(criterion.key, Number(e.target.value))
                              }
                              className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Qualitative Feedback */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Qualitative Feedback & Defense Notes (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Constructive feedback, notable strengths, and areas for improvement..."
                      value={scoreFeedback}
                      onChange={(e) => setScoreFeedback(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setScoringAssignment(null)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        submittingEvaluation ||
                        scoringSuccess ||
                        selectedRubric.scoringStatus !== 'OPEN'
                      }
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                    >
                      {submittingEvaluation
                        ? 'Submitting Score...'
                        : existingEvaluation
                        ? 'Update Scorecard'
                        : 'Submit Scorecard'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorEvaluatorWorkspacePage;
