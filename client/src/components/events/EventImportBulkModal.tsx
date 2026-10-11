import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Play,
  Ban,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  ChevronDown,
  DownloadCloud,
  Package,
  FileText,
  ExternalLink,
  HardDrive,
  Trash2,
  Database,
} from 'lucide-react';
import {
  eventsApi,
  EventJobItem,
  ImportPreviewResult,
  ExportJobFormat,
  EventStorageMetrics,
} from '../../api/events';

interface EventImportBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onJobCompleted?: () => void;
}

export const EventImportBulkModal: React.FC<EventImportBulkModalProps> = ({
  isOpen,
  onClose,
  eventId,
  onJobCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'EXPORT' | 'STORAGE' | 'QUEUE'>('IMPORT');

  // File & Preview State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Import Options
  const [renderAfterImport, setRenderAfterImport] = useState(true);
  const [credentialType, setCredentialType] = useState('ATTENDEE_PASS');
  const [enqueuingJob, setEnqueuingJob] = useState(false);

  // Export State
  const [exportStatusFilter, setExportStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CHECKED_IN'>('ALL');
  const [enqueuingExport, setEnqueuingExport] = useState(false);

  // Storage Quota State (Phase 17)
  const [storageMetrics, setStorageMetrics] = useState<EventStorageMetrics | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Queue & Polling State
  const [jobs, setJobs] = useState<EventJobItem[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<EventJobItem | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [expandedErrorLog, setExpandedErrorLog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch jobs list
  const fetchJobs = async () => {
    if (!eventId) return;
    try {
      setLoadingJobs(true);
      const list = await eventsApi.getEventJobs(eventId, { limit: 10 });
      setJobs(list);

      // If there's an active job in progress or queued, track it
      const running = list.find((j) => j.status === 'PROCESSING' || j.status === 'QUEUED');
      if (running && !activeJobId) {
        setActiveJobId(running._id);
        setActiveJob(running);
      }
    } catch (err: any) {
      console.error('Failed to fetch event jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Fetch storage metrics (Phase 17)
  const fetchStorage = async () => {
    if (!eventId) return;
    try {
      setLoadingStorage(true);
      const res = await eventsApi.getStorageMetrics(eventId);
      setStorageMetrics(res);
    } catch (err: any) {
      console.error('Failed to load storage metrics:', err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleCleanupStorage = async () => {
    if (!eventId) return;
    try {
      setCleaningStorage(true);
      setCleanupMessage(null);
      const res = await eventsApi.cleanupStaleStorage(eventId, 24);
      setCleanupMessage(`Reclaimed ${res.reclaimedFormatted} across ${res.deletedCount} stale export files.`);
      await fetchStorage();
    } catch (err: any) {
      console.error('Failed to purge stale storage:', err);
    } finally {
      setCleaningStorage(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchJobs();
      if (activeTab === 'STORAGE') {
        fetchStorage();
      }
    }
  }, [isOpen, eventId, activeTab]);

  // Real-time polling for active job
  useEffect(() => {
    let interval: any = null;
    if (isOpen && activeJobId) {
      const poll = async () => {
        try {
          const status = await eventsApi.getEventJobStatus(eventId, activeJobId);
          setActiveJob(status);
          if (status.status === 'COMPLETED' || status.status === 'FAILED' || status.status === 'CANCELLED') {
            fetchJobs();
            if (status.status === 'COMPLETED' && onJobCompleted) {
              onJobCompleted();
            }
          }
        } catch (err) {
          console.error('Error polling job status:', err);
        }
      };

      poll();
      interval = setInterval(poll, 1500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, activeJobId, eventId]);

  // Handle file selection and synchronous preview
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setPreviewResult(null);
    setParsing(true);

    try {
      const preview = await eventsApi.previewImportSpreadsheet(eventId, file);
      setPreviewResult(preview);
    } catch (err: any) {
      setParseError(err?.response?.data?.message || err?.message || 'Failed to parse spreadsheet buffer');
    } finally {
      setParsing(false);
    }
  };

  // Enqueue import job
  const handleStartImport = async () => {
    if (!previewResult || previewResult.allValidRecords.length === 0) return;

    try {
      setEnqueuingJob(true);
      setParseError(null);

      const res = await eventsApi.createImportJob(eventId, {
        records: previewResult.allValidRecords,
        renderAfterImport,
        credentialType,
      });

      setActiveJobId(res.jobId || res.job?._id);
      setActiveJob(res.job);
      setActiveTab('QUEUE');
      fetchJobs();
    } catch (err: any) {
      setParseError(err?.response?.data?.message || err?.message || 'Failed to enqueue import job');
    } finally {
      setEnqueuingJob(false);
    }
  };

  // Enqueue export job
  const handleStartExport = async (format: ExportJobFormat) => {
    try {
      setEnqueuingExport(true);
      const filters: any = {};
      if (exportStatusFilter !== 'ALL') {
        filters.status = exportStatusFilter;
      }

      const res = await eventsApi.createExportJob(eventId, {
        exportFormat: format,
        filters,
      });

      setActiveJobId(res.jobId || res.job?._id);
      setActiveJob(res.job);
      setActiveTab('QUEUE');
      fetchJobs();
    } catch (err: any) {
      console.error('Failed to enqueue export job:', err);
    } finally {
      setEnqueuingExport(false);
    }
  };

  // Trigger Bulk Render for existing credentials
  const handleStartBulkRender = async () => {
    try {
      setEnqueuingJob(true);
      const res = await eventsApi.createBulkRenderJob(eventId, {});
      setActiveJobId(res.jobId || res.job?._id);
      setActiveJob(res.job);
      setActiveTab('QUEUE');
      fetchJobs();
    } catch (err: any) {
      setParseError(err?.response?.data?.message || err?.message || 'Failed to enqueue bulk render job');
    } finally {
      setEnqueuingJob(false);
    }
  };

  // Cancel Job
  const handleCancelJob = async (jobId: string) => {
    try {
      setCancellingJobId(jobId);
      const updated = await eventsApi.cancelEventJob(eventId, jobId);
      if (activeJob?._id === jobId) {
        setActiveJob(updated);
      }
      fetchJobs();
    } catch (err: any) {
      console.error('Failed to cancel job:', err);
    } finally {
      setCancellingJobId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">
                  Bulk Operations Engine
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Phase 15, 16 & 17
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                High-capacity roster import, streaming ZIP packaging & storage quota governance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-zinc-800 bg-zinc-950/50 px-6 gap-2">
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'IMPORT'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload & Import Roster</span>
          </button>
          <button
            onClick={() => setActiveTab('EXPORT')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'EXPORT'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Export Archive & Reports</span>
          </button>
          <button
            onClick={() => setActiveTab('STORAGE')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'STORAGE'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Storage & Quota</span>
          </button>
          <button
            onClick={() => setActiveTab('QUEUE')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'QUEUE'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Job Queue & Progress</span>
            {jobs.some((j) => j.status === 'PROCESSING' || j.status === 'QUEUED') && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'IMPORT' && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 rounded-2xl bg-zinc-800 text-emerald-400 border border-zinc-700">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">
                      {selectedFile ? selectedFile.name : 'Click or drag spreadsheet file here'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Supports Excel (.xlsx, .xls) and CSV (.csv) up to 15MB
                    </p>
                  </div>
                  {parsing && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 mt-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing & auto-detecting column mappings...</span>
                    </div>
                  )}
                </div>
              </div>

              {parseError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Preview Analysis Card */}
              {previewResult && (
                <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Spreadsheet Ingestion Preview</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {previewResult.validCount} Valid Records
                      </span>
                      {previewResult.invalidCount > 0 && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {previewResult.invalidCount} Rejected Rows
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Header Mapping Badges */}
                  <div>
                    <p className="text-[11px] font-medium text-zinc-400 mb-2">
                      Detected Column Synonyms:
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {Object.entries(previewResult.detectedHeaders).map(([field, rawHeader]) => (
                        <div
                          key={field}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/80 flex items-center gap-1.5"
                        >
                          <span className="font-bold text-emerald-400 uppercase text-[10px]">
                            {field}:
                          </span>
                          <span className="text-zinc-300">{rawHeader}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sample Records Table */}
                  <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="py-2 px-3 font-semibold">Row</th>
                          <th className="py-2 px-3 font-semibold">Name</th>
                          <th className="py-2 px-3 font-semibold">Email</th>
                          <th className="py-2 px-3 font-semibold">Phone</th>
                          <th className="py-2 px-3 font-semibold">Category</th>
                          <th className="py-2 px-3 font-semibold">Organization</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        {previewResult.sampleRows.map((r) => (
                          <tr key={r.rowNumber} className="hover:bg-zinc-800/30">
                            <td className="py-2 px-3 text-zinc-500 font-mono">#{r.rowNumber}</td>
                            <td className="py-2 px-3 font-semibold text-zinc-100">{r.name}</td>
                            <td className="py-2 px-3 text-zinc-400">{r.email || '—'}</td>
                            <td className="py-2 px-3 text-zinc-400">{r.phone || '—'}</td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-300">
                                {r.category}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-zinc-400">{r.organization || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Validation Errors Preview */}
                  {previewResult.validationErrors.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Validation Warnings ({previewResult.validationErrors.length} rows excluded)</span>
                      </div>
                      <div className="space-y-0.5 text-[11px] text-amber-300/90 font-mono">
                        {previewResult.validationErrors.slice(0, 3).map((v, i) => (
                          <div key={i}>
                            Row #{v.row}: {v.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Job Options & Trigger */}
                  <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={renderAfterImport}
                          onChange={(e) => setRenderAfterImport(e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-800"
                        />
                        <span>Render PNG assets after import (Async queue)</span>
                      </label>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-400">Pass Type:</span>
                        <select
                          value={credentialType}
                          onChange={(e) => setCredentialType(e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="ATTENDEE_PASS">Attendee Pass</option>
                          <option value="VIP_PASS">VIP Pass</option>
                          <option value="HACKER_PASS">Hacker Pass</option>
                          <option value="SPEAKER_BADGE">Speaker Badge</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleStartImport}
                      disabled={enqueuingJob || previewResult.validCount === 0}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold rounded-xl transition-all flex items-center gap-2 justify-center shadow-lg shadow-emerald-500/10"
                    >
                      {enqueuingJob ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Enqueuing Job (202 Accepted)...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Enqueue Import Job ({previewResult.validCount} records)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'EXPORT' && (
            <div className="space-y-6">
              {/* Filter Bar */}
              <div className="flex items-center justify-between p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                <span className="text-xs font-semibold text-zinc-300">
                  Credential Scope Filter:
                </span>
                <select
                  value={exportStatusFilter}
                  onChange={(e) => setExportStatusFilter(e.target.value as any)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Credentials (Active & Checked-in)</option>
                  <option value="ACTIVE">Active Unused Passes</option>
                  <option value="CHECKED_IN">Checked-in Passes Only</option>
                </select>
              </div>

              {/* Export Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Visual Passes ZIP */}
                <div className="bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all">
                  <div className="space-y-3">
                    <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">
                        Visual Pass Archive (.zip)
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Bundles all rendered PNG passes into a compressed archive named with sequence IDs for printing or badge production.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartExport('ZIP_PASSES')}
                    disabled={enqueuingExport}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    <span>Generate Passes ZIP</span>
                  </button>
                </div>

                {/* 2. Attendee Roster XLSX */}
                <div className="bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all">
                  <div className="space-y-3">
                    <div className="p-2.5 w-fit rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">
                        Attendee Roster (.xlsx)
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Comprehensive Excel workbook with attendee details, ticket tiers, check-in timestamps, gates, and tokens.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartExport('ROSTER_XLSX')}
                    disabled={enqueuingExport}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-blue-500 hover:text-zinc-950 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Generate Excel Roster</span>
                  </button>
                </div>

                {/* 3. Audit Telemetry CSV */}
                <div className="bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all">
                  <div className="space-y-3">
                    <div className="p-2.5 w-fit rounded-xl bg-purple-500/10 border border-purple-500/20 text-zinc-300">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">
                        Audit Telemetry (.csv)
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Lightweight comma-separated file containing raw check-in counts, scan timestamps, and verification tokens.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartExport('ROSTER_CSV')}
                    disabled={enqueuingExport}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Generate CSV Telemetry</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'STORAGE' && (
            <div className="space-y-6">
              {/* Storage Quota & Capacity Overview Card */}
              <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">
                        Event Storage Quota & Telemetry
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Governed storage boundary adhering to Render 512MB RAM and Supabase Storage quotas.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {storageMetrics?.isQuotaExceeded ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                        Quota Exceeded
                      </span>
                    ) : storageMetrics?.isNearQuota ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Near Quota (80%+)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Healthy Quota
                      </span>
                    )}

                    <button
                      onClick={fetchStorage}
                      disabled={loadingStorage}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
                      title="Refresh Storage Metrics"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingStorage ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Quota Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-300">
                      Total Allocated: {storageMetrics?.totalBytesFormatted || '0 B'} of {storageMetrics?.quotaBytesFormatted || '1.00 GB'}
                    </span>
                    <span className="text-zinc-400">
                      {storageMetrics?.usedPercentage || 0}% Used
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-700/50">
                    <div
                      className={`h-full transition-all duration-500 ${
                        storageMetrics?.isQuotaExceeded
                          ? 'bg-red-500'
                          : storageMetrics?.isNearQuota
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, storageMetrics?.usedPercentage || 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 3 Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span className="font-semibold text-zinc-300">Pass & Ticket Images</span>
                    <Package className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-zinc-100">
                    {storageMetrics?.breakdown.credentials.formatted || '0 B'}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {storageMetrics?.breakdown.credentials.count || 0} rendered PNG passes
                  </div>
                </div>

                <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span className="font-semibold text-zinc-300">Export ZIP & Reports</span>
                    <DownloadCloud className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-xl font-bold text-zinc-100">
                    {storageMetrics?.breakdown.exports.formatted || '0 B'}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {storageMetrics?.breakdown.exports.count || 0} downloadable archives
                  </div>
                </div>

                <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span className="font-semibold text-zinc-300">Custom Templates</span>
                    <Database className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-xl font-bold text-zinc-100">
                    {storageMetrics?.breakdown.templates.formatted || '0 B'}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {storageMetrics?.breakdown.templates.count || 0} background assets
                  </div>
                </div>
              </div>

              {/* Stale Cleanup Action Card */}
              <div className="p-5 bg-zinc-950/80 border border-zinc-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-amber-400" />
                    <span>Purge Stale Export Archives</span>
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-xl">
                    Temporary ZIP archives and CSV reports older than 24 hours can be permanently deleted to immediately reclaim event storage space.
                  </p>
                  {cleanupMessage && (
                    <p className="text-xs text-emerald-400 font-semibold pt-1">
                      ✓ {cleanupMessage}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleCleanupStorage}
                  disabled={cleaningStorage}
                  className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500 hover:text-zinc-950 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <Trash2 className={`w-4 h-4 ${cleaningStorage ? 'animate-spin' : ''}`} />
                  <span>{cleaningStorage ? 'Purging Stale Exports...' : 'Clean Up Stale Exports (> 24h)'}</span>
                </button>
              </div>

              {/* Recent Exports Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Recent Export Archive Binaries
                </h4>
                {storageMetrics?.recentExports && storageMetrics.recentExports.length > 0 ? (
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40 divide-y divide-zinc-800">
                    {storageMetrics.recentExports.map((exp, idx) => (
                      <div key={idx} className="p-3 px-4 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 text-zinc-400" />
                          <div>
                            <p className="font-semibold text-zinc-200">{exp.name}</p>
                            <p className="text-[10px] text-zinc-500">
                              Created {new Date(exp.createdAt).toLocaleString()} • {exp.sizeFormatted}
                            </p>
                          </div>
                        </div>

                        <div>
                          {exp.isStale ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Stale (&gt; 24h)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Fresh (&lt; 24h)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 border border-zinc-800 rounded-xl text-center text-xs text-zinc-500 bg-zinc-950/30">
                    No export archives currently stored for this event.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'QUEUE' && (
            <div className="space-y-6">
              {/* Active / Selected Job Status Card */}
              {activeJob ? (
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl ${
                          activeJob.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : activeJob.status === 'PROCESSING'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : activeJob.status === 'FAILED'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {activeJob.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : activeJob.status === 'PROCESSING' ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : activeJob.status === 'FAILED' ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-100">
                            {activeJob.jobType === 'IMPORT_CREDENTIALS'
                              ? 'Attendee Credential Roster Import'
                              : activeJob.jobType === 'EXPORT_CREDENTIALS'
                              ? `Bulk Export (${activeJob.payload?.exportFormat || 'ZIP'})`
                              : 'Bulk Sharp Asset Rasterization'}
                          </h4>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              activeJob.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : activeJob.status === 'PROCESSING'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : activeJob.status === 'FAILED'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {activeJob.status}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">
                          Job ID: {activeJob._id}
                        </p>
                      </div>
                    </div>

                    {(activeJob.status === 'PROCESSING' || activeJob.status === 'QUEUED') && (
                      <button
                        onClick={() => handleCancelJob(activeJob._id)}
                        disabled={cancellingJobId === activeJob._id}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 transition-all flex items-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel Job</span>
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400 font-medium">Progress</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {activeJob.progress.percentage}% ({activeJob.progress.processed} /{' '}
                        {activeJob.progress.total})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                        style={{ width: `${activeJob.progress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Ready Download Banner */}
                  {activeJob.result?.downloadUrl && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold">
                          <DownloadCloud className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-400">
                            Export File Ready for Direct Download
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {activeJob.result.fileSizeBytes
                              ? `${(activeJob.result.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB • `
                              : ''}
                            Direct presigned Supabase Storage link (valid 24h)
                          </p>
                        </div>
                      </div>
                      <a
                        href={activeJob.result.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0"
                      >
                        <span>Download Export</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Result Summary Metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                      <p className="text-[11px] text-zinc-400">Total Items</p>
                      <p className="text-base font-bold text-zinc-200 mt-0.5">
                        {activeJob.progress.total}
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                      <p className="text-[11px] text-emerald-400 font-semibold">Succeeded</p>
                      <p className="text-base font-bold text-emerald-400 mt-0.5">
                        {activeJob.progress.succeeded}
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                      <p className="text-[11px] text-amber-400 font-semibold">Failed / Warnings</p>
                      <p className="text-base font-bold text-amber-400 mt-0.5">
                        {activeJob.progress.failed}
                      </p>
                    </div>
                  </div>

                  {/* Error Log Accordion */}
                  {activeJob.result?.errorLog && activeJob.result.errorLog.length > 0 && (
                    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900">
                      <button
                        onClick={() => setExpandedErrorLog(!expandedErrorLog)}
                        className="w-full px-4 py-2.5 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-300 font-semibold"
                      >
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>View Error Log ({activeJob.result.errorLog.length} entries)</span>
                        </span>
                        {expandedErrorLog ? (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>

                      {expandedErrorLog && (
                        <div className="p-3 max-h-48 overflow-y-auto space-y-1.5 text-[11px] font-mono text-zinc-400">
                          {activeJob.result.errorLog.map((err, idx) => (
                            <div
                              key={idx}
                              className="p-1.5 bg-zinc-950 rounded border border-zinc-800 flex items-start gap-2"
                            >
                              <span className="text-amber-400 font-bold shrink-0">
                                {err.row ? `Row #${err.row}:` : `Item ${err.identifier}:`}
                              </span>
                              <span className="text-zinc-300">{err.error}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No active job selected. Select a job below to view details.
                </div>
              )}

              {/* Jobs History List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Recent Job Operations
                  </h4>
                  <button
                    onClick={handleStartBulkRender}
                    disabled={enqueuingJob}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Trigger Bulk Render for All</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div
                      key={job._id}
                      onClick={() => setActiveJob(job)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                        activeJob?._id === job._id
                          ? 'border-emerald-500/40 bg-zinc-900'
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-400'
                              : job.status === 'PROCESSING'
                              ? 'bg-blue-400 animate-pulse'
                              : job.status === 'FAILED'
                              ? 'bg-red-400'
                              : 'bg-zinc-500'
                          }`}
                        />
                        <div>
                          <p className="font-bold text-zinc-200">
                            {job.jobType === 'IMPORT_CREDENTIALS'
                              ? 'Import Roster'
                              : job.jobType === 'EXPORT_CREDENTIALS'
                              ? `Export ${job.payload?.exportFormat || 'Archive'}`
                              : 'Bulk Sharp Render'}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono">
                            {new Date(job.createdAt).toLocaleString()} • {job.progress.percentage}%
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : job.status === 'PROCESSING'
                              ? 'bg-blue-500/10 text-blue-400'
                              : job.status === 'FAILED'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {job.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                      </div>
                    </div>
                  ))}

                  {jobs.length === 0 && !loadingJobs && (
                    <div className="text-center py-6 text-zinc-500 text-xs">
                      No background jobs executed yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
