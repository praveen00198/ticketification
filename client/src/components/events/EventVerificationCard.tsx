import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Send,
  Building2,
  Mail,
  Loader2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  eventsApi,
  EventVerificationData,
  VerificationDraftPayload,
} from '../../api/events';

interface EventVerificationCardProps {
  eventId: string;
  isOwner?: boolean;
  onStatusChange?: (newStatus: string) => void;
}

export const EventVerificationCard: React.FC<EventVerificationCardProps> = ({
  eventId,
  isOwner = true,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [verification, setVerification] = useState<EventVerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState('COLLEGE_UNIVERSITY');
  const [officialEmail, setOfficialEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const fetchVerification = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getVerification(eventId);
      if (data) {
        setVerification(data);
        setInstitutionName(data.institutionName || '');
        setInstitutionType(data.institutionType || 'COLLEGE_UNIVERSITY');
        setOfficialEmail(data.officialEmail || '');
        setDepartment(data.department || '');
        setDesignation(data.designation || '');
        setWebsiteUrl(data.websiteUrl || '');
      }
    } catch (err: any) {
      // 404 is expected if no verification record exists yet
      if (err.status !== 404) {
        setError(err.message || 'Could not load verification status.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerification();
  }, [eventId]);

  const handleSaveDraft = async () => {
    if (!institutionName.trim() || !officialEmail.trim()) {
      setError('Institution Name and Official Email are required to save a draft.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload: VerificationDraftPayload = {
        institutionName: institutionName.trim(),
        institutionType,
        officialEmail: officialEmail.trim(),
        department: department.trim(),
        designation: designation.trim(),
        websiteUrl: websiteUrl.trim() || undefined,
      };

      const updated = await eventsApi.saveVerificationDraft(eventId, payload);
      setVerification(updated);
      setSuccessMsg('Verification details saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save verification draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    if (!officialEmail.trim()) {
      setError('Please enter your official institutional email first.');
      return;
    }

    try {
      setSendingOtp(true);
      setError(null);
      const res = await eventsApi.sendVerificationOtp(eventId, officialEmail.trim());
      setOtpSent(true);
      if (res.devOtp) {
        setDevOtpHint(res.devOtp);
      }
      setSuccessMsg('Verification code sent to ' + officialEmail);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit numeric verification code.');
      return;
    }

    try {
      setVerifyingOtp(true);
      setError(null);
      await eventsApi.verifyOtp(eventId, otpCode.trim());
      setSuccessMsg('Official email verified successfully!');
      setOtpSent(false);
      setOtpCode('');
      setDevOtpHint(null);
      await fetchVerification();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB limit.');
      return;
    }

    try {
      setUploadingDoc(true);
      setError(null);
      await eventsApi.uploadVerificationDocument(eventId, file);
      setSuccessMsg('Verification document uploaded.');
      await fetchVerification();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload document.');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleRemoveDoc = async (docUrl: string) => {
    try {
      setError(null);
      await eventsApi.removeVerificationDocument(eventId, docUrl);
      setSuccessMsg('Document removed.');
      await fetchVerification();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove document.');
    }
  };

  const handleSubmit = async () => {
    if (!verification?.otpVerified) {
      setError('You must verify your official institutional email before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await eventsApi.submitVerification(eventId);
      setVerification(res.data);
      setSuccessMsg('Verification submitted! Your event is now pending admin review.');
      if (onStatusChange) {
        onStatusChange('SUBMITTED');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit verification request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-surface-border rounded-2xl p-6 shadow-sm flex items-center justify-center gap-3 text-zinc-500 text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
        <span>Loading institutional verification...</span>
      </div>
    );
  }

  const isVerified = verification?.status === 'VERIFIED';
  const isPending = verification?.status === 'PENDING';
  const isRejected = verification?.status === 'REJECTED';

  return (
    <div className="bg-white border border-surface-border rounded-2xl shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="p-6 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isVerified
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : isPending
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : isRejected
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
            }`}
          >
            {isVerified ? (
              <ShieldCheck className="w-5 h-5" />
            ) : isPending ? (
              <Clock className="w-5 h-5" />
            ) : isRejected ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <Shield className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900">Institutional Verification</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isVerified
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : isPending
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : isRejected
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-zinc-200 text-zinc-700 border border-zinc-300'
                }`}
              >
                {verification?.status || 'UNVERIFIED'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Verify university or corporate affiliation to unlock public registrations and credentials.
            </p>
          </div>
        </div>

        {/* Risk Tier Badge (if calculated) */}
        {verification?.riskTier && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-500">Risk Assessment:</span>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                verification.riskTier === 'LOW'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : verification.riskTier === 'MEDIUM'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {verification.riskTier} RISK ({verification.riskScore}/100)
            </span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Alerts */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Status Views */}
        {isVerified && (
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 text-xs text-emerald-900 space-y-3">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Event Approved & Verified</span>
            </div>
            <p className="text-emerald-700 leading-relaxed">
              This event is officially verified under <strong>{verification?.institutionName}</strong>. Public registration, pass issuance, and high-throughput day-of-event check-ins are enabled.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-zinc-700 border-t border-emerald-200/80">
              <div>
                <span className="font-semibold text-zinc-500">Official Contact:</span>{' '}
                <span className="font-mono text-zinc-900">{verification?.officialEmail}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-500">Department / Role:</span>{' '}
                <span>
                  {verification?.department} ({verification?.designation})
                </span>
              </div>
            </div>
          </div>
        )}

        {isPending && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 text-xs text-amber-900 space-y-3">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Verification Under Platform Review</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              Your institutional verification details and authorization documents have been submitted and are being reviewed by platform administrators. You will be notified once review completes.
            </p>
            {verification?.submittedAt && (
              <p className="text-[11px] text-amber-700 font-mono">
                Submitted on: {new Date(verification.submittedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {isRejected && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-xs text-rose-900 space-y-3">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Verification Rejected</span>
            </div>
            <p className="text-rose-800 leading-relaxed">
              Platform administration was unable to verify this event. Please review the feedback below, update your authorization documents, and resubmit for review.
            </p>
            {verification?.reviewNotes && (
              <div className="p-3 bg-white rounded-lg border border-rose-200 text-rose-900 font-mono text-[11px]">
                <strong>Reviewer Notes:</strong> {verification.reviewNotes}
              </div>
            )}
          </div>
        )}

        {/* Verification Form (Editable if UNVERIFIED, DRAFT, or REJECTED) */}
        {(!isVerified && !isPending && isOwner) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Institution / Organization Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stanford University / Tech Corp"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Institution Type *
                </label>
                <select
                  value={institutionType}
                  onChange={(e) => setInstitutionType(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-sm"
                >
                  <option value="COLLEGE_UNIVERSITY">College / University</option>
                  <option value="HIGH_SCHOOL">High School</option>
                  <option value="STUDENT_ORGANIZATION">Student Organization</option>
                  <option value="NON_PROFIT">Non-Profit Organization</option>
                  <option value="CORPORATE">Corporate Enterprise</option>
                  <option value="INDEPENDENT">Independent Organizer</option>
                </select>
              </div>
            </div>

            {/* Official Email with OTP Flow */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-zinc-700">
                    Official Domain Email *
                  </label>
                  {verification?.otpVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Email Verified</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      disabled={verification?.otpVerified}
                      placeholder="e.g. dean@university.edu"
                      value={officialEmail}
                      onChange={(e) => setOfficialEmail(e.target.value)}
                      className={`w-full bg-white border border-zinc-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-sm ${
                        verification?.otpVerified ? 'bg-zinc-100 text-zinc-500 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>

                  {!verification?.otpVerified && (
                    <button
                      type="button"
                      disabled={sendingOtp || !officialEmail.trim()}
                      onClick={handleSendOtp}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                    >
                      {sendingOtp ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{otpSent ? 'Resend Code' : 'Send Code'}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Must be an institutional or company domain email (not generic Gmail/Yahoo/Outlook).
                </p>
              </div>

              {/* OTP Input Field */}
              {otpSent && !verification?.otpVerified && (
                <div className="pt-2 border-t border-zinc-200 flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full sm:w-48 font-mono tracking-widest text-center text-sm font-bold bg-white border border-stone-300 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-stone-400/20 shadow-sm"
                  />
                  <button
                    type="button"
                    disabled={verifyingOtp || otpCode.trim().length !== 6}
                    onClick={handleVerifyOtp}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    {verifyingOtp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Verify Code</span>
                  </button>
                  {devOtpHint && (
                    <span className="text-[11px] font-mono text-stone-800 bg-stone-100 px-2 py-1 rounded border border-stone-200">
                      Dev Code: {devOtpHint}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Department & Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Department / Unit *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Department of Computer Science"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Designation / Role *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Associate Professor / Lead Organizer"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-sm"
                />
              </div>
            </div>

            {/* Official Website */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Official Website URL
              </label>
              <input
                type="url"
                placeholder="https://engineering.stanford.edu"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-sm"
              />
            </div>

            {/* Authorization Document Upload */}
            <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">
                    Authorization Documents (PDF, PNG, JPEG, WEBP)
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Official approval letter, institution badge, or venue contract (max 10MB each).
                  </p>
                </div>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-all shadow-sm">
                  {uploadingDoc ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-900" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-stone-700" />
                  )}
                  <span>Upload Document</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpeg,.jpg,.webp"
                    disabled={uploadingDoc}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Uploaded Documents List */}
              {verification?.documentUrls && verification.documentUrls.length > 0 ? (
                <div className="space-y-1.5 pt-2">
                  {verification.documentUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-zinc-200 text-xs text-zinc-800"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-stone-700 flex-shrink-0" />
                        <span className="truncate max-w-xs font-mono text-[11px]">{url}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-zinc-500 hover:text-zinc-900 transition-colors"
                          title="Open document"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(url)}
                          className="p-1 text-rose-500 hover:text-rose-700 transition-colors"
                          title="Remove document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400 italic pt-1">
                  No authorization documents uploaded yet.
                </p>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-200">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveDraft}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving Draft...' : 'Save Draft'}
              </button>

              <button
                type="button"
                disabled={submitting || !verification?.otpVerified}
                onClick={handleSubmit}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>Submit for Verification</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
