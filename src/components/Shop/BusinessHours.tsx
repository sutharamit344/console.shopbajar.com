import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch } from "../../redux/store";
import {
  selectOpeningHours,
  selectHolidays,
  selectDashboardIsSaving,
} from "../../redux/selectors/dashboardSelectors";
import {
  setOpeningHoursState,
  setHolidaysState,
} from "../../redux/slices/dashboardSlice";
import { updateMerchantShop } from "../../redux/thunks/dashboardThunks";
import Button from "../UI/Button";

interface BusinessHoursProps {
  shopId: string;
  onShowAlert: (config: { title: string; message: string; type: "success" | "error" | "info" }) => void;
  onShowConfirm: (config: { title: string; message: string; confirmText: string; type: "error" | "info"; onConfirm: () => void }) => void;
}

const BusinessHours: React.FC<BusinessHoursProps> = ({
  shopId,
  onShowAlert,
  onShowConfirm,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  const openingHours = (useSelector(selectOpeningHours) || {}) as any;
  const holidays = useSelector(selectHolidays) || [];
  const isSaving = useSelector(selectDashboardIsSaving);

  const [newHoliday, setNewHoliday] = useState({ date: "", title: "" });

  const handleUpdateHours = async () => {
    dispatch(
      updateMerchantShop({
        shopId,
        updateData: { openingHoursDetails: openingHours, holidays },
      })
    )
      .unwrap()
      .then(() => {
        onShowAlert({
          title: "Success",
          message: "Opening hours and holidays updated!",
          type: "success",
        });
      })
      .catch((err) => {
        onShowAlert({
          title: "Save Failed",
          message: err || "Failed to update business hours.",
          type: "error",
        });
      });
  };

  const handleAddHoliday = () => {
    if (!newHoliday.date || !newHoliday.title) return;
    dispatch(setHolidaysState([...holidays, newHoliday]));
    setNewHoliday({ date: "", title: "" });
  };

  const handleDeleteHoliday = (idx: number) => {
    onShowConfirm({
      title: "Delete Holiday",
      message:
        "Are you sure you want to delete this holiday? Your shop will resume normal business hours for this date.",
      confirmText: "Yes, Delete",
      type: "error",
      onConfirm: () => {
        dispatch(setHolidaysState(holidays.filter((_, i) => i !== idx)));
      },
    });
  };

  const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start animate-in fade-in duration-300">
      {/* Weekly timing list */}
      <div className="bg-white rounded-md border border-zinc-200/80 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Weekly Schedule
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Set your regular operating hours
            </p>
          </div>
          <Button onClick={handleUpdateHours} disabled={isSaving} size="sm">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
        <div className="p-4 space-y-2.5">
          {daysOfWeek.map((day) => {
            const dayData = openingHours[day] || { open: "09:00", close: "21:00", isClosed: false };
            return (
              <div
                key={day}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-zinc-50 border border-zinc-200/80 gap-3 dark:bg-zinc-850/50 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3 w-32 shrink-0">
                  <div
                    className={`w-2 h-2 rounded-full ${dayData.isClosed ? "bg-red-400" : "bg-emerald-400"
                      }`}
                  />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 capitalize tracking-tight">
                    {day}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={dayData.open}
                      disabled={dayData.isClosed}
                      onChange={(e) =>
                        dispatch(
                          setOpeningHoursState({
                            ...openingHours,
                            [day]: { ...dayData, open: e.target.value },
                          })
                        )
                      }
                      className="h-8 px-2.5 bg-white border border-zinc-200/80 rounded-md text-xs outline-none disabled:opacity-50 font-medium dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 shadow-sm"
                    />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">
                      to
                    </span>
                    <input
                      type="time"
                      value={dayData.close}
                      disabled={dayData.isClosed}
                      onChange={(e) =>
                        dispatch(
                          setOpeningHoursState({
                            ...openingHours,
                            [day]: { ...dayData, close: e.target.value },
                          })
                        )
                      }
                      className="h-8 px-2.5 bg-white border border-zinc-200/80 rounded-md text-xs outline-none disabled:opacity-50 font-medium dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 shadow-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={dayData.isClosed}
                      onChange={(e) =>
                        dispatch(
                          setOpeningHoursState({
                            ...openingHours,
                            [day]: {
                              ...dayData,
                              isClosed: e.target.checked,
                            },
                          })
                        )
                      }
                      className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00] dark:border-zinc-650 dark:bg-zinc-850"
                    />
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                      Closed
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Holiday schedule list */}
      <div className="bg-white rounded-md border border-zinc-200/80 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Upcoming Holidays
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Mark your shop as closed for specific dates
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="date"
                value={newHoliday.date}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, date: e.target.value })
                }
                className="w-full h-9 px-3 bg-zinc-50 border border-zinc-200/80 rounded-md text-xs outline-none focus:bg-white transition-all font-medium dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 shadow-sm"
              />
            </div>
            <div className="flex-[2]">
              <input
                type="text"
                placeholder="Holiday Title (e.g. Diwali, Store Maintenance)"
                value={newHoliday.title}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, title: e.target.value })
                }
                className="w-full h-9 px-3 bg-zinc-50 border border-zinc-200/80 rounded-md text-xs outline-none focus:bg-white transition-all font-medium dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 shadow-sm"
              />
            </div>
            <Button
              onClick={handleAddHoliday}
              disabled={!newHoliday.date || !newHoliday.title}
              variant="outline"
              size="sm"
              className="h-9 cursor-pointer"
            >
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>

          <div className="space-y-2">
            {holidays.length > 0 ? (
              holidays.map((holiday: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 bg-zinc-50 rounded-md border border-zinc-200/80 dark:bg-zinc-850/50 dark:border-zinc-800 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="px-2.5 py-1 bg-white border border-zinc-200/80 rounded-md text-[10px] font-bold text-[#FF6A00] dark:bg-zinc-950 dark:border-zinc-800 shadow-sm">
                      {new Date(holiday.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                      {holiday.title}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteHoliday(idx)}
                    className="p-1.5 hover:bg-red-50 rounded-md text-zinc-400 hover:text-red-500 transition-all dark:hover:bg-red-950/20 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-6 bg-zinc-50 rounded-md border border-dashed border-zinc-200 dark:bg-zinc-850/30 dark:border-zinc-800">
                <p className="text-xs text-zinc-400 font-medium">
                  No holidays scheduled
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessHours;
