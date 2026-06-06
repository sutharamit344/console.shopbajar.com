import React from "react";
import type { LucideIcon } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helpText?: string;
  icon?: LucideIcon;
  prefix?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  name,
  placeholder,
  value,
  onChange,
  type = "text",
  required = false,
  helpText,
  icon: Icon,
  prefix,
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
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={`w-full h-10 px-3.5 rounded-md border bg-white text-[13.5px] font-medium text-[#0A0A0F] placeholder:text-[#0A0A0F]/20 transition-all outline-none shadow-sm
            dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-800 dark:placeholder:text-zinc-700
            ${error
              ? "border-red-500/50 focus:ring-2 focus:ring-red-500/5"
              : "border-black/[0.08] focus:border-[#FF6A00]/40 focus:ring-2 focus:ring-[#FF6A00]/5"
            } 
            ${(Icon || prefix) ? "pl-10" : ""}`}
          {...props}
        />
        {Icon && !prefix && (
          <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${error ? "text-red-500" : "text-[#0A0A0F]/20 dark:text-zinc-700 group-focus-within:text-[#FF6A00] dark:group-focus-within:text-[#FF6A00]"}`}>
            <Icon size={15} />
          </div>
        )}
        {prefix && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#0A0A0F]/30 dark:text-zinc-600 group-focus-within:text-[#FF6A00] dark:group-focus-within:text-[#FF6A00] transition-colors border-r border-black/[0.03] dark:border-zinc-800/50 pr-2.5 h-4 flex items-center">
            {prefix}
          </div>
        )}
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

export default Input;
