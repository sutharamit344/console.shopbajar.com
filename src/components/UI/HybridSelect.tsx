import React from "react";
import Select from "./Select";
import Input from "./Input";
import { X } from "lucide-react";

interface HybridSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface HybridSelectProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: { target: { name: string; value: string } }) => void;
  options: HybridSelectOption[];
  showInput: boolean;
  onToggleInput: (show: boolean) => void;
  inputValue: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputName: string;
  inputPlaceholder?: string;
  inputHelpText?: string;
  helpText?: string;
  required?: boolean;
  error?: string;
}

const HybridSelect: React.FC<HybridSelectProps> = ({
  label,
  name,
  value,
  onChange,
  options,
  showInput,
  onToggleInput,
  inputValue,
  onInputChange,
  inputName,
  inputPlaceholder,
  inputHelpText,
  helpText,
  required = false,
  error
}) => {
  if (showInput) {
    return (
      <div className="relative animate-in zoom-in-95 duration-200">
        <Input
          label={label}
          name={inputName}
          value={inputValue}
          onChange={onInputChange}
          placeholder={inputPlaceholder}
          helpText={inputHelpText}
          required={required}
          error={error}
        />
        <button
          type="button"
          onClick={() => {
            onToggleInput(false);
            onChange({ target: { name, value: "" } });
          }}
          className="absolute right-3 top-[34px] p-1.5 rounded-md bg-gray-50 dark:bg-zinc-800 text-gray-400 hover:text-[#FF6A00] hover:bg-[#FF6A00]/10 transition-all border border-transparent hover:border-[#FF6A00]/20 z-10"
          title="Back to dropdown"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <Select
      label={label}
      name={name}
      value={value}
      onChange={(e) => {
        if (e.target.value === "CUSTOM" || e.target.value === "OTHER_PROPOSE") {
          onChange(e);
          onToggleInput(true);
        } else {
          onChange(e);
        }
      }}
      options={options}
      required={required}
      helpText={helpText}
      error={error}
    />
  );
};

export default HybridSelect;
