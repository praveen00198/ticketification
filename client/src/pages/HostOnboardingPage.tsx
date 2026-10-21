import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  GraduationCap,
  Briefcase,
  Users,
  Compass,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Globe,
  Phone,
  FileText,
  X,
  Loader2,
} from 'lucide-react';
import { hostApi, InstitutionType, HostProfileData } from '../api/host';
import { extractErrorMessage } from '../api/client';

interface HostOnboardingPageProps {
  onOnboardingComplete?: (data: HostProfileData) => void;
}

export const HostOnboardingPage: React.FC<HostOnboardingPageProps> = ({ onOnboardingComplete }) => {
  const navigate = useNavigate();

  // Form State
  const [organizationName, setOrganizationName] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('COLLEGE_UNIVERSITY');
  const [institutionName, setInstitutionName] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Status and UI States
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successData, setSuccessData] = useState<HostProfileData | null>(null);

  // Check if user is already onboarded
  useEffect(() => {
    let isMounted = true;
    const fetchExisting = async () => {
      try {
        const data = await hostApi.getProfile();
        if (isMounted) {
          if (data.isOnboarded && data.hostProfile) {
            setSuccessData(data);
            setOrganizationName(data.hostProfile.organizationName);
            setInstitutionType(data.hostProfile.institutionType);
            setInstitutionName(data.hostProfile.institutionName || '');
            setWebsite(data.hostProfile.website || '');
            setPhone(data.hostProfile.phone || '');
            setBio(data.hostProfile.bio || '');
            setLogoUrl(data.hostProfile.logoUrl || null);
          }
        }
      } catch (err: any) {
        // Network or profile fetch error
        console.warn('[HostOnboarding] Profile load note:', err.message);
      } finally {
        if (isMounted) setPageLoading(false);
      }
    };

    fetchExisting();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Logo Upload
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, logo: 'Logo file size exceeds the 2MB limit.' }));
      return;
    }

    setIsUploadingLogo(true);
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.logo;
      return copy;
    });

    try {
      const result = await hostApi.uploadLogo(file);
      setLogoUrl(result.logoUrl);
    } catch (err: any) {
      setFieldErrors((prev) => ({
        ...prev,
        logo: extractErrorMessage(err, 'Failed to upload logo image. Please try again.'),
      }));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
  };

  // Client Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!organizationName.trim()) {
      errors.organizationName = 'Organization or brand name is required.';
    } else if (organizationName.trim().length < 2) {
      errors.organizationName = 'Organization name must be at least 2 characters.';
    } else if (organizationName.trim().length > 120) {
      errors.organizationName = 'Organization name cannot exceed 120 characters.';
    }

    if (institutionType === 'COLLEGE_UNIVERSITY' && !institutionName.trim()) {
      errors.institutionName = 'College or University name is required for academic organizers.';
    }

    if (website.trim()) {
      try {
        const url = new URL(website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.website = 'Website must use http:// or https://.';
        }
      } catch {
        errors.website = 'Please enter a valid website address.';
      }
    }

    if (phone.trim()) {
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{4,20}$/;
      if (!phoneRegex.test(phone.trim())) {
        errors.phone = 'Please enter a valid phone number (e.g. +1 555-0199 or 9876543210).';
      }
    }

    if (bio.trim() && bio.trim().length > 500) {
      errors.bio = 'Bio cannot exceed 500 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        organizationName: organizationName.trim(),
        institutionType,
        institutionName: institutionName.trim() || null,
        website: website.trim() || null,
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        logoUrl: logoUrl || null,
      };

      const result = await hostApi.completeOnboarding(payload);
      setSuccessData(result);
      if (onOnboardingComplete) {
        onOnboardingComplete(result);
      }
    } catch (err: any) {
      const message = extractErrorMessage(
        err,
        'Unable to initialize organizer workspace. Please review your entries and try again.'
      );
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
          <span>Loading organizer workspace...</span>
        </div>
      </div>
    );
  }

  // Success Confirmation View
  if (successData && successData.isOnboarded) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white rounded-md p-8 sm:p-10 border border-zinc-200 shadow-sm text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 tracking-tight">
            Organizer Workspace Active
          </h1>
          <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">
            Your host profile for <strong className="text-zinc-800">{successData.hostProfile?.organizationName}</strong> has been configured. You can now plan events, manage credentials, and access organizer tools.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 px-3 py-1.5 bg-zinc-50 rounded border border-zinc-200 text-xs text-zinc-600">
            <span>Workspace: <strong className="text-emerald-700">Active</strong></span>
            <span className="text-zinc-300">•</span>
            <span>Verification: <strong className="text-zinc-700">Unverified</strong></span>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/events')}
              className="w-full sm:w-auto px-5 py-2.5 bg-stone-900 hover:bg-black text-white rounded-md text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <span>Manage Events</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSuccessData(null)}
              className="w-full sm:w-auto px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md text-sm font-medium transition-colors"
            >
              Edit Organizer Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  const institutionOptions = [
    {
      id: 'COLLEGE_UNIVERSITY',
      label: 'College or University',
      desc: 'Campus clubs, fest committees, and academic departments',
      icon: GraduationCap,
    },
    {
      id: 'CORPORATE',
      label: 'Company or Enterprise',
      desc: 'Corporate conferences, workshops, and offsites',
      icon: Briefcase,
    },
    {
      id: 'COMMUNITY_CLUB',
      label: 'Community or Club',
      desc: 'Tech meetups, developer communities, and sports leagues',
      icon: Users,
    },
    {
      id: 'INDEPENDENT',
      label: 'Independent Organizer',
      desc: 'Individual creators, event producers, and coordinators',
      icon: Compass,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header Introduction */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight">
          Organizer Onboarding
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Set up your organization profile to configure events, issue credentials, and manage event operations.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Setup Error</p>
            <p className="mt-0.5 text-red-700">{errorMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section A: Organization Details */}
        <section className="bg-white rounded-md p-6 sm:p-8 border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100">
            <Building2 className="w-5 h-5 text-stone-900" />
            <h2 className="text-base font-semibold text-zinc-900">
              Organization Details
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            {/* Organization Name */}
            <div>
              <label htmlFor="organizationName" className="block text-xs font-medium text-zinc-700 mb-1">
                Organization / Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                id="organizationName"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. ACM Student Chapter, Pulse TechFest, Acme Corp"
                maxLength={120}
                className={`w-full px-3 py-2 text-sm text-zinc-900 bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
                  fieldErrors.organizationName
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-zinc-300 focus:ring-stone-900 focus:border-stone-900'
                }`}
              />
              {fieldErrors.organizationName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.organizationName}</p>
              )}
            </div>

            {/* Bio / Summary */}
            <div>
              <label htmlFor="bio" className="block text-xs font-medium text-zinc-700 mb-1">
                About the Organizer <span className="text-zinc-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief description of your organization or event series..."
                maxLength={500}
                className={`w-full px-3 py-2 text-sm text-zinc-900 bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
                  fieldErrors.bio
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-zinc-300 focus:ring-stone-900 focus:border-stone-900'
                }`}
              />
              <div className="flex justify-between mt-1 text-[11px] text-zinc-400">
                <span>Appears on public event passes and organizer cards.</span>
                <span>{bio.length} / 500</span>
              </div>
              {fieldErrors.bio && <p className="mt-1 text-xs text-red-600">{fieldErrors.bio}</p>}
            </div>

            {/* Grid: Website & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="website" className="block text-xs font-medium text-zinc-700 mb-1">
                  Website / Portfolio <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    id="website"
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.org"
                    maxLength={255}
                    className={`w-full pl-9 pr-3 py-2 text-sm text-zinc-900 bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
                      fieldErrors.website
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-zinc-300 focus:ring-stone-900 focus:border-stone-900'
                    }`}
                  />
                </div>
                {fieldErrors.website && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.website}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-zinc-700 mb-1">
                  Contact Phone <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    maxLength={30}
                    className={`w-full pl-9 pr-3 py-2 text-sm text-zinc-900 bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
                      fieldErrors.phone
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-zinc-300 focus:ring-stone-900 focus:border-stone-900'
                    }`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
                )}
              </div>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Organization Logo <span className="text-zinc-400 font-normal">(PNG, JPG, WEBP, max 2MB)</span>
              </label>

              {logoUrl ? (
                <div className="flex items-center gap-4 p-3 bg-zinc-50 border border-zinc-200 rounded-md">
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="w-12 h-12 rounded object-cover border border-zinc-200 bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-900 truncate">Logo Uploaded</p>
                    <p className="text-[11px] text-zinc-400">Stored in Supabase Object Storage</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="p-1.5 text-zinc-400 hover:text-red-600 rounded transition-colors"
                    title="Remove Logo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border border-dashed border-zinc-300 rounded-md p-5 text-center bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                  {isUploadingLogo ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                      <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
                      <span>Uploading asset to object storage...</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-1.5" />
                      <label
                        htmlFor="logo-file-input"
                        className="cursor-pointer text-xs font-medium text-stone-900 hover:text-black underline"
                      >
                        Click to upload an image
                      </label>
                      <input
                        id="logo-file-input"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                      <p className="text-[11px] text-zinc-400 mt-1">
                        Recommended size: 400x400 square format
                      </p>
                    </div>
                  )}
                </div>
              )}
              {fieldErrors.logo && <p className="mt-1 text-xs text-red-600">{fieldErrors.logo}</p>}
            </div>
          </div>
        </section>

        {/* Section B: Institution Affiliation */}
        <section className="bg-white rounded-md p-6 sm:p-8 border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100">
            <GraduationCap className="w-5 h-5 text-stone-900" />
            <h2 className="text-base font-semibold text-zinc-900">
              Institution Affiliation
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-2">
                Organizer Category <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {institutionOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = institutionType === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setInstitutionType(opt.id as InstitutionType)}
                      className={`p-3.5 rounded-md border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-stone-900' : 'text-zinc-400'}`} />
                        <span className="text-xs font-semibold text-zinc-900">{opt.label}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500 pl-6.5">
                        {opt.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conditional Institution Name for College / University or Corporate */}
            {(institutionType === 'COLLEGE_UNIVERSITY' || institutionType === 'CORPORATE') && (
              <div>
                <label htmlFor="institutionName" className="block text-xs font-medium text-zinc-700 mb-1">
                  {institutionType === 'COLLEGE_UNIVERSITY' ? 'College / University Name' : 'Company Name'}{' '}
                  {institutionType === 'COLLEGE_UNIVERSITY' && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <input
                    id="institutionName"
                    type="text"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder={
                      institutionType === 'COLLEGE_UNIVERSITY'
                        ? 'e.g. Indian Institute of Technology Bombay'
                        : 'e.g. Acme Innovations Pvt Ltd'
                    }
                    maxLength={150}
                    className={`w-full pl-9 pr-3 py-2 text-sm text-zinc-900 bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
                      fieldErrors.institutionName
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-zinc-300 focus:ring-stone-900 focus:border-stone-900'
                    }`}
                  />
                </div>
                {fieldErrors.institutionName && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.institutionName}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Section C: Preview & Submit */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-200">
          <p className="text-xs text-zinc-500">
            By initializing your workspace, you can manage events and invite staff under this organization.
          </p>

          <button
            type="submit"
            disabled={isSubmitting || isUploadingLogo}
            className="w-full sm:w-auto px-6 py-2.5 bg-stone-900 hover:bg-black disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing Workspace...</span>
              </>
            ) : (
              <>
                <span>Complete Organizer Setup</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HostOnboardingPage;
