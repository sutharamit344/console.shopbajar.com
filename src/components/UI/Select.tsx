import React from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helpText?: string;
  error?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  name,
  value,
  onChange,
  options = [],
  required = false,
  helpText,
  error,
  className = "",
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label className="text-[11px] font-bold text-[#0A0A0F]/30 dark:text-zinc-500 uppercase tracking-[0.1em] px-1">
          {label} {required && <span className="text-[#FF6A00] opacity-50">*</span>}
        </label>
      )}
      <div className="relative group">
        <select
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className={`w-full h-10 pl-3.5 pr-10 rounded-md border bg-white dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-800 text-[13.5px] font-medium text-[#0A0A0F] transition-all outline-none appearance-none cursor-pointer shadow-sm
            ${error
              ? "border-red-500/50 focus:ring-2 focus:ring-red-500/5"
              : "border-black/[0.08] dark:border-zinc-800 focus:border-[#FF6A00]/40 focus:ring-2 focus:ring-[#FF6A00]/5"
            }`}
          {...props}
        >
          {options.map((opt, i) => (
            <option key={`${opt.value}-${i}`} value={opt.value} disabled={opt.disabled} className="text-[#0A0A0F] dark:text-zinc-100 py-2 bg-white dark:bg-zinc-900">
              {opt.label}
            </option>
          ))}
        </select>
        <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${error ? "text-red-500" : "text-[#0A0A0F]/20 dark:text-zinc-650 group-focus-within:text-[#FF6A00]"}`}>
          <ChevronDown size={14} />
        </div>
      </div>
      {(error || helpText) && (
        <p className={`text-[10px] font-semibold px-1 tracking-tight ${error ? "text-red-500 flex items-center gap-1" : "text-[#0A0A0F]/30 dark:text-zinc-600 uppercase tracking-[0.05em]"}`}>
          {error && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {error || helpText}
        </p>
      )}
    </div>
  );
};

export default Select;
