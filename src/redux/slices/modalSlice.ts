import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: "info" | "success" | "error" | "confirm" | "prompt";
  confirmText: string;
  cancelText: string;
  showInput: boolean;
  inputValue: string;
  onConfirm?: (val?: string) => void;
  onCancel?: () => void;
}

const initialState: ModalState = {
  isOpen: false,
  title: "",
  message: "",
  type: "info",
  confirmText: "Confirm",
  cancelText: "Cancel",
  showInput: false,
  inputValue: "",
  onConfirm: undefined,
  onCancel: undefined,
};

const modalSlice = createSlice({
  name: "modal",
  initialState,
  reducers: {
    showModal: (state, action: PayloadAction<Partial<ModalState>>) => {
      return {
        ...initialState,
        ...action.payload,
        isOpen: true,
      } as any; // Cast functions bypass RTK state warning
    },
    closeModal: (state) => {
      state.isOpen = false;
    },
    setInputValue: (state, action: PayloadAction<string>) => {
      state.inputValue = action.payload;
    },
  },
});

export const { showModal, closeModal, setInputValue } = modalSlice.actions;
export default modalSlice.reducer;
export type { ModalState };
