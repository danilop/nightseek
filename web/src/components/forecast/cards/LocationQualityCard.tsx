import { BarChart3, Cloud, Droplets, Sun, Thermometer } from 'lucide-react';
import { useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import type { LocationWeatherHistory } from '@/lib/weather/open-meteo';
import { fetchHistoricalWeather } from '@/lib/weather/open-meteo';

interface LocationQualityCardProps {
  latitude: number;
  longitude: number;
}

export default function LocationQualityCard({ latitude, longitude }: LocationQualityCardProps) {
  const [data, setData] = useState<LocationWeatherHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setData(null);
    setLoading(true);

    fetchHistoricalWeather(latitude, longitude)
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        // Ignore historical lookup failures and keep the card hidden for this location.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, expanded]);

  const currentMonth = new Date().getMonth() + 1;
  const currentMonthStats = data?.monthlyStats.find(m => m.month === currentMonth);

  return (
    <SectionCard
      icon={<BarChart3 className="h-5 w-5 shrink-0 text-indigo-400" />}
      title="Daily cloud history"
      headerAside={
        <>
          {loading && <span className="text-gray-500 text-xs">Loading...</span>}
          {data && currentMonthStats && (
            <span className="hidden truncate text-gray-400 text-xs sm:block">
              ~{currentMonthStats.clearDays} mostly clear days in {currentMonthStats.monthName}
            </span>
          )}
        </>
      }
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-indigo-500 border-b-2" />
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <p className="text-gray-400 text-xs">
            Daily average cloud cover from the previous year. This is seasonal context, not a count
            of clear observing nights.
          </p>
          {/* Annual summary */}
          <div className="rounded-lg bg-night-800 p-3">
            <p className="mb-1 font-medium text-sm text-white">Annual Summary</p>
            <p className="text-gray-300 text-sm">
              This location averages{' '}
              <span className="font-medium text-indigo-400">
                {Math.round(data.annualClearDays)} mostly clear days
              </span>{' '}
              per year ({data.annualClearDayPercentage.toFixed(0)}% of days).
            </p>
          </div>

          {/* Best months */}
          {data.bestMonths.length > 0 && (
            <div>
              <p className="mb-2 text-gray-500 text-xs">Months with less cloud</p>
              <div className="space-y-2">
                {data.bestMonths.map(month => (
                  <div key={month.month} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{month.monthName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-indigo-400">{month.clearDays} mostly clear days</span>
                      <span className="text-gray-500 text-xs">
                        {month.clearDayPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly breakdown */}
          <div>
            <p className="mb-2 text-gray-500 text-xs">Monthly Breakdown</p>
            <div className="space-y-1">
              {data.monthlyStats.map(month => (
                <MonthRow
                  key={month.month}
                  month={month}
                  isCurrent={month.month === currentMonth}
                />
              ))}
            </div>
          </div>

          <p className="text-center text-gray-500 text-xs">
            Based on weather data from the past 12 months
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function MonthRow({
  month,
  isCurrent,
}: {
  month: LocationWeatherHistory['monthlyStats'][number];
  isCurrent: boolean;
}) {
  const barWidth = Math.max(2, month.clearDayPercentage);
  const barColor =
    month.clearDayPercentage >= 50
      ? 'bg-green-500'
      : month.clearDayPercentage >= 30
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${isCurrent ? 'bg-night-700' : ''}`}
    >
      <span className={`w-8 ${isCurrent ? 'font-medium text-white' : 'text-gray-400'}`}>
        {month.monthName.substring(0, 3)}
      </span>
      <div className="flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-night-700">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
      </div>
      <div className="flex w-24 items-center justify-end gap-1">
        <Sun className="h-3 w-3 text-gray-500" />
        <span className="text-gray-400">{month.clearDays}</span>
        <Cloud className="ml-1 h-3 w-3 text-gray-500" />
        <span className="text-gray-400">{month.avgCloudCover.toFixed(0)}%</span>
      </div>
      {month.avgTemperature !== null && (
        <div className="flex w-12 items-center justify-end gap-0.5">
          <Thermometer className="h-3 w-3 text-gray-500" />
          <span className="text-gray-400">{month.avgTemperature.toFixed(0)}&deg;</span>
        </div>
      )}
      {month.avgHumidity !== null && (
        <div className="flex w-12 items-center justify-end gap-0.5">
          <Droplets className="h-3 w-3 text-gray-500" />
          <span className="text-gray-400">{month.avgHumidity.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
