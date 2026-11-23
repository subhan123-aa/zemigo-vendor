import React from 'react';
import {
  ArrowUpTrendIcon,
  type IconProps,
} from '@/components/icons/VendorIcons';

interface VendorKpiCardProps {
  title: string;
  value: string;
  growthPercent: number | null;
  Icon: React.FC<IconProps>;
  loading?: boolean;
}

export const VendorKpiCard: React.FC<VendorKpiCardProps> = ({
  title,
  value,
  growthPercent,
  Icon,
  loading = false,
}) => {
  const isPositive = growthPercent !== null && growthPercent >= 0;

  return (
    <div className="rounded-[18px] border border-[#ECEEF2] bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#E8F8EE] text-[#16A34A]">
          <Icon className="h-[25px] w-[25px]" />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[14px] font-semibold text-[#1F2937]">{title}</p>

          {loading ? (
            <div className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-[#F1F3F6]" />
          ) : (
            <p className="mt-1 truncate text-[26px] font-extrabold leading-tight tracking-tight text-[#111827] sm:text-[28px]">
              {value}
            </p>
          )}

          {!loading && growthPercent !== null && (
            <div
              className={[
                'mt-2 inline-flex items-center gap-1 text-[13.5px] font-semibold',
                isPositive ? 'text-[#16A34A]' : 'text-[#DC2626]',
              ].join(' ')}
            >
              <ArrowUpTrendIcon
                className={[
                  'h-3.5 w-3.5',
                  isPositive ? '' : 'rotate-180',
                ].join(' ')}
              />
              <span>
                {isPositive ? '+' : ''}
                {growthPercent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
