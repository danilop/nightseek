import {
  Calendar,
  CircleDot,
  Download,
  Eye,
  MapPin,
  MessageCircle,
  Ruler,
  Satellite,
  Share,
  Thermometer,
  Trash2,
  Wind,
  X,
} from 'lucide-react';
import { useState } from 'react';
import AppFooter from '@/components/ui/AppFooter';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useApp } from '@/stores/AppContext';
import type { DistanceUnit, PressureUnit, SpeedUnit, TemperatureUnit } from '@/types';
import TelescopeSettings from './TelescopeSettings';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { state, updateSettings, resetAllData, dispatch } = useApp();
  const { settings, location } = state;
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { canInstall, isIOS, triggerInstall } = useInstallPrompt();

  // Lock body scroll when modal is open
  useBodyScrollLock();

  const handleForecastDaysChange = (value: number) => {
    updateSettings({ forecastDays: Math.max(1, Math.min(30, value)) });
    dispatch({ type: 'CLEAR_FORECAST' });
  };

  const handleMaxObjectsChange = (value: number) => {
    updateSettings({ maxObjects: Math.max(1, Math.min(50, value)) });
    dispatch({ type: 'CLEAR_FORECAST' });
  };

  const handleDsoMagnitudeChange = (value: number) => {
    updateSettings({ dsoMagnitude: Math.max(6, Math.min(18, value)) });
    dispatch({ type: 'CLEAR_FORECAST' });
  };

  const handleChangeLocation = () => {
    dispatch({ type: 'SET_SETUP_COMPLETE', payload: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl border border-night-700 bg-night-900 shadow-xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-night-700 border-b p-4">
          <h2 className="font-semibold text-lg text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Location */}
          {location && (
            <div>
              <div className="mb-2 flex items-center gap-2 font-medium text-gray-300 text-sm">
                <MapPin className="h-4 w-4" />
                <span>Location</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-night-800 p-3">
                <span className="truncate text-gray-400 text-sm">
                  {location.name ||
                    `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </span>
                <button
                  type="button"
                  onClick={handleChangeLocation}
                  className="text-sky-400 text-sm transition-colors hover:text-sky-300"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {/* Forecast Days */}
          <div>
            <label
              htmlFor="forecast-days"
              className="mb-2 flex items-center gap-2 font-medium text-gray-300 text-sm"
            >
              <Calendar className="h-4 w-4" />
              Forecast Days
            </label>
            <div className="flex items-center gap-4">
              <input
                id="forecast-days"
                type="range"
                min="1"
                max="30"
                value={settings.forecastDays}
                onChange={e => handleForecastDaysChange(parseInt(e.target.value, 10))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-night-700 accent-sky-500"
              />
              <span className="w-12 rounded-lg bg-night-800 py-1 text-center text-sm text-white">
                {settings.forecastDays}
              </span>
            </div>
            <p className="mt-1 text-gray-500 text-xs">Weather data available for up to 16 days</p>
          </div>

          {/* Max Objects */}
          <div>
            <label
              htmlFor="max-objects"
              className="mb-2 flex items-center gap-2 font-medium text-gray-300 text-sm"
            >
              <Eye className="h-4 w-4" />
              Objects Per Night
            </label>
            <div className="flex items-center gap-4">
              <input
                id="max-objects"
                type="range"
                min="1"
                max="50"
                value={settings.maxObjects}
                onChange={e => handleMaxObjectsChange(parseInt(e.target.value, 10))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-night-700 accent-sky-500"
              />
              <span className="w-12 rounded-lg bg-night-800 py-1 text-center text-sm text-white">
                {settings.maxObjects}
              </span>
            </div>
          </div>

          {/* DSO Magnitude Limit */}
          <div>
            <label
              htmlFor="dso-magnitude"
              className="mb-2 flex items-center gap-2 font-medium text-gray-300 text-sm"
            >
              <CircleDot className="h-4 w-4" />
              DSO Magnitude Limit
            </label>
            <div className="flex items-center gap-4">
              <input
                id="dso-magnitude"
                type="range"
                min="6"
                max="18"
                step="0.5"
                value={settings.dsoMagnitude}
                onChange={e => handleDsoMagnitudeChange(parseFloat(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-night-700 accent-sky-500"
              />
              <span className="w-12 rounded-lg bg-night-800 py-1 text-center text-sm text-white">
                {settings.dsoMagnitude.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-gray-500 text-xs">Lower values show brighter objects only</p>
          </div>

          {/* Units Section */}
          <div className="border-night-700 border-t pt-4">
            <h3 className="mb-4 flex items-center gap-2 font-medium text-gray-300 text-sm">
              <Ruler className="h-4 w-4" />
              Units
            </h3>

            {/* Temperature Unit */}
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-gray-400 text-sm">
                <Thermometer className="h-4 w-4" />
                <span>Temperature</span>
              </div>
              <div className="flex gap-2">
                <UnitButton
                  active={settings.units.temperature === 'celsius'}
                  onClick={() =>
                    updateSettings({ units: { ...settings.units, temperature: 'celsius' } })
                  }
                  label="°C"
                />
                <UnitButton
                  active={settings.units.temperature === 'fahrenheit'}
                  onClick={() =>
                    updateSettings({
                      units: { ...settings.units, temperature: 'fahrenheit' as TemperatureUnit },
                    })
                  }
                  label="°F"
                />
              </div>
            </div>

            {/* Speed Unit */}
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-gray-400 text-sm">
                <Wind className="h-4 w-4" />
                <span>Wind Speed</span>
              </div>
              <div className="flex gap-2">
                <UnitButton
                  active={settings.units.speed === 'kmh'}
                  onClick={() =>
                    updateSettings({ units: { ...settings.units, speed: 'kmh' as SpeedUnit } })
                  }
                  label="km/h"
                />
                <UnitButton
                  active={settings.units.speed === 'mph'}
                  onClick={() =>
                    updateSettings({ units: { ...settings.units, speed: 'mph' as SpeedUnit } })
                  }
                  label="mph"
                />
              </div>
            </div>

            {/* Pressure Unit */}
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-gray-400 text-sm">
                <CircleDot className="h-4 w-4" />
                <span>Pressure</span>
              </div>
              <div className="flex gap-2">
                <UnitButton
                  active={settings.units.pressure === 'hpa'}
                  onClick={() =>
                    updateSettings({
                      units: { ...settings.units, pressure: 'hpa' as PressureUnit },
                    })
                  }
                  label="hPa"
                />
                <UnitButton
                  active={settings.units.pressure === 'inhg'}
                  onClick={() =>
                    updateSettings({
                      units: { ...settings.units, pressure: 'inhg' as PressureUnit },
                    })
                  }
                  label="inHg"
                />
              </div>
            </div>

            {/* Distance Unit */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-gray-400 text-sm">
                <Ruler className="h-4 w-4" />
                <span>Distance</span>
              </div>
              <div className="flex gap-2">
                <UnitButton
                  active={settings.units.distance === 'km'}
                  onClick={() =>
                    updateSettings({ units: { ...settings.units, distance: 'km' as DistanceUnit } })
                  }
                  label="km"
                />
                <UnitButton
                  active={settings.units.distance === 'mi'}
                  onClick={() =>
                    updateSettings({ units: { ...settings.units, distance: 'mi' as DistanceUnit } })
                  }
                  label="mi"
                />
              </div>
            </div>
          </div>

          {/* Telescope Section */}
          <div className="border-night-700 border-t pt-4">
            <TelescopeSettings
              telescope={settings.telescope}
              customFOV={settings.customFOV}
              onUpdate={updateSettings}
            />
          </div>

          {/* Satellite Passes Section */}
          <div className="border-night-700 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-gray-300 text-sm">
                <Satellite className="h-4 w-4" />
                <span>Satellite Passes</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSettings({ showSatellitePasses: !settings.showSatellitePasses })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.showSatellitePasses ? 'bg-sky-600' : 'bg-night-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.showSatellitePasses ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-gray-500 text-xs">
              Show ISS and satellite pass predictions in the forecast
            </p>
          </div>

          {/* Install App Section */}
          {(canInstall || isIOS) && (
            <div className="border-night-700 border-t pt-4">
              <div className="flex items-center gap-2 font-medium text-gray-300 text-sm">
                <Download className="h-4 w-4" />
                <span>Install App</span>
              </div>
              {isIOS ? (
                <p className="mt-2 text-gray-400 text-sm">
                  Tap <Share className="inline h-3.5 w-3.5 text-sky-400" /> Share in Safari, then
                  "Add to Home Screen"
                </p>
              ) : (
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="mt-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-sky-500"
                >
                  Install
                </button>
              )}
              <p className="mt-2 text-gray-500 text-xs">
                Install NightSeek for quick access from your home screen
              </p>
            </div>
          )}

          {/* Feedback Section */}
          <div className="border-night-700 border-t pt-4">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSddv3zfYI43vXdYqwoer2m6qAyLTE6LIf4e_FET_lBYcitftw/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-between rounded-lg bg-night-800 p-3 transition-colors hover:bg-night-700"
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-300 text-sm">Send Feedback</span>
              </div>
              <span className="text-gray-500 text-xs">Bugs, features &amp; suggestions</span>
            </a>
          </div>

          {/* Reset Section */}
          <div className="border-night-700 border-t pt-4">
            <h3 className="mb-3 font-medium text-gray-300 text-sm">Reset</h3>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="group flex w-full items-center justify-between rounded-lg bg-night-800 p-3 transition-colors hover:bg-red-500/10"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-gray-400 group-hover:text-red-400" />
                <span className="text-gray-300 text-sm group-hover:text-red-400">
                  Reset All Data
                </span>
              </div>
              <span className="text-gray-500 text-xs">Settings, cache &amp; location</span>
            </button>
          </div>

          {/* About footer */}
          <AppFooter className="pt-6" />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-night-700 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-sky-600 py-2 font-medium text-white transition-colors hover:bg-sky-500"
          >
            Done
          </button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-xl border border-night-600 bg-night-800 p-5 shadow-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="font-semibold text-lg text-white">Reset All Data?</h3>
            </div>
            <p className="mb-5 text-gray-400 text-sm">
              This will reset all settings to defaults, clear cached forecasts, and return to the
              location setup screen.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-lg bg-night-700 py-2.5 font-medium text-gray-300 text-sm transition-colors hover:bg-night-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAllData();
                  onClose();
                }}
                className="flex-1 rounded-lg bg-red-600 py-2.5 font-medium text-sm text-white transition-colors hover:bg-red-500"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
        active
          ? 'bg-sky-600 text-white'
          : 'bg-night-800 text-gray-400 hover:bg-night-700 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
