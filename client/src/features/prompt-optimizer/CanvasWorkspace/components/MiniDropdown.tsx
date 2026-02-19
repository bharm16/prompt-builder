import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';

interface MiniDropdownProps<T extends string | number> {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  icon?: React.ReactNode;
  formatLabel?: (value: T) => string;
}

export function MiniDropdown<T extends string | number>({
  value,
  options,
  onChange,
  icon,
  formatLabel,
}: MiniDropdownProps<T>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = formatLabel ? formatLabel(value) : String(value);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen((prev) => !prev);
    },
    []
  );

  const handleSelect = useCallback(
    (opt: T) => {
      onChange(opt);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'inline-flex h-[30px] items-center gap-[6px] whitespace-nowrap rounded-lg border-none px-2.5 text-[11px] font-medium transition-colors',
          open
            ? 'bg-[rgba(255,255,255,0.03)] text-[#8B92A5]'
            : 'bg-transparent text-[#555B6E] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#8B92A5]'
        )}
      >
        {icon}
        {label}
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="-ml-0.5 opacity-50"
        >
          <path d="M2 3L4 5L6 3" />
        </svg>
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[80px] overflow-hidden rounded-[10px] bg-[#1A1C22] shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
          {options.map((opt) => {
            const optLabel = formatLabel ? formatLabel(opt) : String(opt);
            const isActive = opt === value;
            return (
              <button
                key={String(opt)}
                type="button"
                onClick={() => handleSelect(opt)}
                className={cn(
                  'flex w-full items-center px-3 py-[7px] text-[11px] transition-colors',
                  isActive
                    ? 'bg-[rgba(255,255,255,0.06)] font-semibold text-[#E2E6EF]'
                    : 'bg-transparent font-normal text-[#8B92A5] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#E2E6EF]'
                )}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
