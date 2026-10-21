import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Terminal,
  Music,
  Sparkles,
  BookOpen,
  GraduationCap,
  Trophy,
  LayoutGrid,
  Award,
  Building2,
  Palette,
  Heart,
  Compass,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  MapPin,
  Clock,
  Ticket as TicketIcon,
  Globe,
  ShieldCheck,
  FileSpreadsheet,
  UserCheck,
} from 'lucide-react';
import {
  eventsApi,
  EventType,
  AttendanceMode,
  VenueType,
  HostingType,
  CreateEventWizardPayload,
} from '../../api/events';

interface EventCreationWizardProps {
  onSuccess?: (event: any) => void;
  onCancel?: () => void;
  initialEventType?: EventType;
}

const EVENT_TYPE_CARDS: {
  type: EventType;
  title: string;
  description: string;
  defaultCredential: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: 'CONFERENCE',
    title: 'Conference',
    description: 'Professional summits, keynotes, panels & multi-track sessions.',
    defaultCredential: 'Attendee Pass',
    icon: Users,
  },
  {
    type: 'HACKATHON',
    title: 'Hackathon / Tech Event',
    description: 'Collaborative sprint, prototype demo & technical challenge.',
    defaultCredential: 'Participant Pass',
    icon: Terminal,
  },
  {
    type: 'CONCERT',
    title: 'Concert',
    description: 'Live musical shows, band performances & acoustic festivals.',
    defaultCredential: 'Ticket',
    icon: Music,
  },
  {
    type: 'FESTIVAL',
    title: 'Festival',
    description: 'Multi-day community celebrations, cultural carnivals & fairs.',
    defaultCredential: 'Entry Pass',
    icon: Sparkles,
  },
  {
    type: 'WORKSHOP',
    title: 'Workshop',
    description: 'Hands-on training, interactive sessions & skill development.',
    defaultCredential: 'Participant Pass',
    icon: BookOpen,
  },
  {
    type: 'COLLEGE_EVENT',
    title: 'College / University Event',
    description: 'Campus symposiums, department fests & student club meets.',
    defaultCredential: 'Event Pass',
    icon: GraduationCap,
  },
  {
    type: 'SPORTS_EVENT',
    title: 'Sports Event',
    description: 'Tournaments, athletic matches, esports & championships.',
    defaultCredential: 'Entry Pass',
    icon: Trophy,
  },
  {
    type: 'EXHIBITION',
    title: 'Exhibition / Expo',
    description: 'Product trade expos, art galleries & industrial showcases.',
    defaultCredential: 'Visitor Pass',
    icon: LayoutGrid,
  },
  {
    type: 'AWARD_CEREMONY',
    title: 'Award Ceremony',
    description: 'Formal recognition galas, prize distributions & black-tie dinners.',
    defaultCredential: 'Guest Pass',
    icon: Award,
  },
  {
    type: 'CORPORATE_EVENT',
    title: 'Corporate Event',
    description: 'Annual general meetings, leadership retreats & product launches.',
    defaultCredential: 'Access Pass',
    icon: Building2,
  },
  {
    type: 'CULTURAL_EVENT',
    title: 'Cultural Event',
    description: 'Traditional theatre, classical music, dance & literary recitals.',
    defaultCredential: 'Entry Pass',
    icon: Palette,
  },
  {
    type: 'WEDDING',
    title: 'Wedding / Private Event',
    description: 'Bespoke weddings, celebratory banquets & private receptions.',
    defaultCredential: 'Invitation / Entry Pass',
    icon: Heart,
  },
  {
    type: 'OTHER',
    title: 'Other Gathering',
    description: 'Bespoke community meetups and specialized gatherings.',
    defaultCredential: 'Entry Pass',
    icon: Compass,
  },
];

const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+05:30)' },
  { value: 'UTC', label: 'UTC (Universal Coordinated Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT, UTC-05:00)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT, UTC-08:00)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT, UTC-06:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST, UTC+00:00)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST, UTC+01:00)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+08:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+09:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT, UTC+10:00)' },
];

export const EventCreationWizard: React.FC<EventCreationWizardProps> = ({
  onSuccess,
  onCancel,
  initialEventType,
}) => {
  const navigate = useNavigate();

  // Resolve initial event type safely
  const resolvedInitialType: EventType =
    initialEventType && EVENT_TYPE_CARDS.some((c) => c.type === initialEventType)
      ? initialEventType
      : 'HACKATHON';
  const initialCard = EVENT_TYPE_CARDS.find((c) => c.type === resolvedInitialType);

  // Wizard Step State (1 to 7)
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [eventType, setEventType] = useState<EventType>(resolvedInitialType);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [credentialTerminology, setCredentialTerminology] = useState<string>(
    initialCard?.defaultCredential || 'Participant Pass'
  );
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('TICKETIFICATION_REGISTRATION');

  // Keep state in sync if initialEventType changes externally
  useEffect(() => {
    if (initialEventType && EVENT_TYPE_CARDS.some((c) => c.type === initialEventType)) {
      setEventType(initialEventType);
      const card = EVENT_TYPE_CARDS.find((c) => c.type === initialEventType);
      if (card) {
        setCredentialTerminology(card.defaultCredential);
      }
    }
  }, [initialEventType]);

  // Registration options
  const [pricingModel, setPricingModel] = useState<'FREE' | 'PAID'>('FREE');
  const [registrationRequired, setRegistrationRequired] = useState<boolean>(true);
  const [capacity, setCapacity] = useState<string>('500');

  // Venue state
  const [venueType, setVenueType] = useState<VenueType>('PHYSICAL');
  const [venueName, setVenueName] = useState<string>('');
  const [venueAddress, setVenueAddress] = useState<string>('');
  const [venueCity, setVenueCity] = useState<string>('');
  const [venueRegion, setVenueRegion] = useState<string>('');
  const [venueCountry, setVenueCountry] = useState<string>('India');
  const [venuePostalCode, setVenuePostalCode] = useState<string>('');
  const [onlineDescription, setOnlineDescription] = useState<string>('');

  // Schedule state (defaults to next weekend)
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextWeekEnd = new Date(nextWeek.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState<string>(nextWeek.toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endDate, setEndDate] = useState<string>(nextWeekEnd.toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState<string>('18:00');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');

  // Organization Association & Verification state
  const [hostingType, setHostingType] = useState<HostingType>('INDIVIDUAL');
  const [orgName, setOrgName] = useState<string>('');
  const [orgInstitutionType, setOrgInstitutionType] = useState<string>('COLLEGE_UNIVERSITY');
  const [orgEmail, setOrgEmail] = useState<string>('');
  const [orgDepartment, setOrgDepartment] = useState<string>('');
  const [orgDesignation, setOrgDesignation] = useState<string>('');
  const [orgWebsite, setOrgWebsite] = useState<string>('');
  const [orgDocumentUrls, setOrgDocumentUrls] = useState<string[]>([]);

  // Handle Event Type Selection
  const handleSelectEventType = (type: EventType) => {
    setEventType(type);
    const card = EVENT_TYPE_CARDS.find((c) => c.type === type);
    if (card) {
      setCredentialTerminology(card.defaultCredential);
    }
  };

  // Banner file upload handler
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('Please select a PNG, JPEG, or WEBP banner image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Banner image size exceeds the 5MB limit.');
      return;
    }

    try {
      setIsUploadingBanner(true);
      setErrorMessage(null);
      const res = await eventsApi.uploadBanner(file);
      setBannerUrl(res.bannerUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload event banner.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // Validation before step advancement
  const validateStep = (currentStep: number): boolean => {
    setErrorMessage(null);

    if (currentStep === 1) {
      if (!eventType) {
        setErrorMessage('Please select an event type.');
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      if (!name.trim()) {
        setErrorMessage('Event name is required.');
        return false;
      }
      if (name.trim().length < 2 || name.trim().length > 120) {
        setErrorMessage('Event name must be between 2 and 120 characters.');
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      if (!credentialTerminology.trim()) {
        setErrorMessage('Credential terminology label is required.');
        return false;
      }
      if (credentialTerminology.trim().length < 2 || credentialTerminology.trim().length > 50) {
        setErrorMessage('Credential terminology must be between 2 and 50 characters.');
        return false;
      }
      return true;
    }

    if (currentStep === 4) {
      if (!attendanceMode) {
        setErrorMessage('Please select an attendance mode.');
        return false;
      }
      return true;
    }

    if (currentStep === 5) {
      if (venueType === 'PHYSICAL' || venueType === 'HYBRID') {
        if (!venueName.trim()) {
          setErrorMessage('Venue name is required for physical events.');
          return false;
        }
        if (!venueCity.trim()) {
          setErrorMessage('City is required for physical events.');
          return false;
        }
        if (!venueCountry.trim()) {
          setErrorMessage('Country is required for physical events.');
          return false;
        }
      }
      return true;
    }

    if (currentStep === 6) {
      if (!startDate || !startTime) {
        setErrorMessage('Start date and time are required.');
        return false;
      }
      if (!endDate || !endTime) {
        setErrorMessage('End date and time are required.');
        return false;
      }
      const startDateTime = new Date(`${startDate}T${startTime}:00`);
      const endDateTime = new Date(`${endDate}T${endTime}:00`);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        setErrorMessage('Invalid date or time provided.');
        return false;
      }
      if (endDateTime.getTime() <= startDateTime.getTime()) {
        setErrorMessage('Event end date/time must be strictly later than start date/time.');
        return false;
      }
      return true;
    }

    if (currentStep === 7) {
      if (hostingType === 'ORGANIZATION') {
        if (!orgName.trim()) {
          setErrorMessage('Organization name is required.');
          return false;
        }
        if (orgName.trim().length < 2 || orgName.trim().length > 150) {
          setErrorMessage('Organization name must be between 2 and 150 characters.');
          return false;
        }
        if (!orgEmail.trim()) {
          setErrorMessage('Official institutional email is required for organization verification.');
          return false;
        }
        if (!/^\S+@\S+\.\S+$/.test(orgEmail.trim())) {
          setErrorMessage('Please enter a valid institutional email address.');
          return false;
        }
        if (!orgDepartment.trim()) {
          setErrorMessage('Department or faculty is required.');
          return false;
        }
        if (!orgDesignation.trim()) {
          setErrorMessage('Your designation or role in the organization is required.');
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 8));
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // Submit Draft
  const handleSaveDraft = async () => {
    if (!validateStep(6) || !validateStep(7)) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const startDateTime = new Date(`${startDate}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${endDate}T${endTime}:00`).toISOString();

      const payload: CreateEventWizardPayload = {
        eventType,
        name: name.trim(),
        description: description.trim() || undefined,
        bannerUrl: bannerUrl || undefined,
        credentialTerminology: credentialTerminology.trim(),
        attendanceMode,
        venue: {
          type: venueType,
          name: venueName.trim() || undefined,
          address: venueAddress.trim() || undefined,
          city: venueCity.trim() || undefined,
          region: venueRegion.trim() || undefined,
          country: venueCountry.trim() || undefined,
          postalCode: venuePostalCode.trim() || undefined,
          onlineDescription: onlineDescription.trim() || undefined,
        },
        schedule: {
          startAt: startDateTime,
          endAt: endDateTime,
          timezone,
        },
        registration:
          attendanceMode === 'TICKETIFICATION_REGISTRATION'
            ? {
                pricingModel,
                registrationRequired,
                capacity: capacity ? parseInt(capacity, 10) : undefined,
              }
            : undefined,
        hostingType,
        organization:
          hostingType === 'ORGANIZATION'
            ? {
                name: orgName.trim(),
                institutionType: orgInstitutionType,
                officialEmail: orgEmail.trim(),
                department: orgDepartment.trim(),
                designation: orgDesignation.trim(),
                websiteUrl: orgWebsite.trim() || undefined,
                documentUrls: orgDocumentUrls,
              }
            : undefined,
      };

      const created = await eventsApi.createEvent(payload);

      if (onSuccess) {
        onSuccess(created);
      } else {
        navigate('/events');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save event draft. Please check your entries.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Steps Progress calculation
  const progressPercent = Math.round(((step - 1) / 7) * 100);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Wizard Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
            Step {step} of 8
          </span>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-2">
            {step === 1 && 'What type of event are you hosting?'}
            {step === 2 && 'Tell us the event basics'}
            {step === 3 && 'Configure credential terminology'}
            {step === 4 && 'How will attendees be managed?'}
            {step === 5 && 'Where is your event hosted?'}
            {step === 6 && 'Set the event schedule & timezone'}
            {step === 7 && 'Organization Association & Verification'}
            {step === 8 && 'Review and save your event draft'}
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            {step === 1 && 'Select an event category to tailor pass labels, workflows, and configuration defaults.'}
            {step === 2 && 'Define the public title, an optional description, and a visual event banner.'}
            {step === 3 && 'Choose how credentials appear to your attendees and staff (e.g. Ticket, Pass, Badge).'}
            {step === 4 && 'Choose whether to take registrations on Ticketification or import an existing roster.'}
            {step === 5 && 'Configure your in-person venue, online conference link, or hybrid attendance format.'}
            {step === 6 && 'Specify start and end dates and times in your local timezone.'}
            {step === 7 && 'Specify whether this event is individually hosted or hosted on behalf of an organization.'}
            {step === 8 && 'Verify all details before saving your draft. You can edit this anytime before submitting.'}
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="self-start sm:self-auto text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Cancel & Exit
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden mb-8">
        <div
          className="bg-emerald-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Inline Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Please review the following:</p>
            <p className="mt-0.5 text-xs text-rose-700">{errorMessage}</p>
            {errorMessage.includes('onboarding required') && (
              <button
                type="button"
                onClick={() => navigate('/onboarding')}
                className="mt-2 text-xs font-semibold text-rose-900 underline hover:no-underline"
              >
                Go to Organizer Onboarding &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step Content Container */}
      <div className="bg-white rounded-md border border-zinc-200 shadow-sm p-6 sm:p-8 mb-8">
        {/* ================= STEP 1: EVENT TYPE ================= */}
        {step === 1 && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {EVENT_TYPE_CARDS.map((card) => {
                const IconComponent = card.icon;
                const isSelected = eventType === card.type;
                return (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => handleSelectEventType(card.type)}
                    className={`text-left p-4 rounded-md border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <div
                          className={`w-9 h-9 rounded-md flex items-center justify-center ${
                            isSelected ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        {isSelected && (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-zinc-900 text-sm">{card.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{card.description}</p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-zinc-100 text-[11px] text-zinc-600 flex items-center justify-between">
                      <span>Default Pass:</span>
                      <span className="font-medium text-zinc-800">{card.defaultCredential}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= STEP 2: BASICS & BANNER ================= */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label htmlFor="event-name" className="block text-sm font-medium text-zinc-900 mb-1">
                Event Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="event-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. National HackFest 2026"
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <div className="flex justify-between text-xs text-zinc-400 mt-1">
                <span>Must be between 2 and 120 characters</span>
                <span>{name.length}/120</span>
              </div>
            </div>

            <div>
              <label htmlFor="event-description" className="block text-sm font-medium text-zinc-900 mb-1">
                Event Description <span className="text-xs text-zinc-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id="event-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide details about tracks, speakers, prerequisites, or schedules..."
                maxLength={2000}
                className="w-full px-3.5 py-2.5 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <div className="flex justify-between text-xs text-zinc-400 mt-1">
                <span>Markdown supported</span>
                <span>{description.length}/2000</span>
              </div>
            </div>

            {/* Event Banner Upload */}
            <div>
              <label className="block text-sm font-medium text-zinc-900 mb-1">
                Event Banner / Poster <span className="text-xs text-zinc-400 font-normal">(Optional, max 5MB)</span>
              </label>

              {bannerUrl ? (
                <div className="relative rounded border border-zinc-200 overflow-hidden bg-zinc-50 max-h-56 flex items-center justify-center">
                  <img src={bannerUrl} alt="Event Banner" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-zinc-700 hover:text-rose-600 shadow-sm"
                    title="Remove Banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border border-dashed border-zinc-300 rounded p-6 text-center hover:bg-zinc-50/50 transition-colors">
                  <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                  <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                    <span>Upload banner image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleBannerUpload}
                      disabled={isUploadingBanner}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-zinc-400 mt-1">PNG, JPEG or WEBP (16:9 ratio recommended)</p>
                  {isUploadingBanner && (
                    <div className="flex items-center justify-center gap-2 mt-2 text-xs text-zinc-600">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                      <span>Uploading to cloud storage...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 3: CREDENTIAL TERMINOLOGY ================= */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-zinc-50 p-4 rounded border border-zinc-200 text-xs text-zinc-600 leading-relaxed">
              <strong className="text-zinc-800">Credential Terminology:</strong> Ticketification treats all tickets, badges, and passes as universal cryptographic credentials under the hood. Customize what label is printed on attendee badges and scan screens.
            </div>

            <div>
              <label htmlFor="cred-term" className="block text-sm font-medium text-zinc-900 mb-1">
                Pass / Ticket Display Label <span className="text-rose-500">*</span>
              </label>
              <input
                id="cred-term"
                type="text"
                value={credentialTerminology}
                onChange={(e) => setCredentialTerminology(e.target.value)}
                placeholder="e.g. Participant Pass"
                maxLength={50}
                className="w-full px-3.5 py-2.5 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-zinc-400 mt-1">Between 2 and 50 characters</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-2">
                Quick Select Options:
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Ticket',
                  'Participant Pass',
                  'Attendee Pass',
                  'Entry Pass',
                  'Visitor Pass',
                  'Access Pass',
                  'Delegate Badge',
                  'VIP Pass',
                ].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setCredentialTerminology(term)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      credentialTerminology === term
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-medium'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Visual Preview */}
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Live Badge Header Preview
              </label>
              <div className="bg-zinc-900 text-white p-4 rounded-md max-w-sm flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    {name.trim() || 'Your Event Name'}
                  </div>
                  <div className="font-semibold text-sm text-emerald-400 mt-0.5">
                    {credentialTerminology.trim() || 'Ticket'}
                  </div>
                </div>
                <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <TicketIcon className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: ATTENDANCE & DATA MODE ================= */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mode A */}
              <button
                type="button"
                onClick={() => setAttendanceMode('TICKETIFICATION_REGISTRATION')}
                className={`text-left p-5 rounded-md border transition-all flex flex-col justify-between ${
                  attendanceMode === 'TICKETIFICATION_REGISTRATION'
                    ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div>
                  <div className="w-9 h-9 rounded-md bg-emerald-500 text-white flex items-center justify-center mb-3">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-zinc-900 text-sm">Mode A: Registration on Ticketification</h3>
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                    Attendees register, claim tickets, and fill custom attendee forms directly on your event’s public registration portal.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-emerald-700 font-medium">
                  Includes self-service checkout & live registration count
                </div>
              </button>

              {/* Mode B */}
              <button
                type="button"
                onClick={() => setAttendanceMode('EXISTING_ATTENDEE_DATA')}
                className={`text-left p-5 rounded-md border transition-all flex flex-col justify-between ${
                  attendanceMode === 'EXISTING_ATTENDEE_DATA'
                    ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div>
                  <div className="w-9 h-9 rounded-md bg-zinc-800 text-white flex items-center justify-center mb-3">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-zinc-900 text-sm">Mode B: Existing Attendee Data</h3>
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                    You already collected registrations via Google Forms, Excel, an ERP, or university database. You will import rosters and issue passes in bulk.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-700 font-medium">
                  Supports Excel / CSV imports and batch issuance
                </div>
              </button>
            </div>

            {/* Mode A Conditional Options */}
            {attendanceMode === 'TICKETIFICATION_REGISTRATION' && (
              <div className="p-4 rounded-md bg-zinc-50 border border-zinc-200 space-y-4">
                <h4 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">
                  Intended Registration Configuration (Draft Setting)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Pricing Model
                    </label>
                    <select
                      value={pricingModel}
                      onChange={(e) => setPricingModel(e.target.value as any)}
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="FREE">Free Event (Zero fee checkout)</option>
                      <option value="PAID">Paid Event (Requires verified payment gateway)</option>
                    </select>
                    {pricingModel === 'PAID' && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        Note: Paid events require institutional verification and Stripe/Razorpay setup before publication.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Expected Capacity Limit
                    </label>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="e.g. 500"
                      min={1}
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="reg-required"
                    checked={registrationRequired}
                    onChange={(e) => setRegistrationRequired(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="reg-required" className="text-xs text-zinc-700 cursor-pointer">
                    Registration is mandatory before issuing credentials
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 5: VENUE CONFIGURATION ================= */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-900 mb-2">Venue Format</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'PHYSICAL', label: 'Physical Venue', icon: MapPin },
                  { id: 'ONLINE', label: 'Online / Virtual', icon: Globe },
                  { id: 'HYBRID', label: 'Hybrid Format', icon: Compass },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = venueType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVenueType(item.id as VenueType)}
                      className={`p-3 rounded border text-center transition-all flex flex-col items-center gap-1.5 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 font-medium ring-1 ring-emerald-500'
                          : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Physical / Hybrid Fields */}
            {(venueType === 'PHYSICAL' || venueType === 'HYBRID') && (
              <div className="space-y-4 pt-2">
                <div>
                  <label htmlFor="venue-name" className="block text-xs font-medium text-zinc-700 mb-1">
                    Venue Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="venue-name"
                    type="text"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="e.g. Grand Convention Center, Hall B"
                    className="w-full px-3.5 py-2 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="venue-city" className="block text-xs font-medium text-zinc-700 mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="venue-city"
                      type="text"
                      value={venueCity}
                      onChange={(e) => setVenueCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      className="w-full px-3.5 py-2 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="venue-country" className="block text-xs font-medium text-zinc-700 mb-1">
                      Country <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="venue-country"
                      type="text"
                      value={venueCountry}
                      onChange={(e) => setVenueCountry(e.target.value)}
                      placeholder="e.g. India"
                      className="w-full px-3.5 py-2 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="venue-address" className="block text-xs font-medium text-zinc-700 mb-1">
                      Street Address <span className="text-xs text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="venue-address"
                      type="text"
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      placeholder="e.g. 100 Feet Road, Indiranagar"
                      className="w-full px-3.5 py-2 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="venue-postal" className="block text-xs font-medium text-zinc-700 mb-1">
                      Postal Code / PIN <span className="text-xs text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="venue-postal"
                      type="text"
                      value={venuePostalCode}
                      onChange={(e) => setVenuePostalCode(e.target.value)}
                      placeholder="e.g. 560038"
                      className="w-full px-3.5 py-2 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="venue-region" className="block text-xs font-medium text-zinc-700 mb-1">
                    State / Province / Region <span className="text-xs text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="venue-region"
                    type="text"
                    value={venueRegion}
                    onChange={(e) => setVenueRegion(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="w-full px-3.5 py-2 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Online / Hybrid Fields */}
            {(venueType === 'ONLINE' || venueType === 'HYBRID') && (
              <div className="pt-2">
                <label htmlFor="online-desc" className="block text-xs font-medium text-zinc-700 mb-1">
                  Virtual Participation Description <span className="text-xs text-zinc-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="online-desc"
                  rows={3}
                  value={onlineDescription}
                  onChange={(e) => setOnlineDescription(e.target.value)}
                  placeholder="e.g. Virtual livestream will be accessible to all registered delegates via Google Meet / Zoom link..."
                  className="w-full px-3.5 py-2 rounded border border-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Meeting URLs will be kept private and delivered safely upon valid credential check-in.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 6: SCHEDULE & TIMEZONE ================= */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start */}
              <div className="p-4 rounded border border-zinc-200 bg-zinc-50/50 space-y-3">
                <label className="block text-xs font-semibold text-zinc-800 uppercase tracking-wider">
                  Event Starts
                </label>
                <div>
                  <label htmlFor="start-date" className="block text-xs text-zinc-600 mb-1">Start Date</label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="start-time" className="block text-xs text-zinc-600 mb-1">Start Time</label>
                  <input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* End */}
              <div className="p-4 rounded border border-zinc-200 bg-zinc-50/50 space-y-3">
                <label className="block text-xs font-semibold text-zinc-800 uppercase tracking-wider">
                  Event Ends
                </label>
                <div>
                  <label htmlFor="end-date" className="block text-xs text-zinc-600 mb-1">End Date</label>
                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="end-time" className="block text-xs text-zinc-600 mb-1">End Time</label>
                  <input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="event-timezone" className="block text-sm font-medium text-zinc-900 mb-1">
                Event Schedule Timezone <span className="text-rose-500">*</span>
              </label>
              <select
                id="event-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1">
                Timestamps are normalized to UTC in storage and displayed in your chosen IANA timezone.
              </p>
            </div>
          </div>
        )}

        {/* ================= STEP 7: ORGANIZATION ASSOCIATION & VERIFICATION ================= */}
        {step === 7 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1">
                How is this event being hosted?
              </label>
              <p className="text-xs text-zinc-500 mb-4">
                You can host events independently or on behalf of an institution. Organization-hosted events require verification before public publication.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option 1: Individual */}
                <div
                  onClick={() => setHostingType('INDIVIDUAL')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    hostingType === 'INDIVIDUAL'
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        hostingType === 'INDIVIDUAL' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900">Individually Hosted</h4>
                      <p className="text-xs text-zinc-500">Personal or independent project</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
                    Host independently using your personal account. No organizational verification documents or institutional domain approval required.
                  </p>
                </div>

                {/* Option 2: Organization */}
                <div
                  onClick={() => setHostingType('ORGANIZATION')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    hostingType === 'ORGANIZATION'
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        hostingType === 'ORGANIZATION' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900">On Behalf of Organization</h4>
                      <p className="text-xs text-zinc-500">College, Company, Club, Non-Profit</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
                    Associate with an institution. Requires verification details. The event is saved as Draft — Verification Pending until reviewed.
                  </p>
                </div>
              </div>
            </div>

            {/* If Organization is selected, show details form */}
            {hostingType === 'ORGANIZATION' && (
              <div className="p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-4 animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Organization Verification Details
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Organization Name */}
                  <div className="sm:col-span-2">
                    <label htmlFor="org-name" className="block text-xs font-semibold text-zinc-800 mb-1">
                      Organization / Institution Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="org-name"
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Stanford University, Google Developer Student Club, TechCorp"
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Institution Type */}
                  <div>
                    <label htmlFor="org-type" className="block text-xs font-semibold text-zinc-800 mb-1">
                      Institution Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="org-type"
                      value={orgInstitutionType}
                      onChange={(e) => setOrgInstitutionType(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="COLLEGE_UNIVERSITY">College / University</option>
                      <option value="CORPORATE">Corporate / Enterprise</option>
                      <option value="NON_PROFIT">Non-Profit / NGO</option>
                      <option value="COMMUNITY_CLUB">Community Club / Society</option>
                      <option value="INDEPENDENT">Independent Entity</option>
                      <option value="GOVERNMENT">Government / Public Body</option>
                    </select>
                  </div>

                  {/* Official Institutional Email */}
                  <div>
                    <label htmlFor="org-email" className="block text-xs font-semibold text-zinc-800 mb-1">
                      Official Institutional Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="org-email"
                      type="email"
                      value={orgEmail}
                      onChange={(e) => setOrgEmail(e.target.value)}
                      placeholder="e.g. dean@stanford.edu or events@acme.com"
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Department */}
                  <div>
                    <label htmlFor="org-dept" className="block text-xs font-semibold text-zinc-800 mb-1">
                      Department / Faculty <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="org-dept"
                      type="text"
                      value={orgDepartment}
                      onChange={(e) => setOrgDepartment(e.target.value)}
                      placeholder="e.g. Computer Science & Engineering"
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label htmlFor="org-desig" className="block text-xs font-semibold text-zinc-800 mb-1">
                      Your Designation / Role <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="org-desig"
                      type="text"
                      value={orgDesignation}
                      onChange={(e) => setOrgDesignation(e.target.value)}
                      placeholder="e.g. Faculty Coordinator, Event Lead, Director"
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Website URL */}
                  <div className="sm:col-span-2">
                    <label htmlFor="org-web" className="block text-xs font-semibold text-zinc-800 mb-1">
                      Organization Website URL <span className="text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="org-web"
                      type="url"
                      value={orgWebsite}
                      onChange={(e) => setOrgWebsite(e.target.value)}
                      placeholder="https://example.org"
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Authorization Document URL */}
                  <div className="sm:col-span-2">
                    <label htmlFor="org-doc" className="block text-xs font-semibold text-zinc-800 mb-1">
                      Authorization Document / Reference URL <span className="text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="org-doc"
                      type="url"
                      value={orgDocumentUrls[0] || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setOrgDocumentUrls(val ? [val] : []);
                      }}
                      placeholder="https://example.org/authorization-letter.pdf"
                      className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Link to an institutional permission letter, accreditation, or student council approval.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-semibold">Publication Notice:</span> Organization-hosted events will be saved as{' '}
                    <span className="font-bold underline">Draft — Organization Verification Pending</span>. They will remain non-public and cannot be published until verified and approved by a platform administrator.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 8: REVIEW & SAVE ================= */}
        {step === 8 && (
          <div className="space-y-6">
            <div className={`p-4 rounded-md border text-xs flex items-center justify-between ${
              hostingType === 'ORGANIZATION'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${hostingType === 'ORGANIZATION' ? 'text-amber-600' : 'text-emerald-600'}`} />
                <span>
                  {hostingType === 'ORGANIZATION'
                    ? 'Review event & organization verification details before saving.'
                    : 'Ready to create your event! Review your configuration below.'}
                </span>
              </div>
              <span className="font-semibold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-white/70 border border-current">
                {hostingType === 'ORGANIZATION' ? 'DRAFT — VERIFICATION PENDING' : 'Status: DRAFT'}
              </span>
            </div>

            {/* Summary Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Event Identity */}
              <div className="p-4 rounded border border-zinc-200 bg-zinc-50/50 relative">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="absolute top-3 right-3 text-xs text-emerald-600 hover:underline"
                >
                  Edit
                </button>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Event Identity</div>
                <h3 className="font-semibold text-zinc-900 text-base mt-1">{name}</h3>
                <div className="text-xs text-zinc-500 mt-1">
                  Type: <span className="font-medium text-zinc-800">{eventType}</span>
                </div>
                {description && <p className="text-xs text-zinc-600 mt-2 line-clamp-2">{description}</p>}
                {bannerUrl && (
                  <img src={bannerUrl} alt="Banner" className="w-full h-24 object-cover rounded mt-3" />
                )}
              </div>

              {/* Card 2: Credential Terminology */}
              <div className="p-4 rounded border border-zinc-200 bg-zinc-50/50 relative">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="absolute top-3 right-3 text-xs text-emerald-600 hover:underline"
                >
                  Edit
                </button>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Credential Terminology</div>
                <div className="flex items-center gap-2 mt-2">
                  <TicketIcon className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-zinc-800 text-sm">{credentialTerminology}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Attendee badges and scanner consoles will display "{credentialTerminology}".
                </p>
              </div>

              {/* Card 3: Attendance Mode */}
              <div className="p-4 rounded border border-zinc-200 bg-zinc-50/50 relative">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="absolute top-3 right-3 text-xs text-emerald-600 hover:underline"
                >
                  Edit
                </button>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Attendance Mode</div>
                <h4 className="font-medium text-zinc-900 text-sm mt-1">
                  {attendanceMode === 'TICKETIFICATION_REGISTRATION'
                    ? 'Mode A: Registration on Ticketification'
                    : 'Mode B: Existing Attendee Data Import'}
                </h4>
                {attendanceMode === 'TICKETIFICATION_REGISTRATION' && (
                  <div className="text-xs text-zinc-600 mt-1">
                    Pricing: <span className="font-medium">{pricingModel}</span> • Capacity:{' '}
                    <span className="font-medium">{capacity || 'Unlimited'}</span>
                  </div>
                )}
              </div>

              {/* Card 4: Venue & Schedule */}
              <div className="p-4 rounded border border-zinc-200 bg-zinc-50/50 relative">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="absolute top-3 right-3 text-xs text-emerald-600 hover:underline"
                >
                  Edit
                </button>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Venue & Schedule</div>
                <div className="text-xs text-zinc-800 font-medium mt-1">
                  Format: {venueType} {venueName ? `• ${venueName}` : ''}
                </div>
                {venueCity && <div className="text-xs text-zinc-500">{venueCity}, {venueCountry}</div>}
                <div className="text-xs text-zinc-700 mt-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>
                    {startDate} {startTime} &rarr; {endDate} {endTime} ({timezone})
                  </span>
                </div>
              </div>

              {/* Card 5: Hosting & Verification */}
              <div className="p-4 rounded border border-zinc-200 bg-zinc-50/50 relative md:col-span-2">
                <button
                  type="button"
                  onClick={() => setStep(7)}
                  className="absolute top-3 right-3 text-xs text-emerald-600 hover:underline"
                >
                  Edit
                </button>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Hosting & Verification Association</div>
                {hostingType === 'ORGANIZATION' ? (
                  <div className="mt-2 space-y-1.5 text-xs text-zinc-700">
                    <div className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>{orgName}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                        Verification Pending
                      </span>
                    </div>
                    <div className="text-zinc-600">Category: <span className="font-medium text-zinc-800">{orgInstitutionType}</span></div>
                    <div className="text-zinc-600">Official Email: <span className="font-medium text-zinc-800">{orgEmail}</span></div>
                    <div className="text-zinc-600">Affiliation: <span className="font-medium text-zinc-800">{orgDepartment} ({orgDesignation})</span></div>
                    {orgWebsite && <div className="text-zinc-600">Website: <a href={orgWebsite} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">{orgWebsite}</a></div>}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-zinc-900">Individually Hosted</span>
                    <span className="text-[10px] bg-zinc-200 text-zinc-700 font-semibold px-2 py-0.5 rounded-full">
                      No Org Verification Required
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-zinc-300 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>
        ) : (
          <div />
        )}

        {step < 8 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-stone-900 hover:bg-black text-xs font-semibold text-white transition-colors"
          >
            Next Step
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded bg-stone-900 hover:bg-black text-xs font-semibold text-white transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Event Draft...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                {hostingType === 'ORGANIZATION' ? 'Save & Submit for Verification' : 'Save Event Draft'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default EventCreationWizard;
