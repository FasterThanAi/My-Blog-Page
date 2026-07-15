"use client";

import * as React from "react";

interface ChartPoint {
  date: string;
  signups: number;
  posts: number;
}

interface AnalyticsChartProps {
  chartData: ChartPoint[];
}

export function AnalyticsChart({ chartData }: AnalyticsChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center border border-border/60 rounded-16 bg-surface text-muted text-13">
        No analytical data available
      </div>
    );
  }

  // Calculate coordinates
  const width = 600;
  const height = 220;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 24;
  const paddingBottom = 24;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...chartData.map((d) => Math.max(d.signups, d.posts)),
    5
  );

  const getCoords = (val: number, idx: number) => {
    const x = paddingLeft + (idx / (chartData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
    return { x, y };
  };

  // Build SVG Paths
  let signupPath = "";
  let signupArea = "";
  let postsPath = "";
  let postsArea = "";

  chartData.forEach((d, i) => {
    const signupCoords = getCoords(d.signups, i);
    const postsCoords = getCoords(d.posts, i);

    if (i === 0) {
      signupPath = `M ${signupCoords.x} ${signupCoords.y}`;
      signupArea = `M ${signupCoords.x} ${paddingTop + chartHeight} L ${signupCoords.x} ${signupCoords.y}`;
      postsPath = `M ${postsCoords.x} ${postsCoords.y}`;
      postsArea = `M ${postsCoords.x} ${paddingTop + chartHeight} L ${postsCoords.x} ${postsCoords.y}`;
    } else {
      signupPath += ` L ${signupCoords.x} ${signupCoords.y}`;
      signupArea += ` L ${signupCoords.x} ${signupCoords.y}`;
      postsPath += ` L ${postsCoords.x} ${postsCoords.y}`;
      postsArea += ` L ${postsCoords.x} ${postsCoords.y}`;
    }

    if (i === chartData.length - 1) {
      signupArea += ` L ${signupCoords.x} ${paddingTop + chartHeight} Z`;
      postsArea += ` L ${postsCoords.x} ${paddingTop + chartHeight} Z`;
    }
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Scale local mouseX back into the SVG viewbox coord space
    const svgMouseX = (mouseX / rect.width) * width;
    
    // Calculate closest index
    const relativeX = svgMouseX - paddingLeft;
    let idx = Math.round((relativeX / chartWidth) * (chartData.length - 1));
    idx = Math.max(0, Math.min(chartData.length - 1, idx));

    setHoveredIdx(idx);
    
    // Calculate tooltip position (approx center-top of point)
    const activeCoords = getCoords(
      Math.max(chartData[idx].signups, chartData[idx].posts),
      idx
    );

    // Compute screen pos for floating tooltip
    const tooltipX = (activeCoords.x / width) * rect.width;
    const tooltipY = ((activeCoords.y - 12) / height) * rect.height;

    setTooltipPos({ x: tooltipX, y: tooltipY });
  };

  const activePoint = hoveredIdx !== null ? chartData[hoveredIdx] : null;
  const signupActiveCoords = hoveredIdx !== null ? getCoords(chartData[hoveredIdx].signups, hoveredIdx) : null;
  const postsActiveCoords = hoveredIdx !== null ? getCoords(chartData[hoveredIdx].posts, hoveredIdx) : null;

  // Format date readable
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + chartHeight * ratio;
          const valLabel = Math.round(maxVal * (1 - ratio));
          return (
            <g key={ratio} className="opacity-40">
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted font-mono text-[9px]"
              >
                {valLabel}
              </text>
            </g>
          );
        })}

        {/* Areas */}
        <path d={signupArea} fill="rgba(10, 132, 255, 0.04)" />
        <path d={postsArea} fill="rgba(107, 107, 112, 0.04)" />

        {/* Lines */}
        <path
          d={postsPath}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-70"
        />
        <path
          d={signupPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover elements */}
        {hoveredIdx !== null && signupActiveCoords && postsActiveCoords && (
          <>
            <line
              x1={signupActiveCoords.x}
              y1={paddingTop}
              x2={signupActiveCoords.x}
              y2={paddingTop + chartHeight}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            {/* Posts point */}
            <circle
              cx={postsActiveCoords.x}
              cy={postsActiveCoords.y}
              r="4.5"
              fill="var(--raised)"
              stroke="var(--muted)"
              strokeWidth="2"
            />
            {/* Signups point */}
            <circle
              cx={signupActiveCoords.x}
              cy={signupActiveCoords.y}
              r="4.5"
              fill="var(--raised)"
              stroke="var(--accent)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {/* Floating Tooltip Card */}
      {hoveredIdx !== null && activePoint && (
        <div
          className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-surface border border-border p-2.5 rounded-12 shadow-lg flex flex-col gap-1 w-32 select-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <span className="text-[11px] font-semibold text-text border-b border-border/60 pb-1 mb-1">
            {formatDate(activePoint.date)}
          </span>
          <div className="flex justify-between items-center text-[11px]">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Signups
            </span>
            <span className="font-mono font-semibold text-text">{activePoint.signups}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-muted" />
              Posts
            </span>
            <span className="font-mono font-semibold text-text">{activePoint.posts}</span>
          </div>
        </div>
      )}
    </div>
  );
}
