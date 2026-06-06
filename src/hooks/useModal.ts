import { useDispatch } from "react-redux";
import { showModal, closeModal } from "../redux/slices/modalSlice";
import { useCallback } from "react";

export const useModal = () => {
  const dispatch = useDispatch();

  const showAlert = useCallback((payload: any) => {
    dispatch(showModal({ ...payload, type: payload.type || "info" }));
  }, [dispatch]);

  const showConfirm = useCallback((payload: any) => {
    dispatch(showModal({ ...payload, type: payload.type || "confirm" }));
  }, [dispatch]);

  const showPrompt = useCallback((payload: any) => {
    dispatch(showModal({ ...payload, type: "prompt" }));
  }, [dispatch]);

  const close = useCallback(() => {
    dispatch(closeModal());
  }, [dispatch]);

  return {
    showAlert,
    showConfirm,
    showPrompt,
    closeModal: close,
  };
};
