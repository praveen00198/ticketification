import React from 'react';
import { CreditCard, Receipt, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes/paths';

export const PaymentHistoryPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Payment History</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-wider">
            Planned
          </span>
        </div>
        <p className="text-sm text-stone-500 mt-1">
          View your paid admission receipts, transaction reference IDs, and downloadable invoices.
        </p>
      </div>

      {/* Planned Feature Information Notice */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center border border-stone-200 shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900">
              Paid Admissions & Transaction Ledger
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Ticketification currently operates in zero-fee community admission mode. Payment gateway integration (Stripe / Razorpay) and transaction ledgering are scheduled in the upcoming platform phases.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-stone-100">
          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2 text-stone-700 font-semibold text-xs">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Direct Invoicing</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Automated PDF tax invoices and itemized receipts for registration fees and corporate passes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2 text-stone-700 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>PCI Compliance</span>
            </div>
            <p className="text-[11px] text-stone-500">
              End-to-end tokenized processing without storing raw card data on Ticketification servers.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2 text-stone-700 font-semibold text-xs">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Instant Reconciliation</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Webhook-driven credential issuance upon cryptographic payment confirmation.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-stone-500">
            Currently registered for free community events? View your active tickets in your wallet.
          </div>
          <Link
            to={ROUTES.WALLET}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Go to My Passes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
export default PaymentHistoryPage;
