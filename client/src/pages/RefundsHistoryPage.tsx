import { RotateCcw, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes/paths';

export const RefundsHistoryPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Refunds History & Status</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-wider">
            Planned
          </span>
        </div>
        <p className="text-sm text-stone-500 mt-1">
          Monitor submitted refund requests, review organizer refund policies, and track reversal timelines.
        </p>
      </div>

      {/* Planned Feature Information Notice */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center border border-stone-200 shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900">
              Automated Refund Processing
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Refund request workflows and gateway reversions will activate alongside paid ticket tier capabilities. When enabled, attendees will be able to file refund claims directly against eligible tickets within organizer cancellation windows.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-stone-100">
          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2 text-stone-700 font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Host Policy Alignment</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Refund windows determined automatically by event organizer cancellation policies.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2 text-stone-700 font-semibold text-xs">
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Automated Reversal</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Approved refunds credited directly back to the original funding instrument within 5-7 banking days.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2 text-stone-700 font-semibold text-xs">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              <span>Dispute Escalation</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Platform mediation available if an event is cancelled or postponed without host notification.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-stone-500">
            Need to cancel a free registration today? You can do so directly from My Registrations.
          </div>
          <Link
            to={ROUTES.REGISTRATIONS}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Manage Registrations <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
export default RefundsHistoryPage;
