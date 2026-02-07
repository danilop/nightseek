import { useState } from 'react';
import { useApp } from '@/stores/AppContext';
import QuickTour from './QuickTour';
import Setup from './Setup';
import TelescopeSetup from './TelescopeSetup';

type OnboardingStep = 'location' | 'telescope' | 'tour';

const STEPS: OnboardingStep[] = ['location', 'telescope', 'tour'];

export default function OnboardingWizard() {
  const { completeSetup } = useApp();
  const [step, setStep] = useState<OnboardingStep>('location');

  const isOnboarded = localStorage.getItem('nightseek:onboarded') === 'true';

  const handleLocationSet = () => {
    if (isOnboarded) {
      // Returning user changing location from Settings — skip telescope/tour
      completeSetup();
      return;
    }
    setStep('telescope');
  };

  const handleTelescopeComplete = () => {
    setStep('tour');
  };

  const handleTourComplete = () => {
    localStorage.setItem('nightseek:onboarded', 'true');
    completeSetup();
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div>
      {/* Step dots */}
      {!isOnboarded && (
        <div className="flex items-center justify-center gap-2 pt-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-sky-500' : 'bg-night-600'
              }`}
            />
          ))}
        </div>
      )}

      {step === 'location' && <Setup onLocationSet={handleLocationSet} />}
      {step === 'telescope' && <TelescopeSetup onComplete={handleTelescopeComplete} />}
      {step === 'tour' && <QuickTour onComplete={handleTourComplete} />}
    </div>
  );
}
