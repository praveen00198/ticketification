import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, XCircle, RotateCcw } from 'lucide-react';
import { apiClient } from '../api/client';
import { ImportValidationSummary } from '../types';

export const GuestImport: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportValidationSummary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSummary(null);
    }
  };

  const handleReset = () => {
    setFile(null);
    setError(null);
    setSummary(null);
    setGenerating(false);
    setGenerationProgress(null);
  };

  const handleUploadAndValidate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res: any = await apiClient.post('/guests/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmGenerateTickets = async () => {
    if (!summary || summary.validRows.length === 0) return;
    setGenerating(true);
    setGenerationProgress(`Generating tickets for ${summary.validRows.length} valid guests...`);

    const payload = {
      guests: summary.validRows.map((r) => r.data),
    };

    try {
      const res: any = await apiClient.post('/tickets/generate', payload);
      if (res.success && res.data) {
        setGenerationProgress(`Successfully generated ${res.data.totalGenerated} tickets! Redirecting to ticket repository...`);
        setTimeout(() => {
          navigate('/tickets');
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Ticket generation failed.');
      setGenerating(false);
    }
  };

  const currentStep = summary ? (generating ? 3 : 2) : 1;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header & Back Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-charcoal">Import Guest List (Excel)</h1>
          <p className="text-xs text-surface-muted mt-1">
            Upload your .xlsx spreadsheet. Review contact validation summaries before generating scannable image credentials.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="text-xs font-semibold text-zinc-600 hover:text-surface-charcoal bg-white border border-surface-border hover:bg-surface-bg px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>
      </div>

      {/* Stepper Wizard Bar */}
      <div className="bg-white rounded-xl border border-surface-border p-3.5 shadow-sm flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
            currentStep >= 1 ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'
          }`}>
            1
          </span>
          <span className={`font-semibold ${currentStep === 1 ? 'text-surface-charcoal font-bold' : 'text-zinc-500'}`}>
            Upload Excel
          </span>
        </div>

        <div className="h-0.5 flex-1 mx-3 bg-zinc-200"></div>

        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
            currentStep >= 2 ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'
          }`}>
            2
          </span>
          <span className={`font-semibold ${currentStep === 2 ? 'text-surface-charcoal font-bold' : 'text-zinc-500'}`}>
            Validate & Preview
          </span>
        </div>

        <div className="h-0.5 flex-1 mx-3 bg-zinc-200"></div>

        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
            currentStep >= 3 ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'
          }`}>
            3
          </span>
          <span className={`font-semibold ${currentStep === 3 ? 'text-surface-charcoal font-bold' : 'text-zinc-500'}`}>
            Generate Tickets
          </span>
        </div>
      </div>

      {/* Step 1: Upload Box */}
      <div className="bg-white rounded-2xl border border-surface-border p-8 shadow-sm">
        <div className="border-2 border-dashed border-zinc-300 rounded-xl p-8 text-center hover:border-brand-500 transition-colors bg-surface-bg/40">
          <FileSpreadsheet className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
          <h3 className="font-bold text-base text-surface-charcoal">Choose or Drop .xlsx Spreadsheet</h3>
          <p className="text-xs text-surface-muted mt-1 max-w-sm mx-auto">
            Requires columns for <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">Name</code> and <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">Phone</code> (or WhatsApp/Mobile). Optional: Email, Organization, Designation.
          </p>

          <input
            type="file"
            accept=".xlsx, .xls"
            id="excel-file-input"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <label
              htmlFor="excel-file-input"
              className="bg-surface-charcoal hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> {file ? 'Change File' : 'Select Excel File'}
            </label>

            {file && !summary && (
              <button
                onClick={handleUploadAndValidate}
                disabled={loading}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Processing & Validating...
                  </>
                ) : (
                  <>
                    Parse & Validate Data <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {file && (
              <button
                onClick={handleReset}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          {file && (
            <div className="mt-3 text-xs font-mono text-zinc-600">
              Selected: <span className="font-bold">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Validation Error</span>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Validation Diagnostic Summary & Preview */}
      {summary && (
        <div className="space-y-6">
          {/* Metrics summary banner */}
          <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="text-xs uppercase font-semibold text-zinc-500 block">Total Rows Analyzed</span>
              <span className="text-2xl font-extrabold text-surface-charcoal">{summary.totalRecords}</span>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-xs uppercase font-semibold text-emerald-700 block">Valid Guests</span>
              <span className="text-2xl font-extrabold text-emerald-700">{summary.validRecordsCount}</span>
            </div>

            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-xs uppercase font-semibold text-rose-700 block">Invalid Rows</span>
              <span className="text-2xl font-extrabold text-rose-700">{summary.invalidRecordsCount}</span>
            </div>
          </div>

          {/* Row-Level Errors List */}
          {summary.errors.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm">
              <h3 className="font-bold text-sm text-rose-900 flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-rose-600" /> Invalid Row Diagnostics ({summary.errors.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rose-100 text-rose-700 font-semibold uppercase">
                      <th className="pb-2">Row #</th>
                      <th className="pb-2">Field</th>
                      <th className="pb-2">Problem</th>
                      <th className="pb-2">Suggested Fix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50">
                    {summary.errors.map((err, idx) => (
                      <tr key={idx} className="text-rose-900">
                        <td className="py-2.5 font-mono font-bold">Row {err.rowNumber}</td>
                        <td className="py-2.5 font-semibold">{err.field}</td>
                        <td className="py-2.5">{err.problem}</td>
                        <td className="py-2.5 text-rose-700 italic">{err.suggestedCorrection || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview of Valid Records & Generate Action */}
          <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="font-bold text-base text-surface-charcoal">Valid Guest Data Preview</h3>
                <p className="text-xs text-surface-muted">
                  Review the {summary.validRecordsCount} valid guest records below before starting batch ticket generation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Choose Different File
                </button>

                <button
                  onClick={handleConfirmGenerateTickets}
                  disabled={generating || summary.validRecordsCount === 0}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-extrabold px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Generating Tickets...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Generate {summary.validRecordsCount} Tickets
                    </>
                  )}
                </button>
              </div>
            </div>

            {generationProgress && (
              <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>{generationProgress}</span>
              </div>
            )}

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface-bg border-b border-surface-border text-surface-muted font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Excel Row</th>
                    <th className="py-2.5 px-3">Guest Name</th>
                    <th className="py-2.5 px-3">Phone / WhatsApp</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3">Ticket Type</th>
                    <th className="py-2.5 px-3">Organization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {summary.validRows.map((r) => (
                    <tr key={r.rowNumber} className="hover:bg-surface-bg/40">
                      <td className="py-2.5 px-3 font-mono text-zinc-500">Row {r.rowNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-surface-charcoal">{r.data.name}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">{r.data.phone || '—'}</td>
                      <td className="py-2.5 px-3 text-zinc-600">{r.data.email || '—'}</td>
                      <td className="py-2.5 px-3 text-zinc-700">{r.data.event}</td>
                      <td className="py-2.5 px-3 font-semibold text-brand-600">{r.data.ticketType}</td>
                      <td className="py-2.5 px-3 text-zinc-500">{r.data.organization || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
