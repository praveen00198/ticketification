import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Globe,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
} from 'lucide-react';
import { hostApi, InstitutionType, HostProfileData } from '../api/host';

export const HostProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Profile data
  const [profileData, setProfileData] = useState<HostProfileData | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('COLLEGE_UNIVERSITY');
  const [institutionName, setInstitutionName] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const data = await hostApi.getProfile();
        if (isMounted) {
          setProfileData(data);
          if (data.hostProfile) {
            setOrganizationName(data.hostProfile.organizationName || '');
            setInstitutionType(data.hostProfile.institutionType || 'COLLEGE_UNIVERSITY');
            setInstitutionName(data.hostProfile.institutionName || '');
            setWebsite(data.hostProfile.website || '');
            setPhone(data.hostProfile.phone || '');
            setBio(data.hostProfile.bio || '');
            setLogoUrl(data.hostProfile.logoUrl || null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setNotification({
            type: 'error',
            message: 'Failed to load organizer profile. Please refresh or sign in again.',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setNotification({
        type: 'success',
        message: 'Logo updated in object storage.',
      });
    } catch (err: any) {
      setFieldErrors((prev) => ({
        ...prev,
        logo: err.response?.data?.error || 'Failed to upload logo image.',
      }));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!organizationName.trim()) {
      errors.organizationName = 'Organization name is required.';
    } else if (organizationName.trim().length < 2) {
      errors.organizationName = 'Organization name must be at least 2 characters.';
    }

    if (website.trim()) {
      try {
        const url = new URL(website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.website = 'Website must use http:// or https://.';
        }
      } catch {
        errors.website = 'Invalid website format.';
      }
    }

    if (phone.trim()) {
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{4,20}$/;
      if (!phoneRegex.test(phone.trim())) {
        errors.phone = 'Invalid phone number format.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (!validate()) return;

    setSaving(true);
    try {
      const result = await hostApi.updateProfile({
        organizationName: organizationName.trim(),
        institutionType,
        institutionName: institutionName.trim() || null,
        website: website.trim() || null,
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        logoUrl: logoUrl || null,
      });

      setProfileData(result);
      setNotification({
        type: 'success',
        message: 'Organizer profile updated successfully.',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to save organizer profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Loading organizer settings...</span>
        </div>
      </div>
    );
  }

  if (!profileData?.isOnboarded) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-md p-8 border border-zinc-200 shadow-sm">
          <Building2 className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-zinc-900">Organizer Profile Not Configured</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Please complete initial onboarding to set up your organizer workspace.
          </p>
          <button
            onClick={() => navigate('/onboarding')}
            className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Start Organizer Onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/events')}
            className="text-xs text-zinc-500 hover:text-zinc-800 flex items-center gap-1 mb-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Events</span>
          </button>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Organizer Settings
          </h1>
        </div>

        {/* Workspace status badges */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
            Workspace: Active
          </span>
          <span className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-600 border border-zinc-200 text-xs font-medium">
            Verification: {profileData.verificationStatus}
          </span>
        </div>
      </div>

      {notification && (
        <div
          className={`mb-6 p-4 rounded-md border flex items-center gap-3 text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-md p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-5">
          {/* Organization Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className={`w-full px-3 py-2 text-sm text-zinc-900 bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
                fieldErrors.organizationName
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-zinc-300 focus:ring-emerald-500 focus:border-emerald-500'
              }`}
            />
            {fieldErrors.organizationName && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.organizationName}</p>
            )}
          </div>

          {/* Institution Type */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Category
            </label>
            <select
              value={institutionType}
              onChange={(e) => setInstitutionType(e.target.value as InstitutionType)}
              className="w-full px-3 py-2 text-sm text-zinc-900 bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="COLLEGE_UNIVERSITY">College or University</option>
              <option value="CORPORATE">Company or Enterprise</option>
              <option value="COMMUNITY_CLUB">Community or Club</option>
              <option value="INDEPENDENT">Independent Organizer</option>
            </select>
          </div>

          {/* Institution Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Affiliated Institution / Company Name
            </label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder="e.g. Stanford University, Acme Corp"
              className="w-full px-3 py-2 text-sm text-zinc-900 bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Grid: Website & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Website
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Globe className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm text-zinc-900 bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {fieldErrors.website && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.website}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Contact Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm text-zinc-900 bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              About Organizer / Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 text-sm text-zinc-900 bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Organization Logo
            </label>
            {logoUrl ? (
              <div className="flex items-center gap-4 p-3 bg-zinc-50 border border-zinc-200 rounded-md">
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-12 h-12 rounded object-cover border border-zinc-200 bg-white"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900">Current Logo Asset</p>
                  <label
                    htmlFor="replace-logo-input"
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 cursor-pointer font-medium"
                  >
                    Replace Image
                  </label>
                  <input
                    id="replace-logo-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-zinc-300 rounded-md p-4 text-center bg-zinc-50/50">
                <label
                  htmlFor="upload-logo-input"
                  className="cursor-pointer text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Upload Organization Logo
                </label>
                <input
                  id="upload-logo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
            )}
            {fieldErrors.logo && <p className="mt-1 text-xs text-red-600">{fieldErrors.logo}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/events')}
            className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || isUploadingLogo}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default HostProfilePage;
