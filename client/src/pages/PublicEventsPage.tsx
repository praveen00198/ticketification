import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Video,
  Ticket,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  X,
  AlertCircle,
} from "lucide-react";
import {
  RiCompass3Line,
  RiMacbookLine,
  RiMicLine,
  RiMusic2Line,
  RiSparklingLine,
  RiToolsLine,
  RiGraduationCapLine,
  RiLayoutGridLine,
  RiSearchLine,
  RiMapPin2Line,
  RiArrowRightSLine,
  RiArrowUpSFill,
  RiArrowDownSFill,
  RiCloseLine,
} from "@remixicon/react";
import { publicApi, PublicEventSummary } from "../api/public";
import { EmptyEventsState } from "../components/ui";

const PRIMARY_EVENT_TYPES = [
  { label: "All Categories", value: "ALL", icon: RiCompass3Line },
  { label: "Hackathons", value: "HACKATHON", icon: RiMacbookLine },
  { label: "Conferences", value: "CONFERENCE", icon: RiMicLine },
];

const MORE_EVENT_TYPES = [
  { label: "Concerts & Music", value: "CONCERT", icon: RiMusic2Line },
  { label: "Festivals", value: "FESTIVAL", icon: RiSparklingLine },
  { label: "Workshops", value: "WORKSHOP", icon: RiToolsLine },
  { label: "College Fests", value: "COLLEGE_EVENT", icon: RiGraduationCapLine },
  { label: "Exhibitions", value: "EXHIBITION", icon: RiLayoutGridLine },
];

const VENUE_TYPE_OPTIONS = [
  { label: "All Formats", value: "ALL" },
  { label: "In-Person", value: "PHYSICAL" },
  { label: "Virtual", value: "ONLINE" },
  { label: "Hybrid", value: "HYBRID" },
];

const PRICING_OPTIONS = [
  { label: "All Pricing", value: "ALL" },
  { label: "Free Passes", value: "FREE" },
  { label: "Paid Admission", value: "PAID" },
];

const POPULAR_CITIES = [
  "San Francisco",
  "New York",
  "Bangalore",
  "London",
  "Berlin",
  "Delhi NCR",
  "Mumbai",
  "Singapore",
  "Tokyo",
  "Austin",
];

export const PublicEventsPage: React.FC = () => {
  const navigate = useNavigate();

  const [events, setEvents] = useState<PublicEventSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedVenue, setSelectedVenue] = useState("ALL");
  const [selectedPricing, setSelectedPricing] = useState("ALL");
  const [cityInput, setCityInput] = useState("");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await publicApi.getPublicEvents({
        page,
        limit: 12,
        search: search.trim() || undefined,
        eventType: selectedType !== "ALL" ? selectedType : undefined,
        venueType: selectedVenue !== "ALL" ? selectedVenue : undefined,
        pricingModel: selectedPricing !== "ALL" ? selectedPricing : undefined,
        city: cityInput.trim() || undefined,
      });

      setEvents(res.events || []);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error("Failed to load public events:", err);
      setError(
        err?.response?.data?.message ||
          "Unable to connect to the events catalog. Please try again.",
      );
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedType, selectedVenue, selectedPricing, cityInput]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  // "More >" dropdown state and click-outside listener
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  // City dropdown state and click-outside listener
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [cityFilterQuery, setCityFilterQuery] = useState("");
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(e.target as Node)
      ) {
        setIsMoreOpen(false);
      }
      if (
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format (Venue) & Pricing scroll ticker states
  const [venueDirection, setVenueDirection] = useState<"up" | "down" | null>(null);
  const [venueAnimKey, setVenueAnimKey] = useState(0);

  const [pricingDirection, setPricingDirection] = useState<"up" | "down" | null>(null);
  const [pricingAnimKey, setPricingAnimKey] = useState(0);

  const handlePrevVenue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = VENUE_TYPE_OPTIONS.findIndex((v) => v.value === selectedVenue);
    const prevIndex = (currentIndex - 1 + VENUE_TYPE_OPTIONS.length) % VENUE_TYPE_OPTIONS.length;
    setVenueDirection("up");
    setVenueAnimKey((prev) => prev + 1);
    setSelectedVenue(VENUE_TYPE_OPTIONS[prevIndex].value);
    setPage(1);
  };

  const handleNextVenue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = VENUE_TYPE_OPTIONS.findIndex((v) => v.value === selectedVenue);
    const nextIndex = (currentIndex + 1) % VENUE_TYPE_OPTIONS.length;
    setVenueDirection("down");
    setVenueAnimKey((prev) => prev + 1);
    setSelectedVenue(VENUE_TYPE_OPTIONS[nextIndex].value);
    setPage(1);
  };

  const handlePrevPricing = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = PRICING_OPTIONS.findIndex((p) => p.value === selectedPricing);
    const prevIndex = (currentIndex - 1 + PRICING_OPTIONS.length) % PRICING_OPTIONS.length;
    setPricingDirection("up");
    setPricingAnimKey((prev) => prev + 1);
    setSelectedPricing(PRICING_OPTIONS[prevIndex].value);
    setPage(1);
  };

  const handleNextPricing = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = PRICING_OPTIONS.findIndex((p) => p.value === selectedPricing);
    const nextIndex = (currentIndex + 1) % PRICING_OPTIONS.length;
    setPricingDirection("down");
    setPricingAnimKey((prev) => prev + 1);
    setSelectedPricing(PRICING_OPTIONS[nextIndex].value);
    setPage(1);
  };

  const currentVenueLabel =
    VENUE_TYPE_OPTIONS.find((v) => v.value === selectedVenue)?.label || "All Formats";
  const currentPricingLabel =
    PRICING_OPTIONS.find((p) => p.value === selectedPricing)?.label || "All Pricing";

  const activeMoreCategory = MORE_EVENT_TYPES.find(
    (opt) => opt.value === selectedType
  );

  const handleResetFilters = () => {
    setSearch("");
    setSelectedType("ALL");
    setSelectedVenue("ALL");
    setSelectedPricing("ALL");
    setCityInput("");
    setPage(1);
    setVenueDirection(null);
    setPricingDirection(null);
    setIsMoreOpen(false);
  };

  const hasActiveFilters = Boolean(
    search ||
    selectedType !== "ALL" ||
    selectedVenue !== "ALL" ||
    selectedPricing !== "ALL" ||
    cityInput,
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Date TBA";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-white text-[#111827] font-sans">
      {/* ── Top Header Section (Header Text, Search, City Dropdown, and Categories) ── */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pt-0 pb-3 space-y-3.5">
          {/* Headline & Subtitle */}
          <div className="space-y-1 mb-6">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
              Discover & Attend Gatherings
            </h1>
            <p className="text-xs sm:text-sm text-stone-300">
              Explore hackathons, developer summits, workshops, and cultural fests. Claim verified credentials and access dynamic QR passes.
            </p>
          </div>

          {/* ── Search Bar & Separate City Selector ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Event Keyword Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex-1 flex items-center bg-white rounded-full border border-stone-200/90 shadow-2xs hover:border-stone-400 focus-within:border-stone-900 focus-within:shadow-xs px-3.5 py-1.5 transition-all"
            >
              <RiSearchLine className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by event title, topic, or keyword..."
                className="w-full bg-transparent pl-2.5 pr-2 py-1 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer mr-1"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                className="!rounded-full px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <span>Search</span>
                <RiArrowRightSLine className="w-4 h-4" />
              </button>
            </form>

            {/* Separate City Search & Dropdown Menu */}
            <div className="relative shrink-0 w-full sm:w-80" ref={cityDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCityOpen((prev) => !prev)}
                className={`w-full inline-flex items-center justify-between gap-2 px-4 py-3 rounded-full border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                  cityInput
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 border-stone-200/90"
                }`}
              >
                <div className="flex items-center gap-2 truncate flex-1">
                  <RiMapPin2Line
                    className={`w-3.5 h-3.5 shrink-0 ${
                      cityInput ? "text-white" : "text-stone-500"
                    }`}
                  />
                  <span className="truncate font-medium text-sm tracking-wide">
                    {cityInput ? cityInput : "Select City"}
                  </span>
                </div>
                {cityInput ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setCityInput("");
                      setCityFilterQuery("");
                      setPage(1);
                    }}
                    className="p-0.5 -mr-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                    title="Clear city"
                  >
                    <RiCloseLine className="w-3.5 h-3.5 text-white" />
                  </span>
                ) : (
                  <RiArrowDownSFill
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isCityOpen ? "rotate-180 text-stone-900" : "text-stone-400"
                    }`}
                  />
                )}
              </button>

              {/* City Dropdown Menu with Search Bar */}
              {isCityOpen && (
                <div className="absolute left-0 top-full mt-2 w-full bg-white rounded-2xl border border-stone-200/90 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Search bar inside the dropdown menu */}
                  <div className="relative flex items-center bg-stone-50 rounded-xl border border-stone-200 px-3 py-1.5 mb-2 focus-within:border-stone-900 focus-within:bg-white transition-all">
                    <RiSearchLine className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <input
                      type="text"
                      value={cityFilterQuery}
                      onChange={(e) => setCityFilterQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (cityFilterQuery.trim()) {
                            setCityInput(cityFilterQuery.trim());
                            setPage(1);
                            setIsCityOpen(false);
                          }
                        }
                      }}
                      placeholder="Search city or region..."
                      autoFocus
                      className="w-full bg-transparent pl-2 pr-1 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none"
                    />
                    {cityFilterQuery && (
                      <button
                        type="button"
                        onClick={() => setCityFilterQuery("")}
                        className="text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Custom city entry option */}
                  {cityFilterQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setCityInput(cityFilterQuery.trim());
                        setPage(1);
                        setIsCityOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-900 hover:bg-stone-100 transition-colors mb-2 text-left bg-stone-50 border border-stone-200/70"
                    >
                      <RiMapPin2Line className="w-3.5 h-3.5 text-stone-700 shrink-0" />
                      <span className="truncate">Filter by "{cityFilterQuery.trim()}"</span>
                    </button>
                  )}

                  {/* Quick Cities List */}
                  <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-2 py-1">
                    Popular Hubs
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCityInput("");
                        setCityFilterQuery("");
                        setPage(1);
                        setIsCityOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                        !cityInput
                          ? "bg-stone-100 text-stone-900 font-bold"
                          : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 font-medium"
                      }`}
                    >
                      <span>All Locations / Worldwide</span>
                      {!cityInput && (
                        <span className="text-[10px] text-stone-500 font-semibold">Active</span>
                      )}
                    </button>

                    {POPULAR_CITIES.filter((c) =>
                      c.toLowerCase().includes(cityFilterQuery.toLowerCase()),
                    ).map((c) => {
                      const isSelected = cityInput.toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCityInput(c);
                            setPage(1);
                            setIsCityOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                            isSelected
                              ? "bg-stone-100 text-stone-900 font-bold"
                              : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <RiMapPin2Line className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{c}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] text-stone-500 font-semibold">Active</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Category Chips (Left) & Format + Pricing Ticker Chips (Right) ── */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Left side: 2-3 categories + 'more >' dropdown chip */}
            <div className="relative flex items-center gap-2 overflow-visible flex-wrap sm:flex-nowrap">
              {PRIMARY_EVENT_TYPES.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (isSelected && opt.value !== "ALL") {
                        setSelectedType("ALL");
                      } else {
                        setSelectedType(opt.value);
                      }
                      setPage(1);
                      setIsMoreOpen(false);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? "bg-stone-900 text-white shadow-xs border border-stone-900"
                        : "bg-white hover:bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200/80 shadow-2xs"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isSelected ? "text-white" : "text-stone-500"
                      }`}
                    />
                    <span>{opt.label}</span>
                    {isSelected && opt.value !== "ALL" && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedType("ALL");
                          setPage(1);
                        }}
                        className="p-0.5 -mr-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                        title="Remove category filter"
                      >
                        <RiCloseLine className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}

              {/* 'more >' Dropdown Chip */}
              <div className="relative" ref={moreDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeMoreCategory
                      ? "bg-stone-900 text-white shadow-xs border border-stone-900"
                      : "bg-white hover:bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200/80 shadow-2xs"
                  }`}
                >
                  <span>{activeMoreCategory ? activeMoreCategory.label : "More"}</span>
                  {activeMoreCategory ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedType("ALL");
                        setPage(1);
                        setIsMoreOpen(false);
                      }}
                      className="p-0.5 -mr-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                      title="Clear category filter"
                    >
                      <RiCloseLine className="w-3.5 h-3.5 text-white" />
                    </span>
                  ) : (
                    <RiArrowRightSLine
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        isMoreOpen ? "rotate-90" : ""
                      } text-stone-500`}
                    />
                  )}
                </button>

                {/* Dropdown Menu */}
                {isMoreOpen && (
                  <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-2xl border border-stone-200/90 shadow-xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                    {MORE_EVENT_TYPES.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedType("ALL");
                            } else {
                              setSelectedType(opt.value);
                            }
                            setPage(1);
                            setIsMoreOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-stone-100 text-stone-900 font-bold"
                              : "text-stone-700 hover:bg-stone-50 hover:text-stone-900 font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                            <span>{opt.label}</span>
                          </div>
                          {isSelected && (
                            <RiCloseLine className="w-3.5 h-3.5 text-stone-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Separate Format & Pricing chips (no labels) with scroll animation */}
            <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
              {/* Separate Format Chip */}
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white border border-stone-200/90 shadow-2xs text-xs font-semibold">
                <div className="relative overflow-hidden h-5 flex items-center min-w-[64px]">
                  <span
                    key={`venue-${selectedVenue}-${venueAnimKey}`}
                    className={`font-medium text-stone-900 whitespace-nowrap block select-none ${
                      venueDirection === "up"
                        ? "animate-scroll-up"
                        : venueDirection === "down"
                        ? "animate-scroll-down"
                        : ""
                    }`}
                  >
                    {currentVenueLabel}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center -space-y-2.5">
                  <button
                    type="button"
                    onClick={handlePrevVenue}
                    className="text-stone-400 hover:text-stone-900 transition-colors cursor-pointer leading-none"
                    title="Previous Format"
                    aria-label="Previous Format"
                  >
                    <RiArrowUpSFill className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextVenue}
                    className="text-stone-400 hover:text-stone-900 transition-colors p-0.5 cursor-pointer leading-none"
                    title="Next Format"
                    aria-label="Next Format"
                  >
                    <RiArrowDownSFill className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Separate Pricing Chip */}
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white border border-stone-200/90 shadow-2xs text-xs font-semibold">
                <div className="relative overflow-hidden h-5 flex items-center min-w-[64px]">
                  <span
                    key={`pricing-${selectedPricing}-${pricingAnimKey}`}
                    className={`font-medium text-stone-900 whitespace-nowrap block select-none ${
                      pricingDirection === "up"
                        ? "animate-scroll-up"
                        : pricingDirection === "down"
                        ? "animate-scroll-down"
                        : ""
                    }`}
                  >
                    {currentPricingLabel}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center -space-y-2.5">
                  <button
                    type="button"
                    onClick={handlePrevPricing}
                    className="text-stone-400 hover:text-stone-900 transition-colors cursor-pointer leading-none"
                    title="Previous Pricing"
                    aria-label="Previous Pricing"
                  >
                    <RiArrowUpSFill className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPricing}
                    className="text-stone-400 hover:text-stone-900 transition-colors p-0.5 cursor-pointer leading-none"
                    title="Next Pricing"
                    aria-label="Next Pricing"
                  >
                    <RiArrowDownSFill className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 space-y-4">
        {/* ── Loading Skeleton ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 bg-white border border-stone-200/80 rounded-2xl animate-pulse p-4 space-y-4"
              >
                <div className="h-40 bg-stone-100 rounded-xl" />
                <div className="h-4 bg-stone-100 rounded w-3/4" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
                <div className="h-3 bg-stone-100 rounded w-1/3 pt-4" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* ── Error State with Retry ── */
          <div className="py-16 text-center bg-white border border-rose-200 rounded-2xl p-8 space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-stone-900">
                Failed to Load Catalog
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={fetchEvents}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="min-h-[420px] w-full flex flex-col items-center justify-center">
            <EmptyEventsState
              title={
                hasActiveFilters
                  ? "No Events Match Your Filters"
                  : "No Public Events Published Yet"
              }
              description={
                hasActiveFilters
                  ? "Try broadening your search term or resetting category filters to discover other live gatherings."
                  : "Organizers publish events frequently. Check back soon or create your own event now."
              }
              slotText={hasActiveFilters ? "NO MATCHES" : "UNCLAIMED SLOT"}
              categoryText={
                hasActiveFilters
                  ? "FILTER • 0 PASSES"
                  : "PASS • 0 ADMISSION"
              }
              actionText={hasActiveFilters ? "Clear All Filters" : "Create an Event"}
              onAction={
                hasActiveFilters
                  ? handleResetFilters
                  : () => navigate("/events/create")
              }
            />
          </div>
        ) : (
          /* ── Event Grid ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}/public`)}
                className="group relative flex flex-col justify-between bg-white border border-stone-200/90 hover:border-stone-900 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-stone-900/5 hover:-translate-y-0.5"
              >
                {/* Banner Header */}
                <div className="relative h-44 w-full bg-stone-100 overflow-hidden">
                  {event.bannerUrl ? (
                    <img
                      src={event.bannerUrl}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-300">
                      <Sparkles className="w-8 h-8 text-stone-300" />
                    </div>
                  )}

                  {/* Badges Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md bg-white/95 backdrop-blur-md text-stone-800 text-[11px] font-bold uppercase tracking-wider shadow-sm border border-stone-200/50">
                      {event.eventType.replace("_", " ")}
                    </span>
                    {event.verificationStatus === "VERIFIED" && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-stone-900 group-hover:text-black transition-colors line-clamp-1">
                      {event.name}
                    </h3>
                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                      {event.description ||
                        "Join attendees for this high-impact gathering and networking opportunity."}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-stone-100 text-xs text-stone-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span>{formatDate(event.schedule?.startAt)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {event.venue?.type === "ONLINE" ? (
                        <>
                          <Video className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          <span className="truncate">Virtual Gathering</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">
                            {event.venue?.city ? `${event.venue.city}, ` : ""}
                            {event.venue?.name || "Venue TBA"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-stone-700 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200">
                      <Ticket className="w-3.5 h-3.5 text-stone-600" />
                      {event.registration?.pricingModel === "PAID"
                        ? "Paid Admission"
                        : "Free Pass"}
                    </span>

                    <span className="inline-flex items-center gap-1 font-semibold text-stone-800 group-hover:text-black transition-colors">
                      View Details
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination Controls ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6 border-t border-stone-200/80">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg bg-white hover:bg-stone-50 disabled:opacity-40 text-xs font-semibold text-stone-700 border border-stone-200 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-stone-500">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 rounded-lg bg-white hover:bg-stone-50 disabled:opacity-40 text-xs font-semibold text-stone-700 border border-stone-200 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicEventsPage;
