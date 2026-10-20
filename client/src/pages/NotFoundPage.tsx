import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home, Compass } from 'lucide-react';
import { Button } from '../components/ui';
import { ROUTES } from '../routes/paths';

interface NotFoundPageProps {
  isInsideDashboard?: boolean;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ isInsideDashboard = false }) => {
  const navigate = useNavigate();

  return (
    <div className={`flex items-center justify-center font-sans ${isInsideDashboard ? 'my-auto py-12' : 'min-h-screen bg-[#FAFAF9] px-4'}`}>
      <div className="max-w-md w-full bg-white border border-stone-200/90 rounded-3xl p-8 shadow-xl shadow-stone-900/5 text-center space-y-6">
        <div className="w-16 h-16 bg-stone-100 text-stone-700 rounded-3xl flex items-center justify-center mx-auto border border-stone-200 shadow-2xs">
          <FileQuestion className="w-8 h-8 stroke-[2]" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-stone-500 bg-stone-100 px-3 py-1 rounded-full border border-stone-200/80">
            404 • Not Found
          </span>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight pt-2">
            Page Not Found
          </h1>
          <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto">
            The link you followed does not exist, has been moved, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(-1)}
            iconLeft={<ArrowLeft className="w-3.5 h-3.5 text-stone-600" />}
            className="w-full sm:w-auto !rounded-full px-5 py-2.5"
          >
            Go Back
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(isInsideDashboard ? ROUTES.DASHBOARD : ROUTES.HOME)}
            iconLeft={<Home className="w-3.5 h-3.5 text-white" />}
            className="w-full sm:w-auto !rounded-full px-5 py-2.5"
          >
            {isInsideDashboard ? 'Dashboard' : 'Public Home'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.EXPLORE)}
            iconLeft={<Compass className="w-3.5 h-3.5 text-stone-500" />}
            className="w-full sm:w-auto !rounded-full px-4 py-2.5"
          >
            Explore Events
          </Button>
        </div>
      </div>
    </div>
  );
};
