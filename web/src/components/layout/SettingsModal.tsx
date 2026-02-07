import {
  Calendar,
  CircleDot,
  Eye,
  MapPin,
  Ruler,
  Satellite,
  Thermometer,
  Trash2,
  Wind,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-hidden">
      <div className="bg-night-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col border border-night-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-night-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {/* Location */}
          {location && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <MapPin className="w-4 h-4" />
                <span>Location</span>
              </div>
              <div className="flex items-center justify-between bg-night-800 rounded-lg p-3">
                <span className="text-sm text-gray-400 truncate">
                  {location.name ||
                    `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </span>
                <button
                  type="button"
                  onClick={handleChangeLocation}
                  className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
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
              className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"
            >
              <Calendar className="w-4 h-4" />
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
                className="flex-1 h-2 bg-night-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <span className="w-12 text-center text-sm text-white bg-night-800 rounded-lg py-1">
                {settings.forecastDays}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Weather data available for up to 16 days</p>
          </div>

          {/* Max Objects */}
          <div>
            <label
              htmlFor="max-objects"
              className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"
            >
              <Eye className="w-4 h-4" />
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
                className="flex-1 h-2 bg-night-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <span className="w-12 text-center text-sm text-white bg-night-800 rounded-lg py-1">
                {settings.maxObjects}
              </span>
            </div>
          </div>

          {/* DSO Magnitude Limit */}
          <div>
            <label
              htmlFor="dso-magnitude"
              className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"
            >
              <CircleDot className="w-4 h-4" />
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
                className="flex-1 h-2 bg-night-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <span className="w-12 text-center text-sm text-white bg-night-800 rounded-lg py-1">
                {settings.dsoMagnitude.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Lower values show brighter objects only</p>
          </div>

          {/* Units Section */}
          <div className="pt-4 border-t border-night-700">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Units
            </h3>

            {/* Temperature Unit */}
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Thermometer className="w-4 h-4" />
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
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Wind className="w-4 h-4" />
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
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <CircleDot className="w-4 h-4" />
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
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Ruler className="w-4 h-4" />
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
          <div className="pt-4 border-t border-night-700">
            <TelescopeSettings
              telescope={settings.telescope}
              customFOV={settings.customFOV}
              onUpdate={updateSettings}
            />
          </div>

          {/* Satellite Passes Section */}
          <div className="pt-4 border-t border-night-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Satellite className="w-4 h-4" />
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
            <p className="text-xs text-gray-500 mt-2">
              Show ISS and satellite pass predictions in the forecast
            </p>
          </div>

          {/* Reset Section */}
          <div className="pt-4 border-t border-night-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Reset</h3>

            {showResetConfirm ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400 mb-3">
                  This will reset all settings to defaults, clear cached forecasts, and return to
                  the location setup screen. Are you sure?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetAllData();
                      onClose();
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Yes, Reset Everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2 bg-night-700 hover:bg-night-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="w-full flex items-center justify-between p-3 bg-night-800 hover:bg-red-500/10 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
                  <span className="text-sm text-gray-300 group-hover:text-red-400">
                    Reset All Data
                  </span>
                </div>
                <span className="text-xs text-gray-500">Settings, cache &amp; location</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-night-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
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
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-sky-600 text-white'
          : 'bg-night-800 text-gray-400 hover:bg-night-700 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
