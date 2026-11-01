import SharedSkyChart, { type SkyChartProps } from '@/components/forecast/SkyChart.shared';
export default function SkyChart(props: SkyChartProps) {
  return <SharedSkyChart {...props} bundledAssets />;
}
