import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    fontSize: 12,
    boxShadow: "var(--shadow-card)",
  },
  itemStyle: {
    color: "var(--foreground)",
  },
};

/** Charts render only after mount so SSR output and client stay in sync. */
function ChartFrame({ height, children }: { height: number; children: React.ReactElement }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ height }} className="animate-pulse rounded-lg bg-muted/60" />;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function TrendAreaChart({
  data,
  dataKey,
  color = "var(--primary)",
  height = 280,
  valueFormatter,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  color?: string;
  height?: number;
  valueFormatter?: ((v: number) => string) | undefined;
}) {
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...axis} width={48} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${dataKey})`}
        />
      </AreaChart>
    </ChartFrame>
  );
}

export function MultiLineChart({
  data,
  series,
  height = 280,
}: {
  data: Record<string, unknown>[];
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...axis} width={48} />
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

export function HorizontalBarChart({
  data,
  dataKey,
  categoryKey = "name",
  color = "var(--teal)",
  height = 300,
  valueFormatter,
  yAxisWidth = 85,
  showLabels = false,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  categoryKey?: string;
  color?: string;
  height?: number;
  valueFormatter?: ((v: number) => string) | undefined;
  yAxisWidth?: number;
  showLabels?: boolean;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: showLabels ? 64 : 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          {...axis}
          tickFormatter={(v: number) => {
            if (!valueFormatter) return v.toLocaleString("en-IN");
            if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
            if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
            return `₹${v}`;
          }}
        />
        <YAxis type="category" dataKey={categoryKey} {...axis} width={yAxisWidth} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => [
            valueFormatter ? valueFormatter(v) : v.toLocaleString("en-IN"),
            "",
          ]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 6, 6, 0]} barSize={16}>
          {showLabels && (
            <LabelList
              dataKey={dataKey}
              position="right"
              formatter={(v: number) =>
                valueFormatter ? valueFormatter(v) : v.toLocaleString("en-IN")
              }
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
            />
          )}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

const donutColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function DonutChart({
  data,
  dataKey = "value",
  height = 280,
  valueFormatter,
}: {
  data: { name: string; value: number }[];
  dataKey?: string;
  height?: number;
  valueFormatter?: ((v: number) => string) | undefined;
}) {
  return (
    <ChartFrame height={height}>
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey="name"
          cx="50%"
          cy="44%"
          innerRadius="52%"
          outerRadius="78%"
          paddingAngle={3}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={donutColors[i % donutColors.length]} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)}
        />
        <Legend
          iconType="circle"
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
      </PieChart>
    </ChartFrame>
  );
}
