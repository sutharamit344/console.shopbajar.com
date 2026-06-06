import React, { useEffect, useState } from "react";
import { Clock, History, Calendar, CircleCheckBig, Edit, CircleAlert } from "lucide-react";
import { getEntityLogs } from "@/lib/db";
import Button from "@/components/UI/Button";
import Dialog from "@/components/UI/Dialog";

interface ShopHistoryDialogProps {
  shop: any;
  isOpen: boolean;
  onClose: () => void;
}

const ShopHistoryDialog: React.FC<ShopHistoryDialogProps> = ({ shop, isOpen, onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && shop?.id) {
      const fetchLogs = async () => {
        setLoading(true);
        const data = await getEntityLogs(shop.id);
        setLogs(data);
        setLoading(false);
      };
      fetchLogs();
    }
  }, [isOpen, shop?.id]);

  const getActionIcon = (action: string) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('create') || actionLower.includes('add')) {
      return <CircleCheckBig size={12} />;
    }
    if (actionLower.includes('edit') || actionLower.includes('update')) {
      return <Edit size={12} />;
    }
    if (actionLower.includes('reject') || actionLower.includes('delete')) {
      return <CircleAlert size={12} />;
    }
    return <Clock size={12} />;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Audit History"
      subtitle={`Complete modification history for ${shop?.name || 'shop'}`}
      icon={History}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-end">
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="h-8 text-[11px]"
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="relative">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#FF6A00] border-t-transparent animate-spin"></div>
            <p className="text-[11px] font-semibold text-zinc-450 dark:text-zinc-550 uppercase tracking-wider">
              Loading history...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-[#FF6A00]/5 dark:bg-[#FF6A00]/10 rounded-md flex items-center justify-center mx-auto">
              <Clock size={32} className="text-zinc-400 dark:text-zinc-650" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1">No history recorded</p>
              <p className="text-[12px] text-zinc-450 dark:text-zinc-550">No modifications have been made to this shop yet.</p>
            </div>
          </div>
        ) : (
          <div className="relative space-y-6">
            {/* Vertical Timeline Line */}
            <div className="absolute left-[15px] top-6 bottom-6 w-[1px] bg-black/[0.06] dark:bg-zinc-800"></div>

            {logs.map((log, idx) => (
              <div key={log.id || idx} className="relative flex gap-4 group">
                {/* Timeline Dot */}
                <div className="relative z-10 w-8 h-8 bg-white dark:bg-zinc-900 rounded-md border border-black/[0.06] dark:border-zinc-800 flex items-center justify-center text-[#FF6A00] group-hover:border-[#FF6A00]/30 dark:group-hover:border-[#FF6A00]/50 group-hover:bg-[#FF6A00]/5 dark:group-hover:bg-[#FF6A00]/10 transition-all shrink-0">
                  {getActionIcon(log.action || log.details)}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 bg-gray-50 dark:bg-zinc-800/80 px-3 py-1 rounded-md border border-black/[0.04] dark:border-zinc-700/50">
                        {log.performedBy || 'System Admin'}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-zinc-450 dark:text-zinc-550 flex items-center gap-1">
                      <Calendar size={10} />
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                    </span>
                  </div>

                  <p className="text-[13px] text-zinc-650 dark:text-zinc-350 leading-relaxed pl-1">
                    {log.details || `${log.action} performed on shop`}
                  </p>

                  {log.changes && (
                    <div className="mt-2 pl-1">
                      <div className="bg-gray-50 dark:bg-zinc-950/80 rounded-md p-3 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 border border-black/[0.04] dark:border-zinc-800">
                        {JSON.stringify(log.changes, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default ShopHistoryDialog;
