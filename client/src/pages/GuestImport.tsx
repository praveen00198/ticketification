import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import {
  guestsApi,
  HeaderAnalysisData,
  ValidationSummaryData,
  ImportConfirmationResult,
} from '../api/guests';
import { eventsApi } from '../api/events';
import { TicketType } from '../types';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Settings2,
  Sparkles,
  Download,
  Users,
  Tag,
  RefreshCw,
  Check,
  Calendar,
} from 'lucide-react';

type WizardStep = 'upload' | 'mapping' | 'categories' | 'preview' | 'complete';

export const GuestImport: React.FC = () => {
  const { currentEvent } = useEvent();
  const navigate = useNavigate();

  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 Data
  const [analysis, setAnalysis] = useState<HeaderAnalysisData | null>(null);

  // Step 2 Configuration (Column Mapping & Required Fields)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [requiredFields, setRequiredFields] = useState<string[]>(['name', 'category']);

  // Step 3 Configuration (Category Mapping)
  const [eventTicketTypes, setEventTicketTypes] = useState<TicketType[]>([]);
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const [defaultCategory, setDefaultCategory] = useState<string>('GENERAL');

  // Step 4 Data
  const [validationSummary, setValidationSummary] = useState<ValidationSummaryData | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'valid' | 'errors'>('valid');

  // Step 5 Data
  const [confirmResult, setConfirmResult] = useState<ImportConfirmationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch ticket types for the active event
  useEffect(() => {
    if (currentEvent?.id) {
      eventsApi
        .getTicketTypes(currentEvent.id)
        .then((types) => {
          setEventTicketTypes(types);
          if (types.length > 0) {
            setDefaultCategory(types[0].name);
          }
        })
        .catch(() => {});
    }
  }, [currentEvent?.id]);

  const TARGET_FIELDS = [
    { value: 'name', label: 'Guest Full Name', requiredDefault: true },
    { value: 'email', label: 'Email Address', requiredDefault: false },
    { value: 'phone', label: 'Phone Number', requiredDefault: false },
    { value: 'organization', label: 'Organization / Company', requiredDefault: false },
    { value: 'designation', label: 'Designation / Title', requiredDefault: false },
    { value: 'category', label: 'Ticket / Guest Category', requiredDefault: true },
    { value: 'count', label: 'Ticket Quantity / Seats', requiredDefault: false },
    { value: 'ignore', label: "Ignore / Don't Import", requiredDefault: false },
  ];

  const handleDownloadSample = () => {
    const csvContent =
      'Full Name,Email Address,Mobile Number,Company,Designation,Guest Type,Pass Count\n' +
      'Amit Sharma,amit.sharma@example.com,+919876543210,Tech Innovators India,Senior Architect,VIP,1\n' +
      'Priya Patel,priya.patel@example.com,+919812345678,Apex Global,Product Lead,GENERAL,2\n' +
      'Rohan Verma,rohan.verma@example.com,+919898989898,Security Operations,Coordinator,WORKER,1\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ticketification_guest_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      setError('Please upload a valid spreadsheet (.xlsx, .xls, or .csv)');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  // Step 1 -> Step 2: Upload & Analyze
  const handleUploadAndAnalyze = async () => {
    if (!file || !currentEvent) return;

    try {
      setLoading(true);
      setError(null);
      const data = await guestsApi.uploadFile(currentEvent.id, file);
      setAnalysis(data);
      setColumnMapping(data.detectedMappings);

      // Auto-populate category mapping
      const initialCatMap: Record<string, string> = {};
      data.detectedCategories.forEach((cat) => {
        const matched = eventTicketTypes.find(
          (t) =>
            t.name.toUpperCase() === cat.toUpperCase() ||
            t.label.toUpperCase() === cat.toUpperCase()
        );
        initialCatMap[cat] = matched ? matched.name : 'GENERAL';
      });
      setCategoryMapping(initialCatMap);

      setStep('mapping');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze spreadsheet');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> Step 3: Validate Mappings
  const handleProceedToCategories = () => {
    // Check if category is mapped
    const hasCategoryMapped = Object.values(columnMapping).includes('category');
    if (hasCategoryMapped && analysis?.detectedCategories && analysis.detectedCategories.length > 0) {
      setStep('categories');
    } else {
      // Jump directly to validation
      handleRunValidation();
    }
  };

  // Step 3 -> Step 4: Run Validation
  const handleRunValidation = async () => {
    if (!analysis || !currentEvent) return;

    try {
      setLoading(true);
      setError(null);
      const result = await guestsApi.validateImport(currentEvent.id, {
        importId: analysis.importId,
        columnMapping,
        requiredFields,
        categoryMapping,
        defaultCategory,
      });

      setValidationSummary(result);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 4 -> Step 5: Confirm Import
  const handleConfirmImport = async () => {
    if (!analysis || !currentEvent) return;

    try {
      setLoading(true);
      setError(null);
      const result = await guestsApi.confirmImport(currentEvent.id, {
        importId: analysis.importId,
        skipDuplicates,
      });

      setConfirmResult(result);
      setStep('complete');
    } catch (err: any) {
      setError(err.message || 'Failed to commit import');
    } finally {
      setLoading(false);
    }
  };

  const toggleRequiredField = (field: string) => {
    if (requiredFields.includes(field)) {
      setRequiredFields(requiredFields.filter((f) => f !== field));
    } else {
      setRequiredFields([...requiredFields, field]);
    }
  };

  if (!currentEvent) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center bg-surface-card border border-zinc-800 rounded-2xl p-8">
        <div className="w-12 h-12 bg-zinc-800 text-brand-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">No Active Event Selected</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6">
          Please select or create an event before importing guests.
        </p>
        <button
          onClick={() => navigate('/events')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
        >
          <Calendar className="w-4 h-4" />
          <span>Manage Events</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner with Event Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-card border border-zinc-800/80 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Smart Import Wizard</span>
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs font-semibold text-zinc-300">
              Event: <span className="text-white font-bold">{currentEvent.name}</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Import Guest List</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Upload Excel or CSV files, map columns intelligently, and validate records before generation.
          </p>
        </div>

        <button
          onClick={handleDownloadSample}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-brand-400" />
          <span>Download Sample Template</span>
        </button>
      </div>

      {/* 5-Step Stepper Progress Header */}
      <div className="bg-surface-card border border-zinc-800/80 p-4 rounded-2xl">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {[
            { id: 'upload', label: '1. Upload File' },
            { id: 'mapping', label: '2. Map Columns' },
            { id: 'categories', label: '3. Categories' },
            { id: 'preview', label: '4. Validate' },
            { id: 'complete', label: '5. Complete' },
          ].map((s, index, arr) => {
            const isCurrent = step === s.id;
            const isCompleted =
              (s.id === 'upload' && step !== 'upload') ||
              (s.id === 'mapping' && ['categories', 'preview', 'complete'].includes(step)) ||
              (s.id === 'categories' && ['preview', 'complete'].includes(step)) ||
              (s.id === 'preview' && step === 'complete');

            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      isCompleted
                        ? 'bg-brand-600 text-white'
                        : isCurrent
                        ? 'bg-brand-500/20 text-brand-400 ring-2 ring-brand-500'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                  </div>
                  <span
                    className={`text-xs font-bold hidden sm:inline ${
                      isCurrent ? 'text-white' : isCompleted ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {s.label.split('. ')[1]}
                  </span>
                </div>
                {index < arr.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded ${
                      isCompleted ? 'bg-brand-600' : 'bg-zinc-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          STEP 1: UPLOAD FILE
         ========================================================================= */}
      {step === 'upload' && (
        <div className="bg-surface-card border border-zinc-800/80 rounded-2xl p-8 space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-brand-500 bg-brand-500/10 scale-[0.99]'
                : file
                ? 'border-emerald-500/60 bg-emerald-500/5'
                : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4 text-brand-400 shadow-inner">
              {file ? (
                <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
              ) : (
                <Upload className="w-7 h-7" />
              )}
            </div>

            {file ? (
              <div>
                <h3 className="text-base font-bold text-white mb-1">{file.name}</h3>
                <p className="text-xs text-zinc-400">
                  {(file.size / 1024).toFixed(1)} KB • Ready for automated header analysis
                </p>
                <span className="inline-block mt-3 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
                  File Selected — Click to change
                </span>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  Drag & Drop your Excel or CSV file here
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
                  Supports .xlsx, .xls, and .csv files with custom headers and optional columns.
                </p>
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800 text-white text-xs font-bold rounded-xl border border-zinc-700">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse Files</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={handleUploadAndAnalyze}
              disabled={!file || loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20 disabled:opacity-40 active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Spreadsheet...</span>
                </>
              ) : (
                <>
                  <span>Next: Map Columns</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 2: MAP COLUMNS & CONFIGURE REQUIRED FIELDS
         ========================================================================= */}
      {step === 'mapping' && analysis && (
        <div className="bg-surface-card border border-zinc-800/80 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white">Column Mapping & Field Settings</h2>
              <p className="text-xs text-zinc-400">
                Found {analysis.headers.length} columns and {analysis.rowCount} rows. Confirm field mappings below.
              </p>
            </div>
            <div className="text-xs font-semibold text-zinc-400">
              File: <span className="text-white font-bold">{analysis.fileName}</span>
            </div>
          </div>

          {/* Mapping Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Excel Column Header</th>
                  <th className="py-2.5 px-3">Sample Data</th>
                  <th className="py-2.5 px-3">Match Confidence</th>
                  <th className="py-2.5 px-3">Map to Field</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {analysis.headers.map((header) => {
                  const currentTarget = columnMapping[header] || 'ignore';
                  const confidence = analysis.confidenceScores[header] || 0;

                  return (
                    <tr key={header} className="hover:bg-zinc-900/40">
                      <td className="py-3 px-3 font-bold text-white">{header}</td>
                      <td className="py-3 px-3 text-zinc-400 max-w-xs truncate">
                        {String(analysis.sampleRows[0]?.[header] || '—')}
                      </td>
                      <td className="py-3 px-3">
                        {confidence > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              confidence >= 0.9
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{Math.round(confidence * 100)}% Match</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500">Manual Map</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={currentTarget}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, [header]: e.target.value })
                          }
                          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                        >
                          {TARGET_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Required Fields Toggle Box */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-brand-400" />
              <span>Configure Required vs Optional Fields</span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Unchecked fields are treated as completely optional. Missing optional data will never fail or reject rows.
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { id: 'name', label: 'Full Name' },
                { id: 'category', label: 'Category' },
                { id: 'email', label: 'Email' },
                { id: 'phone', label: 'Phone' },
              ].map((field) => (
                <label
                  key={field.id}
                  className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={requiredFields.includes(field.id)}
                    onChange={() => toggleRequiredField(field.id)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-brand-600 focus:ring-0"
                  />
                  <span>{field.label} Required</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep('upload')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={handleProceedToCategories}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20 active:scale-95"
            >
              <span>Next: Configure Categories</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: CATEGORY MAPPING
         ========================================================================= */}
      {step === 'categories' && analysis && (
        <div className="bg-surface-card border border-zinc-800/80 rounded-2xl p-6 space-y-6">
          <div className="border-b border-zinc-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-brand-400" />
              <span>Map Spreadsheet Categories to Event Ticket Types</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Match the raw category strings found in your file to your event's ticket categories.
            </p>
          </div>

          <div className="space-y-4 max-w-2xl">
            {analysis.detectedCategories.length === 0 ? (
              <div className="text-xs text-zinc-400 bg-zinc-900 p-4 rounded-xl">
                No distinct categories found in column. All rows will default to{' '}
                <span className="text-white font-bold">{defaultCategory}</span>.
              </div>
            ) : (
              analysis.detectedCategories.map((rawCat) => (
                <div
                  key={rawCat}
                  className="flex items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-xl"
                >
                  <div>
                    <div className="text-xs font-bold text-white">"{rawCat}"</div>
                    <div className="text-[11px] text-zinc-400">Value from spreadsheet</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Maps to:</span>
                    <select
                      value={categoryMapping[rawCat] || 'GENERAL'}
                      onChange={(e) =>
                        setCategoryMapping({ ...categoryMapping, [rawCat]: e.target.value })
                      }
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-bold"
                    >
                      {eventTicketTypes.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.label} ({t.name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep('mapping')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={handleRunValidation}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating Rows...</span>
                </>
              ) : (
                <>
                  <span>Validate & Preview</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 4: VALIDATION PREVIEW & SUMMARY
         ========================================================================= */}
      {step === 'preview' && validationSummary && (
        <div className="bg-surface-card border border-zinc-800/80 rounded-2xl p-6 space-y-6">
          <div className="border-b border-zinc-800 pb-4">
            <h2 className="text-base font-bold text-white">Validation Summary</h2>
            <p className="text-xs text-zinc-400">
              Review validation results before saving records to the database.
            </p>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
              <div className="text-xs text-zinc-400 mb-1">Total Records</div>
              <div className="text-xl font-black text-white">{validationSummary.totalRows}</div>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
              <div className="text-xs text-emerald-400 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready to Import</span>
              </div>
              <div className="text-xl font-black text-emerald-400">
                {validationSummary.validRowsCount}
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
              <div className="text-xs text-amber-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Warnings</span>
              </div>
              <div className="text-xl font-black text-amber-400">
                {validationSummary.warningRowsCount}
              </div>
            </div>

            <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl">
              <div className="text-xs text-rose-400 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Invalid / Skipped</span>
              </div>
              <div className="text-xl font-black text-rose-400">
                {validationSummary.invalidRowsCount}
              </div>
            </div>
          </div>

          {/* Duplicate Option Toggle */}
          <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Skip Duplicate Entries</div>
              <div className="text-[11px] text-zinc-400">
                Automatically skips rows with identical email addresses or phone numbers.
              </div>
            </div>
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-brand-600 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Tabbed Inspector: Valid Rows Preview vs Errors */}
          <div className="space-y-3">
            <div className="flex border-b border-zinc-800 gap-4">
              <button
                onClick={() => setActiveTab('valid')}
                className={`pb-2 text-xs font-bold transition-colors ${
                  activeTab === 'valid'
                    ? 'text-brand-400 border-b-2 border-brand-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Sample Valid Rows ({validationSummary.sampleValidRows.length})
              </button>
              <button
                onClick={() => setActiveTab('errors')}
                className={`pb-2 text-xs font-bold transition-colors ${
                  activeTab === 'errors'
                    ? 'text-rose-400 border-b-2 border-rose-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Error & Warning Log ({validationSummary.errors.length})
              </button>
            </div>

            {activeTab === 'valid' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                      <th className="py-2 px-3">Row</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Org</th>
                      <th className="py-2 px-3">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {validationSummary.sampleValidRows.map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-900/40">
                        <td className="py-2 px-3 text-zinc-500 font-mono">{r.rowNumber}</td>
                        <td className="py-2 px-3 font-bold text-white">{r.name || '—'}</td>
                        <td className="py-2 px-3 text-zinc-300">{r.email || '—'}</td>
                        <td className="py-2 px-3 text-zinc-300">{r.phone || '—'}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/10 text-brand-300 border border-brand-500/20">
                            {r.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-400">{r.organization || '—'}</td>
                        <td className="py-2 px-3 text-zinc-300 font-mono">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {validationSummary.errors.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    No errors or warnings found! All rows passed validation.
                  </div>
                ) : (
                  validationSummary.errors.map((err, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        err.severity === 'ERROR'
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 bg-black/40 rounded">
                          Row {err.rowNumber}
                        </span>
                        <span>{err.message}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-black/40">
                        {err.severity}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep('categories')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={loading || validationSummary.validRowsCount === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing into Database...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm & Import ({validationSummary.validRowsCount} Guests)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 5: IMPORT COMPLETE CELEBRATION
         ========================================================================= */}
      {step === 'complete' && confirmResult && (
        <div className="bg-surface-card border border-zinc-800/80 rounded-2xl p-10 text-center space-y-6 max-w-2xl mx-auto animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-1">Import Completed Successfully!</h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Your guest list has been validated and imported into event database records.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
            <div>
              <div className="text-[11px] text-zinc-400">Imported Records</div>
              <div className="text-2xl font-black text-emerald-400">{confirmResult.importedCount}</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-400">Skipped Records</div>
              <div className="text-2xl font-black text-zinc-400">{confirmResult.skippedCount}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setStep('upload');
                setFile(null);
                setAnalysis(null);
                setValidationSummary(null);
                setConfirmResult(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl border border-zinc-700 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Import Another File</span>
            </button>

            <button
              onClick={() => navigate('/tickets')}
              className="inline-flex items-center gap-2 px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20"
            >
              <Users className="w-4 h-4" />
              <span>View Tickets & Guest List</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
