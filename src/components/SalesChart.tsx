"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, num } from "@/lib/format";

type Point = { bucket: string; sales: number; profit: number; orders: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function bucketLabel(b: string, long = false) {
  const [y, m, d] = b.split("-");
  if (d) return long ? `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}` : `${Number(d)} ${MONTHS[Number(m) - 1]}`;
  if (m) return `${MONTHS[Number(m) - 1]} ${long ? y : y.slice(2)}`;
  return y;
}

const trim = (x: number) => String(Number(x.toFixed(1)));
const compact = (v: number) => (Math.abs(v) >= 100000 ? `${trim(v / 100000)}L` : Math.abs(v) >= 1000 ? `${trim(v / 1000)}k` : String(v));

/** Sales vs profit per period, on one shared ৳ axis. */
export function SalesChart({ data, height = 280 }: { data: Point[]; height?: number }) {
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-stone-600">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-series-1" /> Sales (after discount)</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-series-2" /> Gross profit</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barGap={2} barCategoryGap={data.length > 20 ? "15%" : "28%"} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#ecebe8" />
          <XAxis dataKey="bucket" tickFormatter={(b) => bucketLabel(b)} tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={{ stroke: "#d6d3d1" }} minTickGap={12} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            cursor={{ fill: "#f5f5f4" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="mb-1 font-semibold text-stone-900">{bucketLabel(p.bucket, true)}</p>
                  <p className="flex items-center gap-1.5 text-stone-700"><span className="size-2 rounded-sm bg-series-1" /> Sales <b className="ml-auto pl-4 tabular-nums">{money(p.sales)}</b></p>
                  <p className="flex items-center gap-1.5 text-stone-700"><span className="size-2 rounded-sm bg-series-2" /> Gross profit <b className="ml-auto pl-4 tabular-nums">{money(p.profit)}</b></p>
                  <p className="mt-1 text-stone-500">{num(p.orders)} orders</p>
                </div>
              );
            }}
          />
          <Bar isAnimationActive={false} dataKey="sales" fill="var(--color-series-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar isAnimationActive={false} dataKey="profit" fill="var(--color-series-2)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
