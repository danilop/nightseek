import { Calendar, CircleDot, Eye, MapPin, X } from 'lucide-react';
import { useApp } from '@/stores/AppContext';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { state, updateSettings, dispatch } = useApp();
  const { settings, location } = state;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-night-900 rounded-xl shadow-xl w-full max-w-md border border-night-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-night-700">
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
        <div className="p-4 space-y-6">
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-night-700">
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
