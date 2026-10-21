import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Search,
  ShieldCheck,
  QrCode,
  Users,
  Loader2,
  ArrowRight,
  LifeBuoy,
} from 'lucide-react';
import { supportApi, FAQItem } from '../api/support';
import { ROUTES } from '../routes/paths';

export const HelpCenterPage: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  useEffect(() => {
    const fetchFaqs = async () => {
      setLoading(true);
      try {
        const res = await supportApi.getFaqs();
        if (res.success) {
          setFaqs(res.data || []);
          // Open first 2 FAQs by default
          if (res.data && res.data.length > 0) {
            setOpenIds({ [res.data[0].id]: true, [res.data[1].id]: true });
          }
        }
      } catch (err) {
        console.error('Failed to load FAQs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFaqs();
  }, []);

  const toggleFaq = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const categories = ['ALL', ...Array.from(new Set(faqs.map((f) => f.category)))];

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = activeCategory === 'ALL' || faq.category === activeCategory;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Help Center & FAQs</h1>
          <p className="text-sm text-stone-500 mt-1">
            Official documentation, common operational queries, and credential troubleshooting guides.
          </p>
        </div>

        <Link
          to={ROUTES.REPORT_ISSUE}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors shadow-2xs shrink-0 self-start sm:self-auto"
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          Report an Issue
        </Link>
      </div>

      {/* Quick Topic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2 shadow-2xs">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <QrCode className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900">Passes & QR Verification</h3>
          <p className="text-[11px] text-stone-500">
            How cryptographic dynamic QR codes work at the event check-in gate.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2 shadow-2xs">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900">Attendance Verification</h3>
          <p className="text-[11px] text-stone-500">
            Records are verified exclusively when scanned by authorized turnstile staff.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2 shadow-2xs">
          <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center border border-stone-200">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900">Event Hosting & Staff</h3>
          <p className="text-[11px] text-stone-500">
            Manage your attendees, assign volunteers, and view live turnout analytics.
          </p>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search FAQs (e.g., wallet, check-in, tickets)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-stone-200 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-zinc-900 text-white font-semibold shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:text-zinc-900 hover:bg-stone-200'
                }`}
              >
                {cat === 'ALL' ? 'All Questions' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Accordion List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-medium text-stone-500">Loading knowledge base...</p>
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50 p-6 space-y-2">
          <HelpCircle className="w-8 h-8 text-stone-400 mx-auto" />
          <p className="text-xs font-semibold text-zinc-900">No matching questions found</p>
          <p className="text-xs text-stone-500">
            Can't find what you are looking for? Submit an issue to our support team.
          </p>
          <div className="pt-2">
            <Link
              to={ROUTES.REPORT_ISSUE}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Report an Issue <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => {
            const isOpen = !!openIds[faq.id];
            return (
              <div
                key={faq.id}
                className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs transition-all"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-stone-50/50 transition-colors"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      {faq.category}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-900 pt-0.5">
                      {faq.question}
                    </h3>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-stone-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-stone-100 text-xs text-stone-600 leading-relaxed bg-stone-50/30">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default HelpCenterPage;
