import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { closeModal, setInputValue } from "../redux/slices/modalSlice";
import { RootState } from "../redux/store";
import Dialog from "./UI/Dialog";
import { CircleAlert, CircleCheckBig, CircleHelp, Info } from "lucide-react";

const ModalContainer: React.FC = () => {
  const dispatch = useDispatch();
  const modal = useSelector((state: RootState) => state.modal);

  const handleClose = () => {
    dispatch(closeModal());
  };

  const getIcon = () => {
    switch (modal.type) {
      case "success": return CircleCheckBig;
      case "error": return CircleAlert;
      case "confirm": return CircleHelp;
      default: return Info;
    }
  };

  const getIconColor = () => {
    switch (modal.type) {
      case "success": return "text-green-500 bg-green-500/10 dark:bg-green-500/5";
      case "error": return "text-red-500 bg-red-500/10 dark:bg-red-500/5";
      case "confirm": return "text-[#FF6A00] bg-[#FF6A00]/10 dark:bg-[#FF6A00]/5";
      default: return "text-blue-500 bg-blue-550/10 dark:bg-blue-550/5";
    }
  };

  if (!modal.isOpen) return null;

  return (
    <Dialog
      isOpen={modal.isOpen}
      onClose={handleClose}
      title={modal.title}
      showClose={false}
    >
      <div className="space-y-6 py-2">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${getIconColor()}`}>
            {React.createElement(getIcon(), { size: 24 })}
          </div>
          <div className="space-y-1 flex-1">
            <p className="text-[14px] text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
              {modal.message}
            </p>
          </div>
        </div>

        {modal.showInput && (
          <div className="pt-2">
            <input
              type="text"
              value={modal.inputValue}
              onChange={(e) => dispatch(setInputValue(e.target.value))}
              className="w-full h-10 bg-zinc-50 dark:bg-zinc-950 border border-black/[0.06] dark:border-zinc-800 rounded-md px-3 text-[13.5px] font-medium outline-none focus:border-[#FF6A00]/40 transition-all text-zinc-900 dark:text-zinc-100"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  modal.onConfirm?.(modal.inputValue);
                  handleClose();
                }
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          {(modal.type === "confirm" || modal.type === "prompt") && (
            <button
              onClick={() => {
                modal.onCancel?.();
                handleClose();
              }}
              className="flex-1 h-10 rounded-md text-[13px] font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer border border-transparent dark:border-zinc-800"
            >
              {modal.cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (modal.onConfirm) {
                modal.onConfirm(modal.inputValue);
              }
              handleClose();
            }}
            className={`flex-1 h-10 rounded-md text-[13px] font-bold text-white transition-all active:scale-[0.98] shadow-md cursor-pointer ${
              modal.type === "error" ? "bg-red-500 hover:bg-red-600 shadow-red-500/10" :
              modal.type === "success" ? "bg-green-500 hover:bg-green-600 shadow-green-500/10" :
              "bg-[#FF6A00] hover:bg-[#E65F00] shadow-[#FF6A00]/10"
            }`}
          >
            {modal.confirmText}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ModalContainer;
