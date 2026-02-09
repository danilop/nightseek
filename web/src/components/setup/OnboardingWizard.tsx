import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useApp } from '@/stores/AppContext';
import InstallPrompt from './InstallPrompt';
import QuickTour from './QuickTour';
import Setup from './Setup';
import TelescopeSetup from './TelescopeSetup';

type OnboardingStep = 'location' | 'telescope' | 'tour' | 'install';

interface StepLabel {
  key: OnboardingStep;
  label: string;
}

const BASE_STEPS: StepLabel[] = [
  { key: 'location', label: 'Location' },
  { key: 'telescope', label: 'Telescope' },
  { key: 'tour', label: 'Welcome' },
];

export default function OnboardingWizard() {
  const { completeSetup } = useApp();
  const [step, setStep] = useState<OnboardingStep>('location');
  const { canInstall, isIOS } = useInstallPrompt();

  const isOnboarded = localStorage.getItem('nightseek:onboarded') === 'true';
  const showInstall = canInstall || isIOS;

  const steps = useMemo<StepLabel[]>(
    () => (showInstall ? [...BASE_STEPS, { key: 'install', label: 'Install' }] : BASE_STEPS),
    [showInstall]
  );

  const stepIndex = steps.findIndex(s => s.key === step);

  const handleLocationSet = () => {
    if (isOnboarded) {
      completeSetup();
      return;
    }
    setStep('telescope');
  };

  const handleTelescopeComplete = () => {
    setStep('tour');
  };

  const handleTourComplete = () => {
    if (showInstall) {
      setStep('install');
    } else {
      finishOnboarding();
    }
  };

  const handleInstallComplete = () => {
    finishOnboarding();
  };

  const finishOnboarding = () => {
    localStorage.setItem('nightseek:onboarded', 'true');
    completeSetup();
  };

  return (
    <div>
      {/* Labeled stepper */}
      {!isOnboarded && (
        <div className="flex items-center justify-center gap-1 px-4 pt-6">
          {steps.map((s, i) => {
            const isCompleted = i < stepIndex;
            const isActive = i === stepIndex;
            return (
              <div key={s.key} className="flex items-center">
                {i > 0 && (
                  <div className={`mx-1 h-px w-6 ${isCompleted ? 'bg-sky-500' : 'bg-night-600'}`} />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs transition-colors ${
                      isCompleted
                        ? 'bg-sky-500 text-white'
                        : isActive
                          ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500'
                          : 'bg-night-700 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span
                    className={`hidden text-xs sm:inline ${
                      isActive ? 'font-medium text-white' : 'text-gray-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {step === 'location' && <Setup onLocationSet={handleLocationSet} />}
      {step === 'telescope' && <TelescopeSetup onComplete={handleTelescopeComplete} />}
      {step === 'tour' && <QuickTour onComplete={handleTourComplete} />}
      {step === 'install' && <InstallPrompt onComplete={handleInstallComplete} />}
    </div>
  );
}
